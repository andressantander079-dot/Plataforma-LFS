"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  sanitizarHtml,
  textoPlanoDeHtml,
  validarAsunto,
  validarCuerpoHtml,
  bloqueaRespuestas,
  TIPO_COMUNICADO,
  LARGO_MAX_CUERPO_HTML,
} from "@/lib/core/rules/mensajeriaRules";

/**
 * MENSAJERÍA LFS — Acciones de servidor
 * Chat privado Federación (admin) ↔ cada club y cada árbitro, en tiempo real.
 * Comunicados oficiales con asunto, editor enriquecido y difusión masiva.
 * La seguridad la garantiza el RLS de Supabase: cada rol solo ve lo suyo.
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
}

export interface LecturaComunicado {
  nombre: string;
  tipoDestino: TipoDestino;
  leido: boolean;
  leidoAt: string | null;
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
 * La puede llamar el admin (para cualquier club) o el club (solo la suya,
 * garantizado por RLS).
 */
export async function obtenerOCrearConversacion(clubId: string): Promise<Conversacion> {
  const { supabase } = await obtenerUsuarioOError();

  const { data: existente } = await supabase
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("club_id", clubId)
    .maybeSingle();

  if (existente) return existente as Conversacion;

  const { data: creada, error } = await supabase
    .from("conversations")
    .insert({ club_id: clubId })
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .single();

  if (error) {
    // Carrera: otro la creó justo antes → la volvemos a leer
    const { data: relectura } = await supabase
      .from("conversations")
      .select("id, club_id, arbitro_id, created_at, last_message_at")
      .eq("club_id", clubId)
      .single();
    if (relectura) return relectura as Conversacion;
    throw new Error("No se pudo crear la conversación.");
  }

  return creada as Conversacion;
}

/** Conversación individual de un árbitro; si no existe, la crea. */
export async function obtenerOCrearConversacionArbitro(arbitroId: string): Promise<Conversacion> {
  const { supabase } = await obtenerUsuarioOError();

  const { data: existente } = await supabase
    .from("conversations")
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .eq("arbitro_id", arbitroId)
    .maybeSingle();

  if (existente) return existente as Conversacion;

  const { data: creada, error } = await supabase
    .from("conversations")
    .insert({ arbitro_id: arbitroId })
    .select("id, club_id, arbitro_id, created_at, last_message_at")
    .single();

  if (error) {
    const { data: relectura } = await supabase
      .from("conversations")
      .select("id, club_id, arbitro_id, created_at, last_message_at")
      .eq("arbitro_id", arbitroId)
      .single();
    if (relectura) return relectura as Conversacion;
    throw new Error("No se pudo crear la conversación.");
  }

  return creada as Conversacion;
}

/** Club del usuario logueado (rol club). */
export async function obtenerMiClubId(): Promise<{ clubId: string; clubNombre: string }> {
  const { supabase, user } = await obtenerUsuarioOError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) throw new Error("Tu usuario no está vinculado a ningún club.");

  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", profile.club_id)
    .single();

  return { clubId: profile.club_id, clubNombre: club?.name ?? "Mi Club" };
}

/** Últimos mensajes de una conversación (máx. 150), en orden cronológico. */
export async function obtenerMensajes(conversacionId: string) {
  const { supabase } = await obtenerUsuarioOError();

  const { data, error } = await supabase
    .from("messages")
    .select(SELECT_MENSAJE)
    .eq("conversation_id", conversacionId)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) throw new Error("No se pudieron cargar los mensajes.");
  return data ?? [];
}

/**
 * Buscador dentro de una conversación: mensajes cuyo texto contiene el
 * término (ignora mayúsculas). Devuelve máx. 50, del más nuevo al más viejo.
 */
export async function buscarMensajes(conversacionId: string, termino: string) {
  const { supabase } = await obtenerUsuarioOError();

  const limpio = termino.trim();
  if (limpio.length < 2) return [];

  const { data, error } = await supabase
    .from("messages")
    .select(SELECT_MENSAJE)
    .eq("conversation_id", conversacionId)
    .ilike("body", `%${limpio}%`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error("No se pudo buscar en la conversación.");
  return data ?? [];
}

/** Cantidad de mensajes sin leer dirigidos al usuario actual (para el badge). */
export async function contarNoLeidos(): Promise<number> {
  try {
    const supabase = await createLfsServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .is("read_at", null)
      .neq("sender_id", user.id);

    if (error) return 0;
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
  const { supabase } = await requerirAdmin();

  const { data, error } = await supabase
    .from("messages")
    .select("id, body, read_at, created_at, metadata")
    .eq("metadata->>tipo", TIPO_COMUNICADO)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error) throw new Error("No se pudieron cargar los comunicados.");

  const grupos = new Map<string, ComunicadoResumen>();
  for (const m of data ?? []) {
    const meta = (m.metadata ?? {}) as {
      anuncio_id?: string;
      asunto?: string;
      sin_respuestas?: boolean;
    };
    const clave = meta.anuncio_id ?? m.id;
    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.totalDestinatarios += 1;
      if (m.read_at) grupo.leidos += 1;
    } else {
      grupos.set(clave, {
        anuncioId: clave,
        asunto: meta.asunto ?? "Comunicado",
        fecha: m.created_at,
        sinRespuestas: meta.sin_respuestas === true,
        totalDestinatarios: 1,
        leidos: m.read_at ? 1 : 0,
        preview: textoPlanoDeHtml(m.body ?? "", 90),
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
    .select("read_at, conversation_id, conversations(club_id, arbitro_id)")
    .eq("metadata->>anuncio_id", anuncioId);

  if (error) throw new Error("No se pudieron cargar las lecturas.");

  const filas = (data ?? []) as unknown as Array<{
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
    };
  });

  // No leídos primero (son los que le importan a la federación)
  lecturas.sort((a, b) => Number(a.leido) - Number(b.leido) || a.nombre.localeCompare(b.nombre));
  return lecturas;
}

// ---------- Mutaciones ----------

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB (igual que el límite del bucket)

async function subirAdjunto(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  archivo: File,
  carpeta: string
) {
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
    return { error: "Solo se permiten imágenes (JPG, PNG, WebP) o PDF." } as const;
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return { error: "El archivo supera los 10 MB permitidos." } as const;
  }

  const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const ruta = `${carpeta}/${crypto.randomUUID()}-${nombreSeguro}`;

  const { error: errorSubida } = await supabase.storage
    .from("mensajeria-adjuntos")
    .upload(ruta, archivo, { contentType: archivo.type });

  if (errorSubida) {
    return { error: "No se pudo subir el archivo. Intentá de nuevo." } as const;
  }

  return { ruta } as const;
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

  // Necesitamos el participante de la conversación para la carpeta del adjunto
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

  const { data: mensaje, error: errorMensaje } = await supabase
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

  if (errorMensaje) return { error: "No se pudo enviar el mensaje." };

  revalidarMensajeria();
  return { mensaje };
}

/**
 * COMUNICADO OFICIAL — solo la federación.
 * Difunde un mensaje con asunto y formato enriquecido a uno, varios o todos
 * los clubes y árbitros. Cada destinatario recibe una copia en SU chat (con
 * el mismo anuncio_id para el reporte "quién lo leyó") y un email queda
 * registrado en el buzón de salida (email_notifications).
 */
export async function enviarComunicado(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const asunto = String(formData.get("asunto") ?? "").trim();
  const cuerpoCrudo = String(formData.get("cuerpoHtml") ?? "");
  const sinRespuestas = formData.get("sinRespuestas") === "true";
  const archivo = formData.get("archivo") as File | null;

  let clubesSeleccionados: string[] = [];
  let arbitrosSeleccionados: string[] = [];
  try {
    clubesSeleccionados = JSON.parse(String(formData.get("clubes") ?? "[]")) as string[];
    arbitrosSeleccionados = JSON.parse(String(formData.get("arbitros") ?? "[]")) as string[];
  } catch {
    return { error: "Los destinatarios llegaron con un formato inválido." };
  }

  const todosClubes = clubesSeleccionados.includes("*");
  const todosArbitros = arbitrosSeleccionados.includes("*");

  // Validaciones de negocio (reglas puras, testeadas)
  const asuntoValido = validarAsunto(asunto);
  if (!asuntoValido.ok) return { error: asuntoValido.error };
  const cuerpoValido = validarCuerpoHtml(cuerpoCrudo);
  if (!cuerpoValido.ok) return { error: cuerpoValido.error };

  const cuerpoHtml = sanitizarHtml(cuerpoCrudo).slice(0, LARGO_MAX_CUERPO_HTML);

  // Resolver destinatarios
  const destinatarios: DestinatarioComunicado[] = [];

  if (todosClubes || clubesSeleccionados.length) {
    let consulta = supabase.from("clubs").select("id, name");
    if (!todosClubes) consulta = consulta.in("id", clubesSeleccionados);
    const { data: clubes } = await consulta;
    for (const c of clubes ?? []) destinatarios.push({ tipo: "club", id: c.id, nombre: c.name });
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

  if (!destinatarios.length) {
    return { error: "Elegí al menos un destinatario." };
  }

  // Adjunto compartido: se sube una sola vez a la carpeta pública de la federación
  let attachment_path: string | null = null;
  let attachment_name: string | null = null;
  let attachment_type: string | null = null;
  if (archivo && archivo.size > 0) {
    const subida = await subirAdjunto(supabase, archivo, "federacion");
    if ("error" in subida) return { error: subida.error };
    attachment_path = subida.ruta;
    attachment_name = archivo.name;
    attachment_type = archivo.type;
  }

  const anuncioId = crypto.randomUUID();
  const metadata = {
    tipo: TIPO_COMUNICADO,
    asunto,
    sin_respuestas: sinRespuestas,
    html: true,
    anuncio_id: anuncioId,
  };

  // Difusión: una copia por conversación
  let enviados = 0;
  const fallidos: string[] = [];
  for (const destino of destinatarios) {
    try {
      const conversacion =
        destino.tipo === "club"
          ? await obtenerOCrearConversacion(destino.id)
          : await obtenerOCrearConversacionArbitro(destino.id);

      const { error } = await supabase.from("messages").insert({
        conversation_id: conversacion.id,
        sender_id: user.id,
        body: cuerpoHtml,
        attachment_path,
        attachment_name,
        attachment_type,
        metadata,
      });
      if (error) throw error;
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

  const filasEmail = [...(usuariosClubes ?? []), ...(usuariosArbitros ?? [])]
    .filter((p) => !!p.email)
    .map((p) => ({
      profile_id: p.id,
      email: p.email as string,
      asunto: `📢 ${asunto} — Liga de Fútsal de Ushuaia`,
      cuerpo_html: cuerpoHtml,
      tipo: "comunicado",
    }));

  if (filasEmail.length) {
    await supabase.from("email_notifications").insert(filasEmail);
  }

  revalidarMensajeria();

  if (fallidos.length) {
    return {
      error: `Se envió a ${enviados} destinatarios, pero falló con: ${fallidos.join(", ")}.`,
    };
  }
  return { ok: true, enviados, emailsRegistrados: filasEmail.length };
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

  revalidarMensajeria();
}

/** URL firmada (60 segundos) para ver/descargar un adjunto del chat. */
export async function obtenerUrlAdjunto(ruta: string) {
  const { supabase } = await obtenerUsuarioOError();

  const { data, error } = await supabase.storage
    .from("mensajeria-adjuntos")
    .createSignedUrl(ruta, 60);

  if (error || !data?.signedUrl) return { error: "No se pudo abrir el archivo." };
  return { url: data.signedUrl };
}
