"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  esCarpetaValida,
  formatoDeArchivo,
  ordenarDocumentos,
  ordenarVersiones,
  validarDocumento,
  type AmbitoDescarga,
  type CarpetaDescarga,
} from "@/lib/core/rules/descargasRules";

/**
 * MÓDULO DESCARGAS — Acciones de servidor (Paso 17A)
 *
 * Dos ámbitos: 'publico' (cualquiera lo ve en /descargas) y 'clubes' (solo
 * usuarios con cuenta: club, árbitro y admin). La federación sube archivos
 * con HISTORIAL COMPLETO de versiones; el público ve todas las versiones y
 * descarga la que necesite.
 *
 * · Bucket 'descargas-publicas' (público) y 'descargas-clubes' (privado, con
 *   signed URLs para descargar).
 * · Carpetas fijas: Reglamentos, Boletines, Formularios, Planillas.
 * · Orden manual + fijados + contador de descargas por versión y por documento.
 */

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface VersionDescargaUI {
  id: string;
  version: number;
  archivoPath: string;
  formato: string;
  tamanoBytes: number;
  notasVersion: string | null;
  descargas: number;
  createdAt: string;
  urlDescarga: string | null;
}

export interface DocumentoDescargaUI {
  id: string;
  ambito: AmbitoDescarga;
  carpeta: CarpetaDescarga;
  nombre: string;
  descripcion: string | null;
  fijado: boolean;
  orden: number;
  descargasTotal: number;
  versionVigente: number;
  activo: boolean;
  versiones: VersionDescargaUI[];
}

export interface GestionDescargas {
  ambito: AmbitoDescarga;
  documentos: DocumentoDescargaUI[];
  totalDescargas: number;
}

export interface GuardarDocumentoInput {
  id?: string;
  ambito: AmbitoDescarga;
  carpeta: CarpetaDescarga;
  nombre: string;
  descripcion: string | null;
  fijado: boolean;
  orden: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requerirAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Solo la federación puede hacer esto.");
  return { supabase, user };
}

async function auditar(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  userId: string,
  action: string,
  oldData: unknown,
  newData: unknown
) {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    module: "descargas",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

function bucketDe(ambito: AmbitoDescarga): string {
  return ambito === "publico" ? "descargas-publicas" : "descargas-clubes";
}

function urlPublica(ambito: AmbitoDescarga, path: string): string | null {
  if (ambito !== "publico") return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucketDe(ambito)}/${path}`;
}

function revalidarDescargas() {
  revalidatePath("/descargas");
  revalidatePath("/club/descargas");
  revalidatePath("/admin/descargas");
}

interface FilaVersion {
  id: string;
  version: number;
  archivo_path: string;
  formato: string;
  tamano_bytes: number;
  notas_version: string | null;
  descargas: number;
  created_at: string;
}

interface FilaDocumento {
  id: string;
  ambito: AmbitoDescarga;
  carpeta: CarpetaDescarga;
  nombre: string;
  descripcion: string | null;
  fijado: boolean;
  orden: number;
  descargas_total: number;
  version_vigente: number;
  activo: boolean;
  download_versions: unknown;
}

function mapearDocumento(f: FilaDocumento): DocumentoDescargaUI {
  const versionesCrudas = Array.isArray(f.download_versions)
    ? (f.download_versions as FilaVersion[])
    : [];
  const versiones: VersionDescargaUI[] = ordenarVersiones(
    versionesCrudas.map((v) => ({ ...v }))
  ).map((v) => ({
    id: v.id,
    version: v.version,
    archivoPath: v.archivo_path,
    formato: v.formato,
    tamanoBytes: v.tamano_bytes,
    notasVersion: v.notas_version,
    descargas: v.descargas,
    createdAt: v.created_at,
    urlDescarga: urlPublica(f.ambito, v.archivo_path),
  }));

  return {
    id: f.id,
    ambito: f.ambito,
    carpeta: f.carpeta,
    nombre: f.nombre,
    descripcion: f.descripcion,
    fijado: f.fijado,
    orden: f.orden,
    descargasTotal: f.descargas_total,
    versionVigente: f.version_vigente,
    activo: f.activo,
    versiones,
  };
}

// ---------------------------------------------------------------------------
// ADMIN — GESTIÓN
// ---------------------------------------------------------------------------

export async function obtenerGestionDescargas(ambito: AmbitoDescarga): Promise<GestionDescargas> {
  const { supabase } = await requerirAdmin();

  const { data: filas } = await supabase
    .from("download_documents")
    .select("*, download_versions(*)")
    .eq("ambito", ambito);

  const documentos = ordenarDocumentos(
    ((filas ?? []) as unknown as FilaDocumento[]).map((f) => ({ ...f, versiones: [] as never[] }))
  ).map((f) => mapearDocumento(f as unknown as FilaDocumento));

  return {
    ambito,
    documentos,
    totalDescargas: documentos.reduce((acc, d) => acc + d.descargasTotal, 0),
  };
}

export async function guardarDocumento(
  input: GuardarDocumentoInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { supabase, user } = await requerirAdmin();

  const errores = validarDocumento({
    nombre: input.nombre,
    carpeta: input.carpeta,
    ambito: input.ambito,
    descripcion: input.descripcion,
  });
  const primerError = Object.values(errores)[0];
  if (primerError) return { ok: false, error: primerError };

  const payload = {
    ambito: input.ambito,
    carpeta: input.carpeta,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    fijado: input.fijado,
    orden: input.orden,
  };

  if (input.id) {
    const { data: anterior } = await supabase
      .from("download_documents")
      .select("nombre, carpeta, fijado, orden")
      .eq("id", input.id)
      .single();
    const { error } = await supabase
      .from("download_documents")
      .update(payload)
      .eq("id", input.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    await auditar(supabase, user.id, "documento_actualizado", anterior, payload);
    revalidarDescargas();
    return { ok: true, id: input.id };
  }

  const { data: creado, error } = await supabase
    .from("download_documents")
    .insert({ ...payload, creado_por: user.id })
    .select("id")
    .single();
  if (error || !creado) {
    return { ok: false, error: `No se pudo crear el documento: ${error?.message ?? "error desconocido"}` };
  }
  await auditar(supabase, user.id, "documento_creado", null, { id: creado.id, ...payload });
  revalidarDescargas();
  return { ok: true, id: creado.id as string };
}

/** Activa/desactiva la visibilidad del documento sin borrar su historial. */
export async function alternarDocumentoActivo(
  id: string,
  activo: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();
  const { error } = await supabase
    .from("download_documents")
    .update({ activo })
    .eq("id", id);
  if (error) return { ok: false, error: `No se pudo cambiar: ${error.message}` };
  await auditar(supabase, user.id, activo ? "documento_activado" : "documento_desactivado", null, { id });
  revalidarDescargas();
  return { ok: true };
}

/** Mueve un documento arriba/abajo dentro de su carpeta (intercambia orden). */
export async function moverDocumento(
  id: string,
  direccion: "arriba" | "abajo"
): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requerirAdmin();

  const { data: doc } = await supabase
    .from("download_documents")
    .select("id, ambito, carpeta, orden")
    .eq("id", id)
    .single();
  if (!doc) return { ok: false, error: "No encontré el documento." };

  const { data: vecinos } = await supabase
    .from("download_documents")
    .select("id, orden, fijado")
    .eq("ambito", doc.ambito)
    .eq("carpeta", doc.carpeta)
    .order("fijado", { ascending: false })
    .order("orden", { ascending: true })
    .order("nombre", { ascending: true });

  const lista = (vecinos ?? []) as Array<{ id: string; orden: number }>;
  const idx = lista.findIndex((d) => d.id === id);
  const destino = direccion === "arriba" ? idx - 1 : idx + 1;
  if (idx < 0 || destino < 0 || destino >= lista.length) {
    return { ok: false, error: "Ya está en el límite de la lista." };
  }

  const otro = lista[destino];
  const { error: e1 } = await supabase
    .from("download_documents")
    .update({ orden: otro.orden })
    .eq("id", doc.id);
  const { error: e2 } = await supabase
    .from("download_documents")
    .update({ orden: doc.orden })
    .eq("id", otro.id);
  if (e1 || e2) return { ok: false, error: "No se pudo reordenar." };

  revalidarDescargas();
  return { ok: true };
}

/** Borra el documento, todo su historial y sus archivos del bucket. */
export async function eliminarDocumento(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { data: doc } = await supabase
    .from("download_documents")
    .select("nombre, ambito, download_versions(archivo_path)")
    .eq("id", id)
    .single();
  if (!doc) return { ok: false, error: "No encontré el documento." };

  const { error } = await supabase.from("download_documents").delete().eq("id", id);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };

  try {
    const versiones = Array.isArray(doc.download_versions)
      ? (doc.download_versions as Array<{ archivo_path: string }>)
      : [];
    const paths = versiones.map((v) => v.archivo_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from(bucketDe(doc.ambito as AmbitoDescarga)).remove(paths);
    }
  } catch {
    /* best-effort */
  }

  await auditar(supabase, user.id, "documento_eliminado", { id, nombre: doc.nombre }, null);
  revalidarDescargas();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN — VERSIONES (subir archivo como versión nueva o primera)
// ---------------------------------------------------------------------------

export async function subirNuevaVersion(
  formData: FormData
): Promise<{ ok: boolean; error?: string; version?: number }> {
  const { supabase, user } = await requerirAdmin();

  const documentoId = formData.get("documentoId") as string | null;
  const notas = ((formData.get("notas") as string | null) ?? "").trim() || null;
  const archivo = formData.get("archivo");

  if (!documentoId) return { ok: false, error: "Falta el documento." };
  if (!(archivo instanceof File)) return { ok: false, error: "No llegó ningún archivo." };

  const { data: doc } = await supabase
    .from("download_documents")
    .select("ambito, nombre, download_versions(version)")
    .eq("id", documentoId)
    .single();
  if (!doc) return { ok: false, error: "No encontré el documento." };

  const formato = formatoDeArchivo(archivo.name);
  if (!formato) {
    return { ok: false, error: "Formato no permitido. Aceptamos PDF, Word, Excel e imágenes." };
  }
  if (archivo.size > 10 * 1024 * 1024) {
    return { ok: false, error: "El archivo no puede superar los 10 MB." };
  }

  const versionesExistentes = Array.isArray(doc.download_versions)
    ? (doc.download_versions as Array<{ version: number }>).map((v) => v.version)
    : [];
  const versionNueva = versionesExistentes.length > 0 ? Math.max(...versionesExistentes) + 1 : 1;

  const nombreSeguro = archivo.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
  const path = `${documentoId}/v${versionNueva}-${nombreSeguro}`;

  const { error: errUpload } = await supabase.storage
    .from(bucketDe(doc.ambito as AmbitoDescarga))
    .upload(path, archivo, { contentType: archivo.type, upsert: false });
  if (errUpload) return { ok: false, error: `No se pudo subir el archivo: ${errUpload.message}` };

  const { error: errVersion } = await supabase.from("download_versions").insert({
    documento_id: documentoId,
    version: versionNueva,
    archivo_path: path,
    formato,
    tamano_bytes: archivo.size,
    notas_version: notas,
    subido_por: user.id,
  });
  if (errVersion) {
    // Rollback best-effort del archivo subido
    try {
      await supabase.storage.from(bucketDe(doc.ambito as AmbitoDescarga)).remove([path]);
    } catch {
      /* nada */
    }
    return { ok: false, error: `No se pudo registrar la versión: ${errVersion.message}` };
  }

  await supabase
    .from("download_documents")
    .update({ version_vigente: versionNueva })
    .eq("id", documentoId);

  await auditar(supabase, user.id, "version_subida", null, {
    documentoId,
    documento: doc.nombre,
    version: versionNueva,
    formato,
  });
  revalidarDescargas();
  return { ok: true, version: versionNueva };
}

/** Borra UNA versión del historial (si no es la única que queda). */
export async function eliminarVersion(versionId: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { data: version } = await supabase
    .from("download_versions")
    .select("id, documento_id, version, archivo_path, download_documents(ambito, version_vigente)")
    .eq("id", versionId)
    .single();
  if (!version) return { ok: false, error: "No encontré la versión." };

  const { count } = await supabase
    .from("download_versions")
    .select("id", { count: "exact", head: true })
    .eq("documento_id", version.documento_id);
  if ((count ?? 0) <= 1) {
    return {
      ok: false,
      error: "No podés borrar la única versión del documento. Borrá el documento completo.",
    };
  }

  const { error } = await supabase.from("download_versions").delete().eq("id", versionId);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };

  // Si era la vigente, la vigente pasa a ser la más alta que quede
  const docJoin = Array.isArray(version.download_documents)
    ? (version.download_documents[0] as { ambito: string; version_vigente: number } | undefined)
    : (version.download_documents as { ambito: string; version_vigente: number } | null);
  if (docJoin && docJoin.version_vigente === version.version) {
    const { data: restantes } = await supabase
      .from("download_versions")
      .select("version")
      .eq("documento_id", version.documento_id)
      .order("version", { ascending: false })
      .limit(1);
    const nueva = (restantes?.[0] as { version: number } | undefined)?.version ?? 1;
    await supabase
      .from("download_documents")
      .update({ version_vigente: nueva })
      .eq("id", version.documento_id);
  }

  try {
    if (docJoin?.ambito) {
      await supabase.storage
        .from(bucketDe(docJoin.ambito as AmbitoDescarga))
        .remove([version.archivo_path as string]);
    }
  } catch {
    /* best-effort */
  }

  await auditar(supabase, user.id, "version_eliminada", { versionId, version: version.version }, null);
  revalidarDescargas();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// DESCARGA — URL firmada (ámbito clubes) + contador por RPC
// ---------------------------------------------------------------------------

/**
 * Genera la URL para descargar una versión:
 * · ámbito público → URL pública directa del bucket.
 * · ámbito clubes → signed URL de 5 minutos (el bucket es privado).
 * Además registra la descarga (contador) vía RPC security definer.
 */
export async function obtenerUrlDescarga(
  versionId: string
): Promise<{ ok: boolean; error?: string; url?: string }> {
  const supabase = await createLfsServerClient();

  const { data: version } = await supabase
    .from("download_versions")
    .select("archivo_path, download_documents(ambito, activo)")
    .eq("id", versionId)
    .single();
  if (!version) return { ok: false, error: "No encontré ese archivo." };

  const docJoin = Array.isArray(version.download_documents)
    ? (version.download_documents[0] as { ambito: AmbitoDescarga; activo: boolean } | undefined)
    : (version.download_documents as { ambito: AmbitoDescarga; activo: boolean } | null);
  if (!docJoin || !docJoin.activo) return { ok: false, error: "Este documento no está disponible." };

  // Contador (best-effort; si falla no bloquea la descarga)
  try {
    await supabase.rpc("descarga_registrar", { p_version_id: versionId });
  } catch {
    /* nada */
  }

  if (docJoin.ambito === "publico") {
    const url = urlPublica("publico", version.archivo_path as string);
    if (!url) return { ok: false, error: "No pude armar el link de descarga." };
    return { ok: true, url };
  }

  // Ámbito clubes: hay que estar logueado (club, árbitro o admin)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Necesitás iniciar sesión para descargar este archivo." };

  const { data: signed, error: errSigned } = await supabase.storage
    .from("descargas-clubes")
    .createSignedUrl(version.archivo_path as string, 300);
  if (errSigned || !signed?.signedUrl) {
    return { ok: false, error: "No pude generar el link de descarga. Probá de nuevo." };
  }
  return { ok: true, url: signed.signedUrl };
}

// ---------------------------------------------------------------------------
// LECTURA PÚBLICA / CLUB — por RPC + RLS
// ---------------------------------------------------------------------------

/** Lista pública de /descargas (RPC security definer, datos mínimos). */
export async function obtenerDescargasPublicas(): Promise<DocumentoDescargaUI[]> {
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("descargas_publicas");
  if (error || !Array.isArray(data)) return [];

  return (data as Array<Record<string, unknown>>).map((d) => {
    const versionesCrudas = Array.isArray(d.versiones) ? (d.versiones as Array<Record<string, unknown>>) : [];
    const versiones: VersionDescargaUI[] = versionesCrudas.map((v) => ({
      id: String(v.id),
      version: Number(v.version),
      archivoPath: String(v.archivo_path),
      formato: String(v.formato),
      tamanoBytes: Number(v.tamano_bytes ?? 0),
      notasVersion: (v.notas_version as string | null) ?? null,
      descargas: Number(v.descargas ?? 0),
      createdAt: String(v.created_at),
      urlDescarga: urlPublica("publico", String(v.archivo_path)),
    }));
    return {
      id: String(d.id),
      ambito: "publico" as AmbitoDescarga,
      carpeta: (d.carpeta as CarpetaDescarga) ?? "Reglamentos",
      nombre: String(d.nombre),
      descripcion: (d.descripcion as string | null) ?? null,
      fijado: Boolean(d.fijado),
      orden: Number(d.orden ?? 0),
      descargasTotal: Number(d.descargas_total ?? 0),
      versionVigente: Number(d.version_vigente ?? 1),
      activo: true,
      versiones,
    };
  });
}

/** Documentos del ámbito clubes para el usuario logueado (RLS directa). */
export async function obtenerDescargasClub(): Promise<DocumentoDescargaUI[]> {
  const supabase = await createLfsServerClient();

  const { data: filas, error } = await supabase
    .from("download_documents")
    .select("*, download_versions(*)")
    .eq("ambito", "clubes")
    .eq("activo", true);
  if (error) return [];

  return ordenarDocumentos(
    ((filas ?? []) as unknown as FilaDocumento[]).map((f) => ({ ...f, versiones: [] as never[] }))
  ).map((f) => mapearDocumento(f as unknown as FilaDocumento));
}
