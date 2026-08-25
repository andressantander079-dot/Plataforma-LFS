"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";

/**
 * ACCIONES DE DOCUMENTOS DE JUGADORES (Paso 3 y Adaptación Clubes)
 * Subida y lectura segura de archivos en Supabase Storage.
 * Bucket privado "documentos-jugadores".
 * Permite acceso a administradores de la liga y delegados del propio club del jugador.
 */

const BUCKET = "documentos-jugadores";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_PERMITIDOS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const TIPOS_VALIDOS = ["medical", "ddjj", "photo"] as const;
type TipoDocumento = (typeof TIPOS_VALIDOS)[number];

type ActionResult = { ok: boolean; error?: string; url?: string };

// Valida si el usuario actual es admin o si es delegado del club del jugador
async function requireAdminOrClubForPlayer(playerId: string) {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No hay sesión activa. Iniciá sesión nuevamente.", isAdmin: false, clubId: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Perfil de usuario no encontrado.", isAdmin: false, clubId: null };
  }

  if (profile.role === "admin") {
    return { error: null, isAdmin: true, clubId: null };
  }

  if (profile.role === "club") {
    if (!profile.club_id) {
      return { error: "El usuario no tiene ningún club asignado.", isAdmin: false, clubId: null };
    }

    // Verificar si el jugador pertenece al club del delegado
    const { data: belongs } = await supabase
      .from("player_categories")
      .select("club_id")
      .eq("player_id", playerId)
      .eq("club_id", profile.club_id)
      .limit(1)
      .maybeSingle();

    if (!belongs) {
      return { error: "Este jugador no pertenece a tu club.", isAdmin: false, clubId: null };
    }

    return { error: null, isAdmin: false, clubId: profile.club_id };
  }

  return { error: "Operación no autorizada.", isAdmin: false, clubId: null };
}

// ---------- SUBIR DOCUMENTO ----------
export async function subirDocumento(
  clubId: string,
  playerId: string,
  tipo: TipoDocumento,
  formData: FormData
): Promise<ActionResult> {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    return { ok: false, error: "Tipo de documento inválido." };
  }

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (archivo.size > MAX_BYTES) {
    return { ok: false, error: "El archivo supera los 5 MB permitidos." };
  }

  const extension = MIME_PERMITIDOS[archivo.type];
  if (!extension) {
    return { ok: false, error: "Formato no permitido. Solo PDF, JPG o PNG." };
  }

  const check = await requireAdminOrClubForPlayer(playerId);
  if (check.error) return { ok: false, error: check.error };

  // Si es del club, debe coincidir con el clubId del jugador
  if (!check.isAdmin && check.clubId !== clubId) {
    return { ok: false, error: "No tenés permiso para subir archivos a este club." };
  }

  const adminClient = createLfsAdminClient();
  const ruta = `${clubId}/${playerId}/${tipo}.${extension}`;

  // Subir el archivo usando el cliente administrador (bypass RLS)
  const { error: uploadError } = await adminClient.storage
    .from(BUCKET)
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type });

  if (uploadError) {
    return { ok: false, error: `Error al subir el archivo: ${uploadError.message}` };
  }

  // Marcar el documento en la ficha del jugador
  const { data: player } = await adminClient
    .from("players")
    .select("documents")
    .eq("id", playerId)
    .single();

  const documents = {
    ...((player?.documents as Record<string, string>) ?? {}),
    [tipo]: ruta,
  };

  const { error: updateError } = await adminClient
    .from("players")
    .update({ documents })
    .eq("id", playerId);

  if (updateError) {
    return {
      ok: false,
      error: `El archivo se subió pero no se actualizó la ficha: ${updateError.message}`,
    };
  }

  revalidatePath(`/admin/equipos/${clubId}/plantel`);
  revalidatePath(`/club/planteles`);
  return { ok: true };
}

// ---------- OBTENER ENLACE PARA VER DOCUMENTO ----------
export async function obtenerUrlDocumento(ruta: string): Promise<ActionResult> {
  if (!ruta) return { ok: false, error: "Documento inexistente." };

  const parts = ruta.split("/");
  const playerId = parts[1];
  if (!playerId) {
    return { ok: false, error: "Ruta de archivo incorrecta." };
  }

  const check = await requireAdminOrClubForPlayer(playerId);
  if (check.error) return { ok: false, error: check.error };

  const adminClient = createLfsAdminClient();
  const { data, error: signError } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(ruta, 60);

  if (signError || !data?.signedUrl) {
    return { ok: false, error: "No se pudo generar el enlace del documento." };
  }

  return { ok: true, url: data.signedUrl };
}
