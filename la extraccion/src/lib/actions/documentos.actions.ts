"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * ACCIONES DE DOCUMENTOS DE JUGADORES (Paso 3)
 * Subida y lectura segura de archivos en Supabase Storage.
 * Bucket privado "documentos-jugadores" — solo rol admin.
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

async function requireAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: "No hay sesión activa. Iniciá sesión nuevamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { supabase, error: "Solo el administrador puede gestionar documentos." };
  }

  return { supabase, error: null };
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

  const { supabase, error } = await requireAdmin();
  if (error) return { ok: false, error };

  // 1. Subir el archivo al bucket (upsert: si ya existía, lo reemplaza)
  const ruta = `${clubId}/${playerId}/${tipo}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { upsert: true, contentType: archivo.type });

  if (uploadError) {
    return { ok: false, error: `Error al subir el archivo: ${uploadError.message}` };
  }

  // 2. Marcar el documento en la ficha del jugador (guardamos la ruta)
  const { data: player } = await supabase
    .from("players")
    .select("documents")
    .eq("id", playerId)
    .single();

  const documents = {
    ...((player?.documents as Record<string, string>) ?? {}),
    [tipo]: ruta,
  };

  const { error: updateError } = await supabase
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
  return { ok: true };
}

// ---------- OBTENER ENLACE PARA VER DOCUMENTO ----------
// Genera un enlace firmado que vence en 60 segundos (bucket privado)
export async function obtenerUrlDocumento(ruta: string): Promise<ActionResult> {
  if (!ruta) return { ok: false, error: "Documento inexistente." };

  const { supabase, error } = await requireAdmin();
  if (error) return { ok: false, error };

  const { data, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, 60);

  if (signError || !data?.signedUrl) {
    return { ok: false, error: "No se pudo generar el enlace del documento." };
  }

  return { ok: true, url: data.signedUrl };
}
