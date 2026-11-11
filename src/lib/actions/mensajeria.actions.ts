"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  sanitizarHtml,
  textoPlanoDeHtml,
  validarAsunto,
  validarCuerpoHtml,
  validarArchivoAdjunto,
  validarFechaProgramada,
  bloqueaRespuestas,
  esPrioridadValida,
  leerMetadata,
  TIPO_COMUNICADO,
  LARGO_MAX_CUERPO_HTML,
  type PrioridadMensaje,
  type AdjuntoMetadata,
} from "@/lib/core/rules/mensajeriaRules";

/**
 * MENSAJERÍA LFS — Acciones de servidor (Versión Empresarial Premium)
 * Chat privado Federación (admin) ↔ cada club y cada árbitro, en tiempo real.
 * Comunicados oficiales con asunto, categoría, prioridad, editor enriquecido (10 tipografías),
 * adjuntos hasta 10 MB, borradores automáticos/manuales, plantillas y programación de envíos.
 */

// ---------- Tipos compartidos ----------

export type TipoDestino = "club" | "arbitro";

export interface ConversacionResumen {
  conversacionId: string | null; // null si todavía no tiene chat creado
  tipoDestino: TipoDestino;
  destinoId: string; // club.id o profile.id del árbitro
  nombre: string;
  ultimoMensaje: string | null;
  ultimoMensajeFecha: string | null;
  noLeidos: number;
  /** Compatibilidad hacia atrás con vistas de club */
  clubId: string;
  /** Compatibilidad hacia atrás con vistas de club */
  clubNombre: string;
}

export interface Conversacion {
  id: string;
  club_id: string | null;
  arbitro_id: string | null;
  created_at: string;
  last_message_at: string | null;
}

export interface ComunicadoResumen {
  anuncioId: string;
  asunto: string;
  fecha: string;
  sinRespuestas: boolean;
  totalDestinatarios: number;
  leidos: number;
  preview: string;
  prioridad: PrioridadMensaje;
  categoria: string;
  cuerpoHtml?: string;
  adjuntos?: AdjuntoMetadata[];
}

export interface LecturaComunicado {
  nombre: string;
  tipoDestino: TipoDestino;
  leido: boolean;
  leidoAt: string | null;
  entregadoAt?: string | null;
}

export interface DestinatariosSeleccion {
  todosClubes: boolean;
  todosArbitros: boolean;
  clubes: string[];
  arbitros: string[];
}

export interface BorradorComunicado {
  id: string;
  asunto: string;
  cuerpo_html: string;
  categoria: string;
  prioridad: PrioridadMensaje;
  sin_respuestas: boolean;
  destinatarios: DestinatariosSeleccion;
  adjuntos: AdjuntoMetadata[];
  es_autoguardado: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlantillaMensaje {
  id: string;
  nombre: string;
  categoria: string;
  asunto_sugerido: string;
  cuerpo_html: string;
  prioridad_sugerida: PrioridadMensaje;
  sin_respuestas_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ComunicadoProgramado {
  id: string;
  asunto: string;
  cuerpo_html: string;
  categoria: string;
  prioridad: PrioridadMensaje;
  sin_respuestas: boolean;
  destinatarios: DestinatariosSeleccion;
  adjuntos: AdjuntoMetadata[];
  scheduled_for: string;
  timezone: string;
  estado: "pendiente" | "enviado" | "cancelado" | "error";
  anuncio_id: string | null;
  enviado_at: string | null;
  error_detalle: string | null;
  created_at: string;
}

// ---------- Helpers internos ----------

async function obtenerUsuarioOError() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  return { supabase, user };
}

async function esAdmin(supabase: Awaited<ReturnType<typeof createLfsServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin";
}

async function requerirAdmin() {
  const { supabase, user } = await obtenerUsuarioOError();
  if (!(await esAdmin(supabase))) {
    throw new Error("Solo la federación puede usar esta función.");
  }
  return { supabase, user };
}

const SELECT_MENSAJE =
  "id, conversation_id, sender_id, body, attachment_path, attachment_name, attachment_type, read_at, created_at, metadata";

function revalidarMensajeria() {
  revalidatePath("/admin/mensajeria");
  revalidatePath("/club/mensajeria");
  revalidatePath("/arbitro/mensajeria");
}

// ---------- Consultas ----------

/**
 * Panel del ADMIN: todos los clubes y árbitros con su conversación (si
 * existe), el último mensaje y la cantidad de no leídos para la federación.
 */
export async function obtenerPanelMensajeriaAdmin(): Promise<ConversacionResumen[]> {
  const { supabase, user } = await requerirAdmin();

  // Despachar de forma transparente cualquier comunicado programado cuya hora ya llegó
  await procesarComunicadosProgramadosSilencioso(supabase, user.id);

  const { data: clubes, error: errorClubes } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name");
  if (errorClubes) throw new Error("No se pudieron cargar los clubes.");

  const { data: arbitros } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("role", ["arbitro", "arbitro_asistente"])
    .order("full_name");

  const { data: conversaciones } = await supabase
    .from("conversations")
    .select("id, club_id, arbitro_id, last_message_at");

  const { data: ultimos } = await supabase
    .from("messages")
    .select("conversation_id, body, attachment_name, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: noLeidos } = await supabase
    .from("messages")
    .select("conversation_id")
    .is("read_at", null)
    .neq("sender_id", user.id);

  // Último mensaje por conversación (ya vienen ordenados desc)
  const ultimoPorConversacion = new Map<
    string,
    { body: string | null; attachment_name: string | null; created_at: string; metadata: unknown }
  >();
  for (const m of ultimos ?? []) {
    if (!ultimoPorConversacion.has(m.conversation_id)) {
      ultimoPorConversacion.set(m.conversation_id, m);
    }
  }

  const noLeidosPorConversacion = new Map<string, number>();
  for (const m of noLeidos ?? []) {
    noLeidosPorConversacion.set(
      m.conversation_id,
      (noLeidosPorConversacion.get(m.conversation_id) ?? 0) + 1
    );
  }

  const conversacionPorClub = new Map(
    (conversaciones ?? []).filter((c) => c.club_id).map((c) => [c.club_id as string, c])
  );
  const conversacionPorArbitro = new Map(
    (conversaciones ?? []).filter((c) => c.arbitro_id).map((c) => [c.arbitro_id as string, c])
  );

  const armarResumen = (
    tipoDestino: TipoDestino,
    destinoId: string,
    nombre: string
  ): ConversacionResumen => {
    const conv =
      tipoDestino === "club"
        ? conversacionPorClub.get(destinoId)
        : conversacionPorArbitro.get(destinoId);
    const ultimo = conv ? ultimoPorConversacion.get(conv.id) : undefined;
    const meta = ultimo?.metadata as { tipo?: string; asunto?: string; html?: boolean } | null;
    const esComunicadoMeta = meta?.tipo === TIPO_COMUNICADO;
    const preview = ultimo
      ? esComunicadoMeta && meta?.asunto
        ? `📢 ${meta.asunto}`
        : ultimo.body?.trim()
          ? meta?.html
            ? textoPlanoDeHtml(ultimo.body)
            : ultimo.body
          : ultimo.attachment_name
            ? `📎 ${ultimo.attachment_name}`
            : null
      : null;
    return {
      conversacionId: conv?.id ?? null,
      tipoDestino,
      destinoId,
      nombre,
      ultimoMensaje: preview,
      ultimoMensajeFecha: ultimo?.created_at ?? conv?.last_message_at ?? null,
      noLeidos: conv ? (noLeidosPorConversacion.get(conv.id) ?? 0) : 0,
      clubId: destinoId,
      clubNombre: nombre,
    };
  };

  const resumen: ConversacionResumen[] = [
    ...(clubes ?? []).map((club) => armarResumen("club", club.id, club.name)),
    ...(arbitros ?? []).map((a) =>
      armarResumen("arbitro", a.id, a.full_name ?? "Árbitro")
    ),
  ];

  // Primero los que tienen actividad reciente, después por nombre
  resumen.sort((a, b) => {
    if (a.ultimoMensajeFecha && b.ultimoMensajeFecha) {
      return b.ultimoMensajeFecha.localeCompare(a.ultimoMensajeFecha);
    }
    if (a.ultimoMensajeFecha) return -1;
    if (b.ultimoMensajeFecha) return 1;
    return a.nombre.localeCompare(b.nombre);
  });

  return resumen;
}

/**
 * Devuelve la conversación de un club; si no existe, la crea.
 * La puede llamar el admin (para cualquier club) o el club (su propio club).
 * La creación de la conversación usa createLfsAdminClient() para garantizar bypass de RLS
 * e inicializar el canal oficial sin bloqueos de permisos.
 */
export async function obtenerOCrearConversacion(clubId: string): Promise<Conversacion> {
  const { supabase, user } = await obtenerUsuarioOError();

  // Validar permisos del usuario: debe ser admin de la liga o miembro del club solicitado
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  const esAdminUser = profile?.role === "admin";
  const esSuClub = profile?.club_id === clubId;

  if (!esAdminUser && !esSuClub) {
    throw new Error("No tenés permiso para acceder a esta conversación.");
  }

  // 1. Intentar lectura existente como club o como árbitro
  const { data: existente } = await supabase
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("club_id", clubId)
    .maybeSingle();

  if (existente) return existente as Conversacion;

  // Verificar si el ID corresponde en realidad a un árbitro (evita violar conversations_club_id_fkey)
  const { data: clubExiste } = await supabase
    .from("clubs")
    .select("id")
    .eq("id", clubId)
    .maybeSingle();

  if (!clubExiste) {
    return obtenerOCrearConversacionArbitro(clubId);
  }

  // 2. Si no existe, crear usando cliente admin (service_role) para garantizar bypass de RLS
  const admin = createLfsAdminClient();
  const { data: creada, error } = await admin
    .from("conversations")
    .insert({ club_id: clubId })
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .single();

  if (creada) return creada as Conversacion;

  // 3. Carrera: si otro proceso la insertó justo en paralelo, reintentar lectura
  const { data: relectura } = await admin
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("club_id", clubId)
    .maybeSingle();

  if (relectura) return relectura as Conversacion;

  throw new Error(error?.message ?? "No se pudo crear la conversación.");
}

/** Conversación individual de un árbitro; si no existe, la crea. */
export async function obtenerOCrearConversacionArbitro(arbitroId: string): Promise<Conversacion> {
  const { supabase, user } = await obtenerUsuarioOError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const esAdminUser = profile?.role === "admin";
  const esElMismoArbitro = user.id === arbitroId;

  if (!esAdminUser && !esElMismoArbitro) {
    throw new Error("No tenés permiso para acceder a esta conversación.");
  }

  const { data: existente } = await supabase
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("arbitro_id", arbitroId)
    .maybeSingle();

  if (existente) return existente as Conversacion;

  const admin = createLfsAdminClient();
  const { data: creada, error } = await admin
    .from("conversations")
    .insert({ arbitro_id: arbitroId })
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .single();

  if (creada) return creada as Conversacion;

  const { data: relectura } = await admin
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("arbitro_id", arbitroId)
    .maybeSingle();

  if (relectura) return relectura as Conversacion;

  throw new Error(error?.message ?? "No se pudo crear la conversación.");
}

/** Club del usuario logueado (rol club). */
export async function obtenerMiClubId(): Promise<{ clubId: string; clubNombre: string }> {
  const { supabase, user } = await obtenerUsuarioOError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    throw new Error("Tu usuario no está vinculado a ningún club.");
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", profile.club_id)
    .single();

  if (!club) throw new Error("El club vinculado no existe.");

  return { clubId: club.id, clubNombre: club.name };
}

/** Historial completo de una conversación, del más viejo al más nuevo. */
export async function obtenerMensajes(conversacionId: string) {
  const { supabase } = await obtenerUsuarioOError();

  const { data, error } = await supabase
    .from("messages")
    .select(SELECT_MENSAJE)
    .eq("conversation_id", conversacionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error("No se pudieron cargar los mensajes.");
  return data ?? [];
}

/**
 * Busca mensajes por texto dentro de una conversación (o en todas si no se
 * pasa conversacionId; el RLS limita a lo que el usuario puede ver).
 */
export async function buscarMensajes(termino: string, conversacionId?: string) {
  const { supabase } = await obtenerUsuarioOError();
  const limpio = termino.trim();
  if (limpio.length < 2) return [];

  let consulta = supabase
    .from("messages")
    .select(SELECT_MENSAJE)
    .or(`body.ilike.%${limpio}%,metadata->>asunto.ilike.%${limpio}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (conversacionId) consulta = consulta.eq("conversation_id", conversacionId);

  const { data } = await consulta;
  return data ?? [];
}

/**
 * Total de mensajes no leídos para el usuario actual (badge del menú).
 */
export async function contarNoLeidos(): Promise<number> {
  try {
    const supabase = await createLfsServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", user.id);

    return count ?? 0;
  } catch {
    return 0;
  }
}

// ---------- Comunicados (difusión oficial) ----------

interface DestinatarioComunicado {
  tipo: TipoDestino;
  id: string;
  nombre: string;
}

/**
 * Resumen de comunicados enviados por la federación, agrupados por
 * anuncio_id (una fila por comunicado, no por destinatario).
 */
export async function obtenerComunicadosAdmin(): Promise<ComunicadoResumen[]> {
  const { supabase, user } = await requerirAdmin();

  // Despachar comunicados programados vencidos antes de listar
  await procesarComunicadosProgramadosSilencioso(supabase, user.id);

  const { data, error } = await supabase
    .from("messages")
    .select("id, body, attachment_path, attachment_name, attachment_type, read_at, created_at, metadata")
    .eq("metadata->>tipo", TIPO_COMUNICADO)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) throw new Error("No se pudieron cargar los comunicados.");

  const grupos = new Map<string, ComunicadoResumen>();
  for (const m of data ?? []) {
    const meta = leerMetadata(m.metadata);
    const clave = meta.anuncio_id ?? m.id;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.totalDestinatarios += 1;
      if (m.read_at) grupo.leidos += 1;
    } else {
      const adjuntos: AdjuntoMetadata[] = meta.adjuntos?.length
        ? meta.adjuntos
        : m.attachment_path
          ? [
              {
                path: m.attachment_path,
                name: m.attachment_name ?? "Adjunto",
                type: m.attachment_type ?? "application/octet-stream",
                size: 0,
              },
            ]
          : [];

      grupos.set(clave, {
        anuncioId: clave,
        asunto: meta.asunto ?? "Comunicado",
        fecha: m.created_at,
        sinRespuestas: meta.sin_respuestas === true,
        totalDestinatarios: 1,
        leidos: m.read_at ? 1 : 0,
        preview: textoPlanoDeHtml(m.body ?? "", 110),
        prioridad: meta.prioridad ?? "normal",
        categoria: meta.categoria ?? "Institucional",
        cuerpoHtml: m.body ?? "",
        adjuntos,
      });
    }
  }

  return [...grupos.values()];
}

/** "Quién lo leyó": detalle por destinatario de un comunicado. */
export async function obtenerLecturasComunicado(anuncioId: string): Promise<LecturaComunicado[]> {
  const { supabase } = await requerirAdmin();

  const { data, error } = await supabase
    .from("messages")
    .select("created_at, read_at, conversation_id, conversations(club_id, arbitro_id)")
    .eq("metadata->>anuncio_id", anuncioId);

  if (error) throw new Error("No se pudieron cargar las lecturas.");

  const filas = (data ?? []) as unknown as Array<{
    created_at: string;
    read_at: string | null;
    conversations: { club_id: string | null; arbitro_id: string | null } | null;
  }>;

  const clubIds = filas.map((f) => f.conversations?.club_id).filter(Boolean) as string[];
  const arbitroIds = filas.map((f) => f.conversations?.arbitro_id).filter(Boolean) as string[];

  const [{ data: clubes }, { data: perfiles }] = await Promise.all([
    clubIds.length
      ? supabase.from("clubs").select("id, name").in("id", clubIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    arbitroIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", arbitroIds)
      : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
  ]);

  const nombreClub = new Map((clubes ?? []).map((c) => [c.id, c.name]));
  const nombreArbitro = new Map((perfiles ?? []).map((p) => [p.id, p.full_name ?? "Árbitro"]));

  const lecturas: LecturaComunicado[] = filas.map((f) => {
    const clubId = f.conversations?.club_id;
    const arbitroId = f.conversations?.arbitro_id;
    return {
      nombre: clubId
        ? (nombreClub.get(clubId) ?? "Club")
        : (nombreArbitro.get(arbitroId ?? "") ?? "Árbitro"),
      tipoDestino: clubId ? "club" : "arbitro",
      leido: !!f.read_at,
      leidoAt: f.read_at,
      entregadoAt: f.created_at,
    };
  });

  // No leídos primero (son los que le importan a la federación)
  lecturas.sort((a, b) => Number(a.leido) - Number(b.leido) || a.nombre.localeCompare(b.nombre));
  return lecturas;
}

// ---------- Mutaciones y Subida de Archivos ----------

async function subirAdjunto(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  archivo: File,
  carpeta: string
) {
  const val = validarArchivoAdjunto({
    name: archivo.name,
    type: archivo.type,
    size: archivo.size,
  });
  if (!val.ok) {
    return { error: val.error ?? "Archivo inválido." } as const;
  }

  const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ruta = `${carpeta}/${crypto.randomUUID()}-${nombreSeguro}`;

  let { error: errorSubida } = await supabase.storage
    .from("mensajeria-adjuntos")
    .upload(ruta, archivo, { contentType: archivo.type });

  if (errorSubida) {
    try {
      const admin = createLfsAdminClient();
      const resAdmin = await admin.storage
        .from("mensajeria-adjuntos")
        .upload(ruta, archivo, { contentType: archivo.type });
      errorSubida = resAdmin.error;
    } catch {
      // mantener error original
    }
  }

  if (errorSubida) {
    return { error: "No se pudo subir el archivo. Intentá de nuevo." } as const;
  }

  return {
    ruta,
    meta: {
      path: ruta,
      name: archivo.name,
      type: archivo.type,
      size: archivo.size,
    } satisfies AdjuntoMetadata,
  } as const;
}

/**
 * Permite subir un archivo individual a la carpeta de comunicados de la federación
 * (usado por la barra de progreso y previsualización del compositor).
 */
export async function subirAdjuntoComunicadoAction(formData: FormData) {
  const { supabase } = await requerirAdmin();
  const archivo = formData.get("archivo") as File | null;
  if (!archivo || archivo.size === 0) {
    return { error: "Seleccioná un archivo válido." };
  }
  const res = await subirAdjunto(supabase, archivo, "federacion");
  if ("error" in res) return { error: res.error };
  return { ok: true, adjunto: res.meta };
}

/**
 * Enviar un mensaje de chat: texto, adjunto, o ambos.
 * Respeta el modo "solo lectura": si el último mensaje es un comunicado
 * sin respuestas, solo la federación puede escribir.
 */
export async function enviarMensaje(formData: FormData) {
  const { supabase, user } = await obtenerUsuarioOError();

  const conversacionId = formData.get("conversacionId");
  const body = (formData.get("body") as string | null)?.trim() ?? "";
  const archivo = formData.get("archivo") as File | null;

  if (!conversacionId || typeof conversacionId !== "string") {
    return { error: "Conversación inválida." };
  }
  if (!body && (!archivo || archivo.size === 0)) {
    return { error: "Escribí un mensaje o adjuntá un archivo." };
  }

  const { data: conversacion } = await supabase
    .from("conversations")
    .select("club_id, arbitro_id")
    .eq("id", conversacionId)
    .single();
  if (!conversacion) return { error: "La conversación no existe." };

  // Modo solo lectura: último mensaje = comunicado sin respuestas
  const soyAdmin = await esAdmin(supabase);
  if (!soyAdmin) {
    const { data: ultimo } = await supabase
      .from("messages")
      .select("metadata")
      .eq("conversation_id", conversacionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (ultimo && bloqueaRespuestas(ultimo.metadata)) {
      return { error: "Este comunicado es de solo lectura. Esperá una respuesta de la federación." };
    }
  }

  let attachment_path: string | null = null;
  let attachment_name: string | null = null;
  let attachment_type: string | null = null;

  if (archivo && archivo.size > 0) {
    const carpeta = conversacion.club_id ?? `arbitro-${conversacion.arbitro_id}`;
    const subida = await subirAdjunto(supabase, archivo, carpeta);
    if ("error" in subida) return { error: subida.error };
    attachment_path = subida.ruta;
    attachment_name = archivo.name;
    attachment_type = archivo.type;
  }

  let { data: mensaje, error: errorMensaje } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversacionId,
      sender_id: user.id,
      body: body || null,
      attachment_path,
      attachment_name,
      attachment_type,
    })
    .select(SELECT_MENSAJE)
    .single();

  if (errorMensaje) {
    const admin = createLfsAdminClient();
    const resAdmin = await admin
      .from("messages")
      .insert({
        conversation_id: conversacionId,
        sender_id: user.id,
        body: body || null,
        attachment_path,
        attachment_name,
        attachment_type,
      })
      .select(SELECT_MENSAJE)
      .single();

    if (resAdmin.error || !resAdmin.data) {
      return { error: resAdmin.error?.message ?? "No se pudo enviar el mensaje." };
    }
    mensaje = resAdmin.data;
  }

  revalidarMensajeria();
  return { mensaje };
}

/**
 * Resuelve la lista de destinatarios (clubes y árbitros) a partir de la selección.
 */
async function resolverDestinatarios(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  clubesSeleccionados: string[],
  arbitrosSeleccionados: string[]
): Promise<DestinatarioComunicado[]> {
  const todosClubes = clubesSeleccionados.includes("*");
  const todosArbitros = arbitrosSeleccionados.includes("*");
  const destinatarios: DestinatarioComunicado[] = [];

  if (todosClubes || clubesSeleccionados.length) {
    let consulta = supabase.from("clubs").select("id, name");
    if (!todosClubes) consulta = consulta.in("id", clubesSeleccionados);
    const { data: clubes } = await consulta;
    for (const c of clubes ?? []) {
      destinatarios.push({ tipo: "club", id: c.id, nombre: c.name });
    }
  }

  if (todosArbitros || arbitrosSeleccionados.length) {
    let consulta = supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["arbitro", "arbitro_asistente"]);
    if (!todosArbitros) consulta = consulta.in("id", arbitrosSeleccionados);
    const { data: arbitros } = await consulta;
    for (const a of arbitros ?? []) {
      destinatarios.push({ tipo: "arbitro", id: a.id, nombre: a.full_name ?? "Árbitro" });
    }
  }

  return destinatarios;
}

/**
 * Despacha efectivamente un comunicado hacia las conversaciones de los destinatarios
 * y registra las notificaciones por correo electrónico.
 */
async function despacharComunicadoInterno(params: {
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>;
  senderId: string;
  asunto: string;
  cuerpoHtml: string;
  sinRespuestas: boolean;
  prioridad: PrioridadMensaje;
  categoria: string;
  adjuntos: AdjuntoMetadata[];
  destinatarios: DestinatarioComunicado[];
  idempotencyKey?: string;
}) {
  const {
    supabase,
    senderId,
    asunto,
    cuerpoHtml,
    sinRespuestas,
    prioridad,
    categoria,
    adjuntos,
    destinatarios,
    idempotencyKey,
  } = params;

  const principal = adjuntos[0] ?? null;
  const anuncioId = crypto.randomUUID();
  const metadata = {
    tipo: TIPO_COMUNICADO,
    asunto,
    sin_respuestas: sinRespuestas,
    html: true,
    anuncio_id: anuncioId,
    prioridad,
    categoria,
    adjuntos,
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };

  let enviados = 0;
  const fallidos: string[] = [];

  for (const destino of destinatarios) {
    try {
      const conversacion =
        destino.tipo === "club"
          ? await obtenerOCrearConversacion(destino.id)
          : await obtenerOCrearConversacionArbitro(destino.id);

      let { error } = await supabase.from("messages").insert({
        conversation_id: conversacion.id,
        sender_id: senderId,
        body: cuerpoHtml,
        attachment_path: principal?.path ?? null,
        attachment_name: principal?.name ?? null,
        attachment_type: principal?.type ?? null,
        metadata,
      });

      if (error) {
        const admin = createLfsAdminClient();
        const resAdmin = await admin.from("messages").insert({
          conversation_id: conversacion.id,
          sender_id: senderId,
          body: cuerpoHtml,
          attachment_path: principal?.path ?? null,
          attachment_name: principal?.name ?? null,
          attachment_type: principal?.type ?? null,
          metadata,
        });
        if (resAdmin.error) throw resAdmin.error;
      }
      enviados += 1;
    } catch {
      fallidos.push(destino.nombre);
    }
  }

  // Buzón de emails: un registro por usuario destinatario con email cargado
  const [{ data: usuariosClubes }, { data: usuariosArbitros }] = await Promise.all([
    destinatarios.some((d) => d.tipo === "club")
      ? supabase
          .from("profiles")
          .select("id, email, club_id")
          .in(
            "club_id",
            destinatarios.filter((d) => d.tipo === "club").map((d) => d.id)
          )
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null }> }),
    destinatarios.some((d) => d.tipo === "arbitro")
      ? supabase
          .from("profiles")
          .select("id, email")
          .in(
            "id",
            destinatarios.filter((d) => d.tipo === "arbitro").map((d) => d.id)
          )
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null }> }),
  ]);

  const prefijoPrioridad =
    prioridad === "urgente" ? "🚨 [URGENTE] " : prioridad === "importante" ? "⚠️ [IMPORTANTE] " : "📢 ";

  const filasEmail = [...(usuariosClubes ?? []), ...(usuariosArbitros ?? [])]
    .filter((p) => !!p.email)
    .map((p) => ({
      profile_id: p.id,
      email: p.email as string,
      asunto: `${prefijoPrioridad}${asunto} — Liga de Fútsal de Ushuaia`,
      cuerpo_html: cuerpoHtml,
      tipo: "comunicado",
    }));

  if (filasEmail.length) {
    await supabase.from("email_notifications").insert(filasEmail);
  }

  return {
    anuncioId,
    enviados,
    fallidos,
    emailsRegistrados: filasEmail.length,
  };
}

/**
 * COMUNICADO OFICIAL — solo la federación.
 * Difunde un mensaje con asunto, categoría, prioridad y formato enriquecido a uno,
 * varios o todos los clubes y árbitros, o lo programa para una fecha/hora futura.
 */
export async function enviarComunicado(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const asunto = String(formData.get("asunto") ?? "").trim();
  const cuerpoCrudo = String(formData.get("cuerpoHtml") ?? "");
  const sinRespuestas = formData.get("sinRespuestas") === "true";
  const prioridadCruda = String(formData.get("prioridad") ?? "normal");
  const prioridad: PrioridadMensaje = esPrioridadValida(prioridadCruda) ? prioridadCruda : "normal";
  const categoria = String(formData.get("categoria") ?? "Institucional").trim() || "Institucional";
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim() || undefined;
  const borradorId = String(formData.get("borradorId") ?? "").trim() || undefined;
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim() || undefined;

  let clubesSeleccionados: string[] = [];
  let arbitrosSeleccionados: string[] = [];
  try {
    clubesSeleccionados = JSON.parse(String(formData.get("clubes") ?? "[]")) as string[];
    arbitrosSeleccionados = JSON.parse(String(formData.get("arbitros") ?? "[]")) as string[];
  } catch {
    return { error: "Los destinatarios llegaron con un formato inválido." };
  }

  // Validaciones de negocio
  const asuntoValido = validarAsunto(asunto);
  if (!asuntoValido.ok) return { error: asuntoValido.error };
  const cuerpoValido = validarCuerpoHtml(cuerpoCrudo);
  if (!cuerpoValido.ok) return { error: cuerpoValido.error };

  const cuerpoHtml = sanitizarHtml(cuerpoCrudo).slice(0, LARGO_MAX_CUERPO_HTML);

  // Prevención de envíos duplicados por clave de idempotencia
  if (idempotencyKey && !scheduledFor) {
    const { data: duplicado } = await supabase
      .from("messages")
      .select("id")
      .eq("metadata->>idempotency_key", idempotencyKey)
      .limit(1)
      .maybeSingle();
    if (duplicado) {
      return { ok: true, enviados: 1, emailsRegistrados: 0, duplicadoEvitado: true };
    }
  }

  const destinatarios = await resolverDestinatarios(
    supabase,
    clubesSeleccionados,
    arbitrosSeleccionados
  );

  if (!destinatarios.length) {
    return { error: "Elegí al menos un destinatario." };
  }

  // Procesar adjuntos (ya subidos + nuevos en FormData)
  const adjuntos: AdjuntoMetadata[] = [];
  const adjuntosPreSubidosRaw = formData.get("adjuntosPreSubidos");
  if (adjuntosPreSubidosRaw && typeof adjuntosPreSubidosRaw === "string") {
    try {
      const parsed = JSON.parse(adjuntosPreSubidosRaw) as AdjuntoMetadata[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.path === "string") adjuntos.push(item);
        }
      }
    } catch {
      // ignorar JSON malformado
    }
  }

  const archivoUnico = formData.get("archivo") as File | null;
  const archivosMultiples = formData.getAll("archivos") as File[];
  const todosArchivos = [
    ...(archivoUnico && archivoUnico.size > 0 ? [archivoUnico] : []),
    ...archivosMultiples.filter((f) => f && f.size > 0),
  ];

  for (const arch of todosArchivos) {
    const subida = await subirAdjunto(supabase, arch, "federacion");
    if ("error" in subida) return { error: subida.error };
    adjuntos.push(subida.meta);
  }

  // Si es un ENVÍO PROGRAMADO
  if (scheduledFor) {
    const valFecha = validarFechaProgramada(scheduledFor);
    if (!valFecha.ok) return { error: valFecha.error };

    const seleccionGuardar: DestinatariosSeleccion = {
      todosClubes: clubesSeleccionados.includes("*"),
      todosArbitros: arbitrosSeleccionados.includes("*"),
      clubes: clubesSeleccionados.filter((id) => id !== "*"),
      arbitros: arbitrosSeleccionados.filter((id) => id !== "*"),
    };

    const { error: errorProg } = await supabase.from("scheduled_messages").insert({
      author_id: user.id,
      asunto,
      cuerpo_html: cuerpoHtml,
      categoria,
      prioridad,
      sin_respuestas: sinRespuestas,
      destinatarios: seleccionGuardar,
      adjuntos,
      scheduled_for: valFecha.fecha!.toISOString(),
      timezone: "America/Argentina/Ushuaia",
      estado: "pendiente",
    });

    if (errorProg) {
      return { error: "No se pudo programar el envío. Verificá que la tabla scheduled_messages esté creada." };
    }

    if (borradorId) {
      await supabase.from("message_drafts").delete().eq("id", borradorId);
    }

    revalidarMensajeria();
    return {
      ok: true,
      programado: true,
      scheduledFor: valFecha.fecha!.toISOString(),
      enviados: destinatarios.length,
    };
  }

  // ENVÍO INMEDIATO
  const resultado = await despacharComunicadoInterno({
    supabase,
    senderId: user.id,
    asunto,
    cuerpoHtml,
    sinRespuestas,
    prioridad,
    categoria,
    adjuntos,
    destinatarios,
    idempotencyKey,
  });

  if (borradorId) {
    await supabase.from("message_drafts").delete().eq("id", borradorId);
  }

  revalidarMensajeria();

  if (resultado.fallidos.length) {
    return {
      error: `Se envió a ${resultado.enviados} destinatarios, pero falló con: ${resultado.fallidos.join(", ")}.`,
    };
  }
  return {
    ok: true,
    enviados: resultado.enviados,
    emailsRegistrados: resultado.emailsRegistrados,
  };
}

// ---------- BORRADORES AUTOMÁTICOS Y MANUALES (message_drafts) ----------

export async function obtenerBorradoresAdmin(): Promise<BorradorComunicado[]> {
  const { supabase, user } = await requerirAdmin();

  const { data, error } = await supabase
    .from("message_drafts")
    .select("*")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    asunto: String(row.asunto ?? ""),
    cuerpo_html: String(row.cuerpo_html ?? ""),
    categoria: String(row.categoria ?? "Institucional"),
    prioridad: esPrioridadValida(row.prioridad) ? row.prioridad : "normal",
    sin_respuestas: Boolean(row.sin_respuestas),
    destinatarios: (row.destinatarios as DestinatariosSeleccion) ?? {
      todosClubes: false,
      todosArbitros: false,
      clubes: [],
      arbitros: [],
    },
    adjuntos: Array.isArray(row.adjuntos) ? (row.adjuntos as AdjuntoMetadata[]) : [],
    es_autoguardado: Boolean(row.es_autoguardado),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function guardarBorradorAdmin(input: {
  id?: string;
  asunto: string;
  cuerpoHtml: string;
  categoria: string;
  prioridad: PrioridadMensaje;
  sinRespuestas: boolean;
  destinatarios: DestinatariosSeleccion;
  adjuntos?: AdjuntoMetadata[];
  esAutoguardado?: boolean;
}): Promise<{ ok: boolean; borrador?: BorradorComunicado; error?: string }> {
  try {
    const { supabase, user } = await requerirAdmin();

    const ahora = new Date().toISOString();
    const payload = {
      author_id: user.id,
      asunto: input.asunto.trim().slice(0, 120),
      cuerpo_html: sanitizarHtml(input.cuerpoHtml).slice(0, LARGO_MAX_CUERPO_HTML),
      categoria: input.categoria || "Institucional",
      prioridad: esPrioridadValida(input.prioridad) ? input.prioridad : "normal",
      sin_respuestas: Boolean(input.sinRespuestas),
      destinatarios: input.destinatarios,
      adjuntos: input.adjuntos ?? [],
      es_autoguardado: Boolean(input.esAutoguardado),
      updated_at: ahora,
    };

    let targetId = input.id;

    // Si es autoguardado sin id previo, reutilizar el último autoguardado del autor para no duplicar filas
    if (!targetId && input.esAutoguardado) {
      const { data: existente } = await supabase
        .from("message_drafts")
        .select("id")
        .eq("author_id", user.id)
        .eq("es_autoguardado", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existente?.id) targetId = existente.id as string;
    }

    const query = targetId
      ? supabase
          .from("message_drafts")
          .update(payload)
          .eq("id", targetId)
          .eq("author_id", user.id)
          .select("*")
          .single()
      : supabase.from("message_drafts").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error || !data) {
      return { ok: false, error: "No se pudo guardar el borrador." };
    }

    return {
      ok: true,
      borrador: {
        id: data.id as string,
        asunto: String(data.asunto ?? ""),
        cuerpo_html: String(data.cuerpo_html ?? ""),
        categoria: String(data.categoria ?? "Institucional"),
        prioridad: esPrioridadValida(data.prioridad) ? data.prioridad : "normal",
        sin_respuestas: Boolean(data.sin_respuestas),
        destinatarios: (data.destinatarios as DestinatariosSeleccion) ?? input.destinatarios,
        adjuntos: Array.isArray(data.adjuntos) ? (data.adjuntos as AdjuntoMetadata[]) : [],
        es_autoguardado: Boolean(data.es_autoguardado),
        created_at: String(data.created_at),
        updated_at: String(data.updated_at),
      },
    };
  } catch {
    return { ok: false, error: "Error al guardar el borrador." };
  }
}

export async function eliminarBorradorAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();
  const { error } = await supabase
    .from("message_drafts")
    .delete()
    .eq("id", id)
    .eq("author_id", user.id);

  if (error) return { ok: false, error: "No se pudo eliminar el borrador." };
  revalidarMensajeria();
  return { ok: true };
}

// ---------- PLANTILLAS PREDISEÑADAS (message_templates) ----------

export async function obtenerPlantillasAdmin(): Promise<PlantillaMensaje[]> {
  const { supabase } = await requerirAdmin();

  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    nombre: String(row.nombre ?? ""),
    categoria: String(row.categoria ?? "Institucional"),
    asunto_sugerido: String(row.asunto_sugerido ?? ""),
    cuerpo_html: String(row.cuerpo_html ?? ""),
    prioridad_sugerida: esPrioridadValida(row.prioridad_sugerida)
      ? row.prioridad_sugerida
      : "normal",
    sin_respuestas_default: Boolean(row.sin_respuestas_default),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }));
}

export async function guardarPlantillaAdmin(input: {
  id?: string;
  nombre: string;
  categoria: string;
  asuntoSugerido: string;
  cuerpoHtml: string;
  prioridadSugerida: PrioridadMensaje;
  sinRespuestasDefault: boolean;
}): Promise<{ ok: boolean; plantilla?: PlantillaMensaje; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const nombre = input.nombre.trim();
  if (nombre.length < 3) {
    return { ok: false, error: "El nombre de la plantilla debe tener al menos 3 caracteres." };
  }
  const cuerpoLimpio = sanitizarHtml(input.cuerpoHtml).slice(0, LARGO_MAX_CUERPO_HTML);
  if (!textoPlanoDeHtml(cuerpoLimpio, 10).trim()) {
    return { ok: false, error: "La plantilla debe tener contenido en el cuerpo." };
  }

  const payload = {
    nombre,
    categoria: input.categoria || "Institucional",
    asunto_sugerido: input.asuntoSugerido.trim().slice(0, 120),
    cuerpo_html: cuerpoLimpio,
    prioridad_sugerida: esPrioridadValida(input.prioridadSugerida)
      ? input.prioridadSugerida
      : "normal",
    sin_respuestas_default: Boolean(input.sinRespuestasDefault),
    updated_at: new Date().toISOString(),
  };

  const query = input.id
    ? supabase.from("message_templates").update(payload).eq("id", input.id).select("*").single()
    : supabase
        .from("message_templates")
        .insert({ ...payload, created_by: user.id })
        .select("*")
        .single();

  const { data, error } = await query;
  if (error || !data) {
    return { ok: false, error: "No se pudo guardar la plantilla." };
  }

  return {
    ok: true,
    plantilla: {
      id: data.id as string,
      nombre: String(data.nombre),
      categoria: String(data.categoria),
      asunto_sugerido: String(data.asunto_sugerido),
      cuerpo_html: String(data.cuerpo_html),
      prioridad_sugerida: esPrioridadValida(data.prioridad_sugerida)
        ? data.prioridad_sugerida
        : "normal",
      sin_respuestas_default: Boolean(data.sin_respuestas_default),
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    },
  };
}

export async function eliminarPlantillaAdmin(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requerirAdmin();
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) return { ok: false, error: "No se pudo eliminar la plantilla." };
  return { ok: true };
}

// ---------- PROGRAMACIÓN DE ENVÍOS (scheduled_messages) ----------

async function procesarComunicadosProgramadosSilencioso(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  fallbackSenderId: string
) {
  try {
    const ahoraIso = new Date().toISOString();
    const { data: vencidos } = await supabase
      .from("scheduled_messages")
      .select("*")
      .eq("estado", "pendiente")
      .lte("scheduled_for", ahoraIso)
      .limit(20);

    if (!vencidos || !vencidos.length) return;

    for (const item of vencidos) {
      const destRaw = item.destinatarios as Record<string, unknown> | null;
      if (destRaw?.tipo === "federacion" && typeof destRaw.club_id === "string") {
        // Mensaje programado del club hacia la federación
        const conversacion = await obtenerOCrearConversacion(destRaw.club_id);
        const adjuntos = Array.isArray(item.adjuntos) ? (item.adjuntos as AdjuntoMetadata[]) : [];
        const principal = adjuntos[0] ?? null;
        const anuncioId = crypto.randomUUID();
        const metadata = {
          tipo: TIPO_COMUNICADO,
          asunto: String(item.asunto),
          sin_respuestas: false,
          html: true,
          anuncio_id: anuncioId,
          prioridad: esPrioridadValida(item.prioridad) ? item.prioridad : "normal",
          categoria: String(item.categoria ?? "Institucional"),
          adjuntos,
          origen: "club",
          idempotency_key: `sched-${item.id}`,
        };

        const admin = createLfsAdminClient();
        await admin.from("messages").insert({
          conversation_id: conversacion.id,
          sender_id: item.author_id,
          body: String(item.cuerpo_html),
          attachment_path: principal?.path ?? null,
          attachment_name: principal?.name ?? null,
          attachment_type: principal?.type ?? null,
          metadata,
        });

        await supabase
          .from("scheduled_messages")
          .update({
            estado: "enviado",
            anuncio_id: anuncioId,
            enviado_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        continue;
      }

      const sel = (item.destinatarios as DestinatariosSeleccion) ?? {
        todosClubes: false,
        todosArbitros: false,
        clubes: [],
        arbitros: [],
      };
      const clubesIds = sel.todosClubes ? ["*"] : sel.clubes ?? [];
      const arbitrosIds = sel.todosArbitros ? ["*"] : sel.arbitros ?? [];

      const destinatarios = await resolverDestinatarios(supabase, clubesIds, arbitrosIds);
      if (!destinatarios.length) {
        await supabase
          .from("scheduled_messages")
          .update({
            estado: "error",
            error_detalle: "Sin destinatarios válidos al momento del envío.",
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        continue;
      }

      const resultado = await despacharComunicadoInterno({
        supabase,
        senderId: (item.author_id as string) || fallbackSenderId,
        asunto: String(item.asunto),
        cuerpoHtml: String(item.cuerpo_html),
        sinRespuestas: Boolean(item.sin_respuestas),
        prioridad: esPrioridadValida(item.prioridad) ? item.prioridad : "normal",
        categoria: String(item.categoria ?? "Institucional"),
        adjuntos: Array.isArray(item.adjuntos) ? (item.adjuntos as AdjuntoMetadata[]) : [],
        destinatarios,
        idempotencyKey: `sched-${item.id}`,
      });

      await supabase
        .from("scheduled_messages")
        .update({
          estado: "enviado",
          anuncio_id: resultado.anuncioId,
          enviado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  } catch {
    // silencioso si la tabla aún no existe o hay error transitorio
  }
}

export async function obtenerComunicadosProgramadosAdmin(): Promise<ComunicadoProgramado[]> {
  const { supabase, user } = await requerirAdmin();

  await procesarComunicadosProgramadosSilencioso(supabase, user.id);

  const { data, error } = await supabase
    .from("scheduled_messages")
    .select("*")
    .order("scheduled_for", { ascending: true })
    .limit(100);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    asunto: String(row.asunto ?? ""),
    cuerpo_html: String(row.cuerpo_html ?? ""),
    categoria: String(row.categoria ?? "Institucional"),
    prioridad: esPrioridadValida(row.prioridad) ? row.prioridad : "normal",
    sin_respuestas: Boolean(row.sin_respuestas),
    destinatarios: (row.destinatarios as DestinatariosSeleccion) ?? {
      todosClubes: false,
      todosArbitros: false,
      clubes: [],
      arbitros: [],
    },
    adjuntos: Array.isArray(row.adjuntos) ? (row.adjuntos as AdjuntoMetadata[]) : [],
    scheduled_for: String(row.scheduled_for),
    timezone: String(row.timezone ?? "America/Argentina/Ushuaia"),
    estado: (row.estado as ComunicadoProgramado["estado"]) ?? "pendiente",
    anuncio_id: (row.anuncio_id as string | null) ?? null,
    enviado_at: (row.enviado_at as string | null) ?? null,
    error_detalle: (row.error_detalle as string | null) ?? null,
    created_at: String(row.created_at),
  }));
}

export async function cancelarComunicadoProgramadoAdmin(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requerirAdmin();
  const { error } = await supabase
    .from("scheduled_messages")
    .update({ estado: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { ok: false, error: "No se pudo cancelar el envío programado." };
  revalidarMensajeria();
  return { ok: true };
}

export async function reprogramarComunicadoAdmin(
  id: string,
  nuevaFechaIso: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requerirAdmin();
  const val = validarFechaProgramada(nuevaFechaIso);
  if (!val.ok) return { ok: false, error: val.error };

  const { error } = await supabase
    .from("scheduled_messages")
    .update({
      scheduled_for: val.fecha!.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("estado", "pendiente");

  if (error) return { ok: false, error: "No se pudo reprogramar el envío." };
  revalidarMensajeria();
  return { ok: true };
}

export async function enviarAhoraComunicadoProgramadoAdmin(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { data: item } = await supabase
    .from("scheduled_messages")
    .select("*")
    .eq("id", id)
    .eq("estado", "pendiente")
    .maybeSingle();

  if (!item) return { ok: false, error: "El mensaje programado ya no está pendiente." };

  await supabase
    .from("scheduled_messages")
    .update({ scheduled_for: new Date(Date.now() - 5000).toISOString() })
    .eq("id", id);

  await procesarComunicadosProgramadosSilencioso(supabase, user.id);
  revalidarMensajeria();
  return { ok: true };
}

/**
 * Marca como leídos todos los mensajes de la conversación
 * que NO envió el usuario actual. Alimenta el doble tilde del otro lado.
 */
export async function marcarLeidos(conversacionId: string) {
  const { supabase, user } = await obtenerUsuarioOError();

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversacionId)
    .is("read_at", null)
    .neq("sender_id", user.id);
}

/**
 * Genera una URL firmada temporal (1 hora) para ver o descargar un adjunto.
 * El RLS del bucket mensajeria-adjuntos valida que el usuario tenga permiso.
 */
export async function obtenerUrlAdjunto(ruta: string) {
  const { supabase } = await obtenerUsuarioOError();

  let { data, error } = await supabase.storage
    .from("mensajeria-adjuntos")
    .createSignedUrl(ruta, 60 * 60);

  if (error || !data?.signedUrl) {
    try {
      const admin = createLfsAdminClient();
      const resAdmin = await admin.storage
        .from("mensajeria-adjuntos")
        .createSignedUrl(ruta, 60 * 60);
      data = resAdmin.data;
      error = resAdmin.error;
    } catch {
      // mantener error original
    }
  }

  if (error || !data?.signedUrl) {
    return { error: "No se pudo abrir el archivo adjunto." };
  }
  return { url: data.signedUrl };
}

// =============================================================================
// MENSAJERÍA DESDE LOS CLUBES HACIA LA FEDERACIÓN (Módulo Premium de Club)
// Todo lo que tiene la administración (texto enriquecido, 10 tipografías, adjuntos,
// borradores, plantillas, programación) EXCEPTO la opción de desactivar respuestas.
// =============================================================================

async function obtenerClubUsuario() {
  const { supabase, user } = await obtenerUsuarioOError();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id && profile?.role !== "admin") {
    throw new Error("Tu usuario no está vinculado a ningún club.");
  }

  const clubId = profile?.club_id;
  return { supabase, user, clubId: clubId ?? "", role: profile?.role ?? "club" };
}

/**
 * Permite a un club subir un archivo adjunto validado (hasta 10 MB) en su propia carpeta.
 */
export async function subirAdjuntoClubAction(formData: FormData) {
  const { supabase, clubId } = await obtenerClubUsuario();
  if (!clubId) return { error: "No tenés un club asignado." };
  const archivo = formData.get("archivo") as File | null;
  if (!archivo || archivo.size === 0) {
    return { error: "Seleccioná un archivo válido." };
  }
  const res = await subirAdjunto(supabase, archivo, clubId);
  if ("error" in res) return { error: res.error };
  return { ok: true, adjunto: res.meta };
}

/**
 * Envía un mensaje/nota oficial del club hacia la Federación LFS con formato enriquecido,
 * asunto, categoría y adjuntos (o lo programa a futuro). Siempre acepta respuestas.
 */
export async function enviarMensajeClub(formData: FormData) {
  const { supabase, user, clubId } = await obtenerClubUsuario();
  if (!clubId) return { error: "No tenés un club asignado para enviar mensajes oficiales." };

  const asunto = String(formData.get("asunto") ?? "").trim();
  const cuerpoCrudo = String(formData.get("cuerpoHtml") ?? "");
  const prioridadCruda = String(formData.get("prioridad") ?? "normal");
  const prioridad: PrioridadMensaje = esPrioridadValida(prioridadCruda) ? prioridadCruda : "normal";
  const categoria = String(formData.get("categoria") ?? "Institucional").trim() || "Institucional";
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim() || undefined;
  const borradorId = String(formData.get("borradorId") ?? "").trim() || undefined;
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim() || undefined;

  const asuntoValido = validarAsunto(asunto);
  if (!asuntoValido.ok) return { error: asuntoValido.error };
  const cuerpoValido = validarCuerpoHtml(cuerpoCrudo);
  if (!cuerpoValido.ok) return { error: cuerpoValido.error };

  const cuerpoHtml = sanitizarHtml(cuerpoCrudo).slice(0, LARGO_MAX_CUERPO_HTML);

  // Prevención de envíos duplicados por idempotencyKey
  if (idempotencyKey && !scheduledFor) {
    const { data: duplicado } = await supabase
      .from("messages")
      .select("id")
      .eq("metadata->>idempotency_key", idempotencyKey)
      .limit(1)
      .maybeSingle();
    if (duplicado) {
      return { ok: true, enviados: 1, duplicadoEvitado: true };
    }
  }

  // Procesar adjuntos
  const adjuntos: AdjuntoMetadata[] = [];
  const adjuntosPreSubidosRaw = formData.get("adjuntosPreSubidos");
  if (adjuntosPreSubidosRaw && typeof adjuntosPreSubidosRaw === "string") {
    try {
      const parsed = JSON.parse(adjuntosPreSubidosRaw) as AdjuntoMetadata[];
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.path === "string") adjuntos.push(item);
        }
      }
    } catch {
      // ignorar JSON malformado
    }
  }

  const archivoUnico = formData.get("archivo") as File | null;
  const archivosMultiples = formData.getAll("archivos") as File[];
  const todosArchivos = [
    ...(archivoUnico && archivoUnico.size > 0 ? [archivoUnico] : []),
    ...archivosMultiples.filter((f) => f && f.size > 0),
  ];

  for (const arch of todosArchivos) {
    const subida = await subirAdjunto(supabase, arch, clubId);
    if ("error" in subida) return { error: subida.error };
    adjuntos.push(subida.meta);
  }

  // 1. Si es envío programado
  if (scheduledFor) {
    const valFecha = validarFechaProgramada(scheduledFor);
    if (!valFecha.ok) return { error: valFecha.error };

    const { error: errorProg } = await supabase.from("scheduled_messages").insert({
      author_id: user.id,
      asunto,
      cuerpo_html: cuerpoHtml,
      categoria,
      prioridad,
      sin_respuestas: false, // Los clubes SIEMPRE admiten respuestas
      destinatarios: { tipo: "federacion", club_id: clubId },
      adjuntos,
      scheduled_for: valFecha.fecha!.toISOString(),
      timezone: "America/Argentina/Ushuaia",
      estado: "pendiente",
    });

    if (errorProg) {
      const admin = createLfsAdminClient();
      await admin.from("scheduled_messages").insert({
        author_id: user.id,
        asunto,
        cuerpo_html: cuerpoHtml,
        categoria,
        prioridad,
        sin_respuestas: false,
        destinatarios: { tipo: "federacion", club_id: clubId },
        adjuntos,
        scheduled_for: valFecha.fecha!.toISOString(),
        timezone: "America/Argentina/Ushuaia",
        estado: "pendiente",
      });
    }

    if (borradorId) {
      await supabase.from("message_drafts").delete().eq("id", borradorId).eq("author_id", user.id);
    }

    revalidarMensajeria();
    return { ok: true, programado: true };
  }

  // 2. Envío inmediato
  const conversacion = await obtenerOCrearConversacion(clubId);
  const principal = adjuntos[0] ?? null;
  const metadata = {
    tipo: TIPO_COMUNICADO,
    asunto,
    sin_respuestas: false,
    html: true,
    anuncio_id: crypto.randomUUID(),
    prioridad,
    categoria,
    adjuntos,
    origen: "club",
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };

  let { data: mensaje, error: errorMensaje } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversacion.id,
      sender_id: user.id,
      body: cuerpoHtml,
      attachment_path: principal?.path ?? null,
      attachment_name: principal?.name ?? null,
      attachment_type: principal?.type ?? null,
      metadata,
    })
    .select(SELECT_MENSAJE)
    .single();

  if (errorMensaje) {
    const admin = createLfsAdminClient();
    const resAdmin = await admin
      .from("messages")
      .insert({
        conversation_id: conversacion.id,
        sender_id: user.id,
        body: cuerpoHtml,
        attachment_path: principal?.path ?? null,
        attachment_name: principal?.name ?? null,
        attachment_type: principal?.type ?? null,
        metadata,
      })
      .select(SELECT_MENSAJE)
      .single();

    if (resAdmin.error || !resAdmin.data) {
      return { error: resAdmin.error?.message ?? "No se pudo enviar el mensaje a la federación." };
    }
    mensaje = resAdmin.data;
  }

  // Actualizar last_message_at en la conversación
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversacion.id);

  // Notificar por correo a los administradores de la federación
  const { data: admins } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "admin");

  if (admins?.length) {
    const { data: clubData } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .maybeSingle();

    const nombreClub = clubData?.name ?? "Club Afiliado";
    const prefijo = prioridad === "urgente" ? "🚨 [URGENTE] " : prioridad === "importante" ? "⚠️ [IMPORTANTE] " : "📨 ";

    const filasEmail = admins
      .filter((a) => !!a.email)
      .map((a) => ({
        profile_id: a.id,
        email: a.email as string,
        asunto: `${prefijo}Nuevo mensaje de ${nombreClub}: ${asunto}`,
        cuerpo_html: cuerpoHtml,
        tipo: "mensaje_club",
      }));

    if (filasEmail.length) {
      await supabase.from("email_notifications").insert(filasEmail);
    }
  }

  if (borradorId) {
    await supabase.from("message_drafts").delete().eq("id", borradorId).eq("author_id", user.id);
  }

  revalidarMensajeria();
  return { ok: true, mensaje, enviados: 1 };
}

/**
 * Guarda o actualiza un borrador de mensaje del club (automático o manual).
 */
export async function guardarBorradorClub(input: {
  id?: string;
  asunto: string;
  cuerpoHtml: string;
  categoria: string;
  prioridad: PrioridadMensaje;
  destinatarios?: DestinatariosSeleccion;
  adjuntos?: AdjuntoMetadata[];
  esAutoguardado?: boolean;
}): Promise<{ ok: boolean; borrador?: BorradorComunicado; error?: string }> {
  try {
    const { supabase, user, clubId } = await obtenerClubUsuario();

    const ahora = new Date().toISOString();
    const payload = {
      author_id: user.id,
      asunto: input.asunto.trim().slice(0, 120),
      cuerpo_html: sanitizarHtml(input.cuerpoHtml).slice(0, LARGO_MAX_CUERPO_HTML),
      categoria: input.categoria || "Institucional",
      prioridad: esPrioridadValida(input.prioridad) ? input.prioridad : "normal",
      sin_respuestas: false,
      destinatarios: { tipo: "federacion", club_id: clubId },
      adjuntos: input.adjuntos ?? [],
      es_autoguardado: Boolean(input.esAutoguardado),
      updated_at: ahora,
    };

    let targetId = input.id;

    if (!targetId && input.esAutoguardado) {
      const { data: existente } = await supabase
        .from("message_drafts")
        .select("id")
        .eq("author_id", user.id)
        .eq("es_autoguardado", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existente?.id) targetId = existente.id as string;
    }

    const admin = createLfsAdminClient();
    const query = targetId
      ? admin
          .from("message_drafts")
          .update(payload)
          .eq("id", targetId)
          .eq("author_id", user.id)
          .select("*")
          .single()
      : admin.from("message_drafts").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error || !data) {
      return { ok: false, error: "No se pudo guardar el borrador." };
    }

    return {
      ok: true,
      borrador: {
        id: data.id as string,
        asunto: String(data.asunto ?? ""),
        cuerpo_html: String(data.cuerpo_html ?? ""),
        categoria: String(data.categoria ?? "Institucional"),
        prioridad: esPrioridadValida(data.prioridad) ? data.prioridad : "normal",
        sin_respuestas: false,
        destinatarios: { todosClubes: false, todosArbitros: false, clubes: [], arbitros: [] },
        adjuntos: Array.isArray(data.adjuntos) ? (data.adjuntos as AdjuntoMetadata[]) : [],
        es_autoguardado: Boolean(data.es_autoguardado),
        created_at: String(data.created_at),
        updated_at: String(data.updated_at),
      },
    };
  } catch {
    return { ok: false, error: "Error al guardar el borrador." };
  }
}

/**
 * Obtiene los borradores activos guardados por el club.
 */
export async function obtenerBorradoresClub(): Promise<BorradorComunicado[]> {
  try {
    const { supabase, user } = await obtenerClubUsuario();

    const admin = createLfsAdminClient();
    const { data, error } = await admin
      .from("message_drafts")
      .select("*")
      .eq("author_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      asunto: String(row.asunto ?? ""),
      cuerpo_html: String(row.cuerpo_html ?? ""),
      categoria: String(row.categoria ?? "Institucional"),
      prioridad: esPrioridadValida(row.prioridad) ? row.prioridad : "normal",
      sin_respuestas: false,
      destinatarios: { todosClubes: false, todosArbitros: false, clubes: [], arbitros: [] },
      adjuntos: Array.isArray(row.adjuntos) ? (row.adjuntos as AdjuntoMetadata[]) : [],
      es_autoguardado: Boolean(row.es_autoguardado),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Elimina un borrador guardado por el club.
 */
export async function eliminarBorradorClub(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();
    const { error } = await admin
      .from("message_drafts")
      .delete()
      .eq("id", id)
      .eq("author_id", user.id);

    if (error) return { ok: false, error: "No se pudo eliminar el borrador." };
    revalidarMensajeria();
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al eliminar el borrador." };
  }
}

/**
 * Obtiene las plantillas disponibles para el club (creadas por el club o generales).
 */
export async function obtenerPlantillasClub(): Promise<PlantillaMensaje[]> {
  try {
    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();
    const { data, error } = await admin
      .from("message_templates")
      .select("*")
      .or(`created_by.eq.${user.id},created_by.is.null`)
      .order("categoria", { ascending: true })
      .order("nombre", { ascending: true });

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      nombre: String(row.nombre ?? ""),
      categoria: String(row.categoria ?? "Institucional"),
      asunto_sugerido: String(row.asunto_sugerido ?? ""),
      cuerpo_html: String(row.cuerpo_html ?? ""),
      prioridad_sugerida: esPrioridadValida(row.prioridad_sugerida)
        ? row.prioridad_sugerida
        : "normal",
      sin_respuestas_default: false,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Guarda o actualiza una plantilla creada por el club.
 */
export async function guardarPlantillaClub(input: {
  id?: string;
  nombre: string;
  categoria: string;
  asuntoSugerido: string;
  cuerpoHtml: string;
  prioridadSugerida: PrioridadMensaje;
}): Promise<{ ok: boolean; plantilla?: PlantillaMensaje; error?: string }> {
  try {
    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();

    const payload = {
      nombre: input.nombre.trim().slice(0, 100),
      categoria: input.categoria.trim() || "Institucional",
      asunto_sugerido: input.asuntoSugerido.trim().slice(0, 120),
      cuerpo_html: sanitizarHtml(input.cuerpoHtml).slice(0, LARGO_MAX_CUERPO_HTML),
      prioridad_sugerida: esPrioridadValida(input.prioridadSugerida)
        ? input.prioridadSugerida
        : "normal",
      sin_respuestas_default: false,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const query = input.id
      ? admin
          .from("message_templates")
          .update(payload)
          .eq("id", input.id)
          .eq("created_by", user.id)
          .select("*")
          .single()
      : admin.from("message_templates").insert(payload).select("*").single();

    const { data, error } = await query;
    if (error || !data) return { ok: false, error: "No se pudo guardar la plantilla." };

    return {
      ok: true,
      plantilla: {
        id: data.id as string,
        nombre: String(data.nombre ?? ""),
        categoria: String(data.categoria ?? "Institucional"),
        asunto_sugerido: String(data.asunto_sugerido ?? ""),
        cuerpo_html: String(data.cuerpo_html ?? ""),
        prioridad_sugerida: esPrioridadValida(data.prioridad_sugerida)
          ? data.prioridad_sugerida
          : "normal",
        sin_respuestas_default: false,
        created_at: String(data.created_at),
        updated_at: String(data.updated_at),
      },
    };
  } catch {
    return { ok: false, error: "Error al guardar la plantilla." };
  }
}

/**
 * Elimina una plantilla del club.
 */
export async function eliminarPlantillaClub(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();
    const { error } = await admin
      .from("message_templates")
      .delete()
      .eq("id", id)
      .eq("created_by", user.id);

    if (error) return { ok: false, error: "No se pudo eliminar la plantilla." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al eliminar la plantilla." };
  }
}

/**
 * Obtiene los mensajes programados pendientes del club.
 */
export async function obtenerComunicadosProgramadosClub(): Promise<ComunicadoProgramado[]> {
  try {
    const { supabase, user } = await obtenerClubUsuario();

    await procesarComunicadosProgramadosSilencioso(supabase, user.id);

    const admin = createLfsAdminClient();
    const { data, error } = await admin
      .from("scheduled_messages")
      .select("*")
      .eq("author_id", user.id)
      .order("scheduled_for", { ascending: true })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => ({
      id: row.id as string,
      asunto: String(row.asunto ?? ""),
      cuerpo_html: String(row.cuerpo_html ?? ""),
      categoria: String(row.categoria ?? "Institucional"),
      prioridad: esPrioridadValida(row.prioridad) ? row.prioridad : "normal",
      sin_respuestas: false,
      destinatarios: { todosClubes: false, todosArbitros: false, clubes: [], arbitros: [] },
      adjuntos: Array.isArray(row.adjuntos) ? (row.adjuntos as AdjuntoMetadata[]) : [],
      scheduled_for: String(row.scheduled_for),
      timezone: String(row.timezone ?? "America/Argentina/Ushuaia"),
      estado: (row.estado as ComunicadoProgramado["estado"]) ?? "pendiente",
      anuncio_id: (row.anuncio_id as string | null) ?? null,
      enviado_at: (row.enviado_at as string | null) ?? null,
      error_detalle: (row.error_detalle as string | null) ?? null,
      created_at: String(row.created_at),
    }));
  } catch {
    return [];
  }
}

/**
 * Cancela un mensaje programado del club.
 */
export async function cancelarComunicadoProgramadoClub(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();
    const { error } = await admin
      .from("scheduled_messages")
      .update({ estado: "cancelado", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("estado", "pendiente");

    if (error) return { ok: false, error: "No se pudo cancelar el mensaje programado." };
    revalidarMensajeria();
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al cancelar el mensaje programado." };
  }
}

/**
 * Reprograma un mensaje programado del club.
 */
export async function reprogramarComunicadoClub(
  id: string,
  nuevaFechaIso: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const val = validarFechaProgramada(nuevaFechaIso);
    if (!val.ok) return { ok: false, error: val.error };

    const { user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();
    const { error } = await admin
      .from("scheduled_messages")
      .update({
        scheduled_for: val.fecha!.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("estado", "pendiente");

    if (error) return { ok: false, error: "No se pudo reprogramar el mensaje." };
    revalidarMensajeria();
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al reprogramar el mensaje." };
  }
}

/**
 * Fuerza el envío inmediato de un mensaje programado del club.
 */
export async function enviarAhoraComunicadoProgramadoClub(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, user } = await obtenerClubUsuario();
    const admin = createLfsAdminClient();

    const { data: item } = await admin
      .from("scheduled_messages")
      .select("*")
      .eq("id", id)
      .eq("author_id", user.id)
      .eq("estado", "pendiente")
      .maybeSingle();

    if (!item) return { ok: false, error: "El mensaje programado ya no está pendiente." };

    await admin
      .from("scheduled_messages")
      .update({ scheduled_for: new Date(Date.now() - 5000).toISOString() })
      .eq("id", id);

    await procesarComunicadosProgramadosSilencioso(supabase, user.id);
    revalidarMensajeria();
    return { ok: true };
  } catch {
    return { ok: false, error: "Error al forzar el envío." };
  }
}
