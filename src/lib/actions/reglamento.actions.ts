"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * MÓDULO REGLAMENTO OFICIAL (Paso 17B)
 *
 * · Página propia del admin (/admin/reglamento) con HISTORIAL DEDICADO:
 *   cada versión guarda sus notas de cambios (OBLIGATORIAS) y solo UNA
 *   queda vigente (índice único parcial en la base).
 * · Los PDF viven en el bucket PÚBLICO 'descargas-publicas' (creado en el
 *   Paso 17A) y cada versión se ESPEJA automáticamente en el módulo
 *   Descargas (download_documents / download_versions) para que el público
 *   la baje desde /descargas sin tocar nada más.
 * · Solo PDF, máximo 10 MB.
 */

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface VersionReglamentoUI {
  id: string;
  version: number;
  archivoPath: string;
  notasCambios: string;
  vigente: boolean;
  subidoEn: string; // ISO
  url: string; // URL pública del PDF
}

export interface ReglamentoPanel {
  versiones: VersionReglamentoUI[];
  vigente: VersionReglamentoUI | null;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const BUCKET = "descargas-publicas";
const TAMANO_MAX = 10 * 1024 * 1024; // 10 MB
const NOTAS_MIN = 10;
const NOTAS_MAX = 1000;

/** Documento espejo fijo dentro del módulo Descargas (ámbito público). */
const ESPEJO = {
  ambito: "publico",
  carpeta: "Reglamentos",
  nombre: "Reglamento Oficial LFS",
  descripcion:
    "Reglamento oficial de la Liga de Fútsal de Ushuaia. Acá se publica siempre la versión vigente, con su historial completo.",
} as const;

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
  accion: string,
  detalle: Record<string, unknown>
) {
  try {
    await supabase.from("audit_logs").insert({
      module: "reglamento",
      action: accion,
      actor_id: userId,
      details: detalle,
    });
  } catch {
    // La auditoría nunca rompe la operación principal
  }
}

function revalidarReglamento() {
  revalidatePath("/admin/reglamento");
  revalidatePath("/descargas");
  revalidatePath("/admin/descargas");
}

function urlPublica(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  path: string
): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

interface FilaReglamento {
  id: string;
  version: number;
  archivo_path: string;
  notas_cambios: string;
  vigente: boolean;
  created_at: string;
}

function mapearVersion(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  f: FilaReglamento
): VersionReglamentoUI {
  return {
    id: f.id,
    version: f.version,
    archivoPath: f.archivo_path,
    notasCambios: f.notas_cambios,
    vigente: f.vigente,
    subidoEn: f.created_at,
    url: urlPublica(supabase, f.archivo_path),
  };
}

/** Busca (o crea) el documento espejo en download_documents. */
async function asegurarEspejo(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  userId: string
): Promise<{ id: string; maxVersion: number } | null> {
  const { data: existente } = await supabase
    .from("download_documents")
    .select("id, download_versions(version)")
    .eq("ambito", ESPEJO.ambito)
    .eq("carpeta", ESPEJO.carpeta)
    .eq("nombre", ESPEJO.nombre)
    .maybeSingle();

  if (existente) {
    const versiones = Array.isArray(existente.download_versions)
      ? (existente.download_versions as Array<{ version: number }>).map((v) => v.version)
      : [];
    return {
      id: existente.id,
      maxVersion: versiones.length > 0 ? Math.max(...versiones) : 0,
    };
  }

  const { data: creado, error } = await supabase
    .from("download_documents")
    .insert({
      ambito: ESPEJO.ambito,
      carpeta: ESPEJO.carpeta,
      nombre: ESPEJO.nombre,
      descripcion: ESPEJO.descripcion,
      fijado: true,
      orden: 0,
      subido_por: userId,
    })
    .select("id")
    .single();
  if (error || !creado) return null;
  return { id: creado.id, maxVersion: 0 };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Panel completo del admin: historial ordenado + versión vigente. */
export async function obtenerReglamento(): Promise<ReglamentoPanel> {
  const { supabase } = await requerirAdmin();
  const { data, error } = await supabase
    .from("reglamento_versions")
    .select("id, version, archivo_path, notas_cambios, vigente, created_at")
    .order("version", { ascending: false });
  if (error) throw new Error(`No se pudo cargar el reglamento: ${error.message}`);

  const versiones = ((data ?? []) as FilaReglamento[]).map((f) => mapearVersion(supabase, f));
  return {
    versiones,
    vigente: versiones.find((v) => v.vigente) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------

/**
 * Sube una NUEVA versión del Reglamento Oficial.
 * formData: archivo (PDF ≤10MB) + notas (obligatorias, 10..1000 caracteres).
 *
 * Flujo transaccional best-effort:
 *  1) valida y sube el PDF al bucket público
 *  2) apaga la vigente anterior e inserta la nueva como vigente
 *  3) espeja en Descargas públicas (download_documents + download_versions)
 * Si algo falla a mitad de camino intenta dejar todo como estaba.
 */
export async function subirVersionReglamento(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const archivo = formData.get("archivo");
  const notas = ((formData.get("notas") as string | null) ?? "").trim();

  if (!(archivo instanceof File)) return { ok: false, error: "No llegó ningún archivo." };
  if (!archivo.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "El reglamento tiene que ser un PDF." };
  }
  if (archivo.size > TAMANO_MAX) {
    return { ok: false, error: "El archivo no puede superar los 10 MB." };
  }
  if (notas.length < NOTAS_MIN) {
    return {
      ok: false,
      error: `Contanos qué cambió en esta versión (mínimo ${NOTAS_MIN} caracteres).`,
    };
  }
  if (notas.length > NOTAS_MAX) {
    return { ok: false, error: `Las notas no pueden superar los ${NOTAS_MAX} caracteres.` };
  }

  // --- Numeración: la siguiente versión considera AMBAS tablas (la numeración
  // del espejo y la del reglamento tienen que coincidir siempre).
  const { data: anteriores } = await supabase
    .from("reglamento_versions")
    .select("id, version, vigente")
    .order("version", { ascending: false });
  const filas = (anteriores ?? []) as Array<{ id: string; version: number; vigente: boolean }>;
  const maxReglamento = filas.length > 0 ? Math.max(...filas.map((f) => f.version)) : 0;
  const vigenteAnterior = filas.find((f) => f.vigente) ?? null;

  const espejo = await asegurarEspejo(supabase, user.id);
  if (!espejo) {
    return { ok: false, error: "No se pudo preparar el documento público en Descargas." };
  }
  const versionNueva = Math.max(maxReglamento, espejo.maxVersion) + 1;

  // --- 1) Subir el PDF
  const path = `reglamento-oficial/v${versionNueva}-${Date.now()}.pdf`;
  const { error: errUpload } = await supabase.storage
    .from(BUCKET)
    .upload(path, archivo, { contentType: "application/pdf", upsert: false });
  if (errUpload) {
    return { ok: false, error: `No se pudo subir el archivo: ${errUpload.message}` };
  }

  const limpiarArchivo = async () => {
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      /* nada */
    }
  };

  // --- 2) Apagar vigente anterior + insertar la nueva como vigente
  if (vigenteAnterior) {
    await supabase
      .from("reglamento_versions")
      .update({ vigente: false })
      .eq("id", vigenteAnterior.id);
  }
  const { data: insertada, error: errInsert } = await supabase
    .from("reglamento_versions")
    .insert({
      version: versionNueva,
      archivo_path: path,
      notas_cambios: notas,
      vigente: true,
      subido_por: user.id,
    })
    .select("id")
    .single();

  if (errInsert || !insertada) {
    // Rollback: restaurar la vigente anterior y borrar el archivo
    if (vigenteAnterior) {
      await supabase
        .from("reglamento_versions")
        .update({ vigente: true })
        .eq("id", vigenteAnterior.id);
    }
    await limpiarArchivo();
    return {
      ok: false,
      error: `No se pudo registrar la versión: ${errInsert?.message ?? "error desconocido"}`,
    };
  }

  // --- 3) Espejo en Descargas públicas
  const { error: errEspejoVersion } = await supabase.from("download_versions").insert({
    documento_id: espejo.id,
    version: versionNueva,
    archivo_path: path,
    formato: "PDF",
    tamano_bytes: archivo.size,
    notas_version: notas,
    subido_por: user.id,
  });
  if (errEspejoVersion) {
    // Rollback completo: borrar fila nueva, restaurar vigente, borrar archivo
    await supabase.from("reglamento_versions").delete().eq("id", insertada.id);
    if (vigenteAnterior) {
      await supabase
        .from("reglamento_versions")
        .update({ vigente: true })
        .eq("id", vigenteAnterior.id);
    }
    await limpiarArchivo();
    return {
      ok: false,
      error: `No se pudo publicar en Descargas: ${errEspejoVersion.message}`,
    };
  }
  await supabase
    .from("download_documents")
    .update({ version_vigente: versionNueva, updated_at: new Date().toISOString() })
    .eq("id", espejo.id);

  await auditar(supabase, user.id, "version_reglamento_subida", {
    version: versionNueva,
    tamanoBytes: archivo.size,
  });
  revalidarReglamento();
  return { ok: true, version: versionNueva };
}

/**
 * Elimina una versión del historial (no se puede borrar la ÚNICA que hay).
 * Si era la vigente, queda vigente automáticamente la más reciente que quede.
 * También limpia el archivo del storage y el espejo en Descargas.
 */
export async function eliminarVersionReglamento(id: string) {
  const { supabase, user } = await requerirAdmin();
  if (!id) return { ok: false, error: "Falta la versión." };

  const { data: todas } = await supabase
    .from("reglamento_versions")
    .select("id, version, archivo_path, vigente")
    .order("version", { ascending: false });
  const filas = (todas ?? []) as Array<{
    id: string;
    version: number;
    archivo_path: string;
    vigente: boolean;
  }>;
  const objetivo = filas.find((f) => f.id === id);
  if (!objetivo) return { ok: false, error: "No encontré esa versión." };
  if (filas.length <= 1) {
    return {
      ok: false,
      error: "No podés borrar la única versión del reglamento: subí una nueva primero.",
    };
  }

  const { error } = await supabase.from("reglamento_versions").delete().eq("id", id);
  if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` };

  // Si era la vigente, promover la más reciente que quede
  let versionPromovida: number | null = null;
  if (objetivo.vigente) {
    const restantes = filas.filter((f) => f.id !== id);
    const nueva = restantes[0]; // ya vienen ordenadas desc por version
    if (nueva) {
      await supabase.from("reglamento_versions").update({ vigente: true }).eq("id", nueva.id);
      versionPromovida = nueva.version;
    }
  }

  // Limpiar espejo en Descargas (misma ruta de archivo) + storage
  const { data: espejoVersiones } = await supabase
    .from("download_versions")
    .select("id, documento_id")
    .eq("archivo_path", objetivo.archivo_path);
  const espejoVersion = (espejoVersiones ?? [])[0] as
    | { id: string; documento_id: string }
    | undefined;
  if (espejoVersion) {
    await supabase.from("download_versions").delete().eq("id", espejoVersion.id);
    if (versionPromovida !== null) {
      await supabase
        .from("download_documents")
        .update({ version_vigente: versionPromovida, updated_at: new Date().toISOString() })
        .eq("id", espejoVersion.documento_id);
    }
  }
  try {
    await supabase.storage.from(BUCKET).remove([objetivo.archivo_path]);
  } catch {
    /* nada */
  }

  await auditar(supabase, user.id, "version_reglamento_eliminada", {
    version: objetivo.version,
    eraVigente: objetivo.vigente,
    versionPromovida,
  });
  revalidarReglamento();
  return { ok: true, versionPromovida };
}
