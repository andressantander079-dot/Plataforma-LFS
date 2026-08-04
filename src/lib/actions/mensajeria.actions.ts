"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * MENSAJERÍA LFS — Acciones de servidor
 * Chat privado Federación (admin) ↔ cada club, en tiempo real.
 * La seguridad la garantiza el RLS de Supabase: cada rol solo ve lo suyo.
 */

// ---------- Tipos compartidos (se re-exportan desde los componentes) ----------

export interface ConversacionResumen {
  conversacionId: string | null; // null si el club aún no tiene chat creado
  clubId: string;
  clubNombre: string;
  ultimoMensaje: string | null;
  ultimoMensajeFecha: string | null;
  noLeidos: number;
}

export interface Conversacion {
  id: string;
  club_id: string;
  created_at: string;
  last_message_at: string | null;
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

// ---------- Consultas ----------

/**
 * Panel del ADMIN: todos los clubes con su conversación (si existe),
 * el último mensaje y la cantidad de no leídos para la federación.
 */
export async function obtenerPanelMensajeriaAdmin(): Promise<ConversacionResumen[]> {
  const { supabase, user } = await obtenerUsuarioOError();
  if (!(await esAdmin(supabase))) throw new Error("Solo la federación puede ver este panel.");

  const { data: clubes, error: errorClubes } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name");
  if (errorClubes) throw new Error("No se pudieron cargar los clubes.");

  const { data: conversaciones } = await supabase
    .from("conversations")
    .select("id, club_id, last_message_at");

  const { data: ultimos } = await supabase
    .from("messages")
    .select("conversation_id, body, attachment_name, created_at")
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
    { body: string | null; attachment_name: string | null; created_at: string }
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
    (conversaciones ?? []).map((c) => [c.club_id, c])
  );

  const resumen: ConversacionResumen[] = (clubes ?? []).map((club) => {
    const conv = conversacionPorClub.get(club.id);
    const ultimo = conv ? ultimoPorConversacion.get(conv.id) : undefined;
    const preview = ultimo
      ? ultimo.body?.trim()
        ? ultimo.body
        : ultimo.attachment_name
          ? `📎 ${ultimo.attachment_name}`
          : null
      : null;
    return {
      conversacionId: conv?.id ?? null,
      clubId: club.id,
      clubNombre: club.name,
      ultimoMensaje: preview,
      ultimoMensajeFecha: ultimo?.created_at ?? conv?.last_message_at ?? null,
      noLeidos: conv ? (noLeidosPorConversacion.get(conv.id) ?? 0) : 0,
    };
  });

  // Primero los que tienen actividad reciente, después por nombre
  resumen.sort((a, b) => {
    if (a.ultimoMensajeFecha && b.ultimoMensajeFecha) {
      return b.ultimoMensajeFecha.localeCompare(a.ultimoMensajeFecha);
    }
    if (a.ultimoMensajeFecha) return -1;
    if (b.ultimoMensajeFecha) return 1;
    return a.clubNombre.localeCompare(b.clubNombre);
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
    .select("id, club_id, created_at, last_message_at")
    .eq("club_id", clubId)
    .maybeSingle();

  if (existente) return existente as Conversacion;

  const { data: creada, error } = await supabase
    .from("conversations")
    .insert({ club_id: clubId })
    .select("id, club_id, created_at, last_message_at")
    .single();

  if (error) {
    // Carrera: otro la creó justo antes → la volvemos a leer
    const { data: relectura } = await supabase
      .from("conversations")
      .select("id, club_id, created_at, last_message_at")
      .eq("club_id", clubId)
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
    .select("id, conversation_id, sender_id, body, attachment_path, attachment_name, attachment_type, read_at, created_at")
    .eq("conversation_id", conversacionId)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) throw new Error("No se pudieron cargar los mensajes.");
  return data ?? [];
}

/** Cantidad de mensajes sin leer dirigidos al usuario actual (para el badge). */
export async function contarNoLeidos(): Promise<number> {
  // Si no hay sesión (visitante o sesión expirada), el badge muestra 0.
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
}

// ---------- Mutaciones ----------

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB (igual que el límite del bucket)

/**
 * Enviar un mensaje: texto, adjunto, o ambos.
 * El archivo se sube a Storage dentro de la carpeta del club.
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

  // Necesitamos el club de la conversación para armar la ruta del adjunto
  const { data: conversacion } = await supabase
    .from("conversations")
    .select("club_id")
    .eq("id", conversacionId)
    .single();
  if (!conversacion) return { error: "La conversación no existe." };

  let attachment_path: string | null = null;
  let attachment_name: string | null = null;
  let attachment_type: string | null = null;

  if (archivo && archivo.size > 0) {
    if (!TIPOS_PERMITIDOS.includes(archivo.type)) {
      return { error: "Solo se permiten imágenes (JPG, PNG, WebP) o PDF." };
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return { error: "El archivo supera los 10 MB permitidos." };
    }

    const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    attachment_path = `${conversacion.club_id}/${crypto.randomUUID()}-${nombreSeguro}`;
    attachment_name = archivo.name;
    attachment_type = archivo.type;

    const { error: errorSubida } = await supabase.storage
      .from("mensajeria-adjuntos")
      .upload(attachment_path, archivo, { contentType: archivo.type });

    if (errorSubida) {
      return { error: "No se pudo subir el archivo. Intentá de nuevo." };
    }
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
    .select("id, conversation_id, sender_id, body, attachment_path, attachment_name, attachment_type, read_at, created_at")
    .single();

  if (errorMensaje) return { error: "No se pudo enviar el mensaje." };

  revalidatePath("/admin/mensajeria");
  revalidatePath("/club/mensajeria");
  return { mensaje };
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

  revalidatePath("/admin/mensajeria");
  revalidatePath("/club/mensajeria");
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