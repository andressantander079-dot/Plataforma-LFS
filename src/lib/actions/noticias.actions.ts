"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  esSlugValido,
  estadoDerivado,
  extraerYoutubeId,
  resumenAutomatico,
  slugify,
  validarNoticia,
  type EstadoDerivadoNoticia,
  type EstadoNoticia,
  type TipoVideoNoticia,
} from "@/lib/core/rules/noticiasRules";
import { sanitizarHtml } from "@/lib/core/rules/mensajeriaRules";

/**
 * MÓDULO NOTICIAS — Acciones de servidor (Paso 17A)
 *
 * · ADMIN (la liga): redacta con editor enriquecido, sube portada/galería/
 *   video, programa publicación y vencimiento, destaca UNA noticia, gestiona
 *   categorías con color y ve estadísticas de contenido.
 * · PÚBLICO: lee por RPCs security definer con datos mínimos; likes y vistas
 *   se registran por dispositivo (1 por navegador por noticia).
 *
 * Reglas de oro: toda escritura valida rol acá Y en RLS; las URLs públicas
 * de archivos se arman con el bucket público 'noticias'.
 */

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface CategoriaNoticiaUI {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  activa: boolean;
  noticias: number;
}

export interface ItemGaleria {
  path: string;
  url: string;
}

export interface NoticiaAdminUI {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  categoriaColor: string | null;
  portadaPath: string | null;
  portadaUrl: string | null;
  galeria: ItemGaleria[];
  videoTipo: TipoVideoNoticia | null;
  videoUrl: string | null;
  videoPath: string | null;
  videoPublicUrl: string | null;
  destacada: boolean;
  estado: EstadoNoticia;
  estadoDerivado: EstadoDerivadoNoticia;
  publicarAt: string | null;
  venceAt: string | null;
  publicadaAt: string | null;
  vistas: number;
  likes: number;
  createdAt: string;
}

export interface KpisNoticias {
  total: number;
  publicadas: number;
  borradores: number;
  programadas: number;
  archivadas: number;
  vistasTotales: number;
  likesTotales: number;
}

export interface PanelNoticias {
  kpis: KpisNoticias;
  noticias: NoticiaAdminUI[];
  categorias: CategoriaNoticiaUI[];
}

export interface TopNoticia {
  id: string;
  titulo: string;
  slug: string;
  vistas: number;
  likes: number;
}

export interface EstadisticasNoticias {
  totales: KpisNoticias;
  topVistas: TopNoticia[];
  topLikes: TopNoticia[];
  porCategoria: Array<{
    nombre: string;
    color: string;
    cantidad: number;
    vistas: number;
    likes: number;
  }>;
  vistasPorDia: Array<{ dia: string; vistas: number }>;
}

/** Noticia tal como la ve el público (lista y home). */
export interface NoticiaPublicaUI {
  id: string;
  titulo: string;
  slug: string;
  resumen: string;
  portadaUrl: string | null;
  destacada: boolean;
  publicadaAt: string;
  likes: number;
  vistas: number;
  categoria: { nombre: string; color: string } | null;
}

/** Detalle público completo + relacionadas. */
export interface NoticiaDetalleUI {
  noticia: NoticiaPublicaUI & {
    contenido: string;
    galeria: ItemGaleria[];
    videoTipo: TipoVideoNoticia | null;
    videoUrl: string | null;
    videoPublicUrl: string | null;
  };
  relacionadas: Array<{
    titulo: string;
    slug: string;
    resumen: string;
    portadaUrl: string | null;
    publicadaAt: string;
  }>;
}

export interface GuardarNoticiaInput {
  id?: string;
  titulo: string;
  slug?: string;
  resumen: string;
  contenido: string;
  categoriaId: string | null;
  portadaPath: string | null;
  galeria: string[];
  videoTipo: TipoVideoNoticia | null;
  videoUrl: string | null;
  videoPath: string | null;
  destacada: boolean;
  accion: "borrador" | "publicar" | "programar";
  publicarAt: string | null;
  venceAt: string | null;
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
    module: "noticias",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

const BUCKET = "noticias";

function urlPublica(path: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

function revalidarNoticias() {
  revalidatePath("/");
  revalidatePath("/noticias");
  revalidatePath("/admin/noticias");
}

function mapearGaleria(galeria: unknown): ItemGaleria[] {
  if (!Array.isArray(galeria)) return [];
  return galeria
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .map((path) => ({ path, url: urlPublica(path) ?? "" }));
}

interface FilaCategoria {
  id: string;
  nombre: string;
  color: string;
}

function categoriaDe(join: unknown): FilaCategoria | null {
  // Supabase sin tipos: el embed puede venir como objeto o como array de 1
  if (Array.isArray(join)) return (join[0] as FilaCategoria) ?? null;
  return (join as FilaCategoria | null) ?? null;
}

interface FilaNews {
  id: string;
  categoria_id: string | null;
  titulo: string;
  slug: string;
  resumen: string;
  contenido: string;
  portada_path: string | null;
  galeria: unknown;
  video_tipo: TipoVideoNoticia | null;
  video_url: string | null;
  video_path: string | null;
  destacada: boolean;
  estado: EstadoNoticia;
  publicar_at: string | null;
  vence_at: string | null;
  publicada_at: string | null;
  vistas: number;
  likes_count: number;
  created_at: string;
  news_categories: unknown;
}

function mapearNoticiaAdmin(n: FilaNews): NoticiaAdminUI {
  const cat = categoriaDe(n.news_categories);
  return {
    id: n.id,
    titulo: n.titulo,
    slug: n.slug,
    resumen: n.resumen,
    contenido: n.contenido,
    categoriaId: n.categoria_id,
    categoriaNombre: cat?.nombre ?? null,
    categoriaColor: cat?.color ?? null,
    portadaPath: n.portada_path,
    portadaUrl: urlPublica(n.portada_path),
    galeria: mapearGaleria(n.galeria),
    videoTipo: n.video_tipo,
    videoUrl: n.video_url,
    videoPath: n.video_path,
    videoPublicUrl: n.video_tipo === "mp4" ? urlPublica(n.video_path) : null,
    destacada: n.destacada,
    estado: n.estado,
    estadoDerivado: estadoDerivado({
      estado: n.estado,
      publicar_at: n.publicar_at,
      vence_at: n.vence_at,
      publicada_at: n.publicada_at,
    }),
    publicarAt: n.publicar_at,
    venceAt: n.vence_at,
    publicadaAt: n.publicada_at,
    vistas: n.vistas ?? 0,
    likes: n.likes_count ?? 0,
    createdAt: n.created_at,
  };
}

/** Slug único: si está ocupado por otra noticia, suma sufijo -2, -3… */
async function slugUnico(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  base: string,
  ignorarId?: string
): Promise<string> {
  let candidato = base;
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let query = supabase.from("news").select("id").eq("slug", candidato);
    if (ignorarId) query = query.neq("id", ignorarId);
    const { data } = await query.maybeSingle();
    if (!data) return candidato;
    candidato = `${base}-${i}`;
    i += 1;
  }
}

// ---------------------------------------------------------------------------
// ADMIN — PANEL (lista + KPIs + categorías)
// ---------------------------------------------------------------------------

export async function obtenerPanelNoticias(): Promise<PanelNoticias> {
  const { supabase } = await requerirAdmin();

  // Autocuración best-effort (activa programadas, archiva vencidas)
  try {
    await supabase.rpc("news_sincronizar_estados");
  } catch {
    /* si falla, la lista igual se muestra con estado derivado */
  }

  const [{ data: filas }, { data: categorias }] = await Promise.all([
    supabase
      .from("news")
      .select("*, news_categories(id, nombre, color)")
      .order("created_at", { ascending: false }),
    supabase.from("news_categories").select("*").order("orden").order("nombre"),
  ]);

  const noticias = ((filas ?? []) as unknown as FilaNews[]).map(mapearNoticiaAdmin);

  const kpis: KpisNoticias = {
    total: noticias.length,
    publicadas: noticias.filter((n) => n.estado === "publicada").length,
    borradores: noticias.filter((n) => n.estado === "borrador").length,
    programadas: noticias.filter((n) => n.estado === "programada").length,
    archivadas: noticias.filter((n) => n.estado === "archivada").length,
    vistasTotales: noticias.reduce((acc, n) => acc + n.vistas, 0),
    likesTotales: noticias.reduce((acc, n) => acc + n.likes, 0),
  };

  const categoriasUI: CategoriaNoticiaUI[] = (
    (categorias ?? []) as Array<{
      id: string;
      nombre: string;
      color: string;
      orden: number;
      activa: boolean;
    }>
  ).map((c) => ({
    ...c,
    noticias: noticias.filter((n) => n.categoriaId === c.id).length,
  }));

  return { kpis, noticias, categorias: categoriasUI };
}

// ---------------------------------------------------------------------------
// ADMIN — LEER UNA NOTICIA (para el editor)
// ---------------------------------------------------------------------------

export async function obtenerNoticiaParaEditar(id: string): Promise<{
  noticia: NoticiaAdminUI;
  categorias: CategoriaNoticiaUI[];
} | null> {
  const { supabase } = await requerirAdmin();

  const [{ data: fila }, { data: categorias }] = await Promise.all([
    supabase.from("news").select("*, news_categories(id, nombre, color)").eq("id", id).maybeSingle(),
    supabase.from("news_categories").select("*").order("orden").order("nombre"),
  ]);
  if (!fila) return null;

  return {
    noticia: mapearNoticiaAdmin(fila as unknown as FilaNews),
    categorias: ((categorias ?? []) as Array<{
      id: string;
      nombre: string;
      color: string;
      orden: number;
      activa: boolean;
    }>).map((c) => ({ ...c, noticias: 0 })),
  };
}

// ---------------------------------------------------------------------------
// ADMIN — GUARDAR (crear/editar, slug único, destacada única)
// ---------------------------------------------------------------------------

export async function guardarNoticia(
  input: GuardarNoticiaInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { supabase, user } = await requerirAdmin();

  // Validación de negocio (misma regla que en el cliente)
  const estadoDestino: EstadoNoticia =
    input.accion === "publicar" ? "publicada" : input.accion === "programar" ? "programada" : "borrador";

  const errores = validarNoticia({
    titulo: input.titulo,
    slug: input.slug,
    resumen: input.resumen,
    contenido: input.contenido,
    galeria: input.galeria,
    videoTipo: input.videoTipo,
    videoUrl: input.videoUrl,
    videoPath: input.videoPath,
    estado: estadoDestino,
    publicarAt: input.publicarAt,
    venceAt: input.venceAt,
  });
  const primerError = Object.values(errores)[0];
  if (primerError) return { ok: false, error: primerError };

  // Slug: el del admin si es válido, o generado del título
  const baseSlug =
    input.slug && esSlugValido(input.slug) ? input.slug : slugify(input.titulo);
  if (!baseSlug) return { ok: false, error: "No pude generar la URL a partir del título." };
  const slug = await slugUnico(supabase, baseSlug, input.id);

  // Video: coherencia final
  let videoTipo = input.videoTipo;
  let videoUrl: string | null = null;
  let videoPath: string | null = null;
  if (videoTipo === "youtube") {
    const ytId = extraerYoutubeId(input.videoUrl ?? "");
    if (!ytId) return { ok: false, error: "Pegá un link válido de YouTube." };
    videoUrl = `https://www.youtube.com/watch?v=${ytId}`;
  } else if (videoTipo === "mp4") {
    videoPath = input.videoPath;
    if (!videoPath) return { ok: false, error: "Falta subir el archivo de video MP4." };
  } else {
    videoTipo = null;
  }

  const resumen = input.resumen.trim() || resumenAutomatico(input.contenido);
  const ahora = new Date().toISOString();

  const payload = {
    categoria_id: input.categoriaId,
    titulo: input.titulo.trim(),
    slug,
    resumen,
    contenido: sanitizarHtml(input.contenido),
    portada_path: input.portadaPath,
    galeria: input.galeria,
    video_tipo: videoTipo,
    video_url: videoUrl,
    video_path: videoPath,
    destacada: input.destacada,
    estado: estadoDestino,
    publicar_at: estadoDestino === "programada" ? input.publicarAt : null,
    vence_at: input.venceAt || null,
    publicada_at: estadoDestino === "publicada" ? ahora : null,
    updated_at: ahora,
  };

  // Destacada única: si esta va destacada, se la quitamos a la anterior
  if (input.destacada) {
    let quitar = supabase.from("news").update({ destacada: false }).eq("destacada", true);
    if (input.id) quitar = quitar.neq("id", input.id);
    await quitar;
  }

  if (input.id) {
    const { data: anterior } = await supabase
      .from("news")
      .select("titulo, estado")
      .eq("id", input.id)
      .single();
    const { error } = await supabase.from("news").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    await auditar(supabase, user.id, "noticia_actualizada", anterior, {
      id: input.id,
      titulo: payload.titulo,
      estado: estadoDestino,
    });
    revalidarNoticias();
    return { ok: true, id: input.id };
  }

  const { data: creada, error } = await supabase
    .from("news")
    .insert({ ...payload, creado_por: user.id })
    .select("id")
    .single();
  if (error || !creada) {
    return { ok: false, error: `No se pudo crear la noticia: ${error?.message ?? "error desconocido"}` };
  }
  await auditar(supabase, user.id, "noticia_creada", null, {
    id: creada.id,
    titulo: payload.titulo,
    estado: estadoDestino,
  });
  revalidarNoticias();
  return { ok: true, id: creada.id as string };
}

// ---------------------------------------------------------------------------
// ADMIN — CAMBIOS DE ESTADO RÁPIDOS
// ---------------------------------------------------------------------------

export type AccionEstadoNoticia = "publicar" | "despublicar" | "archivar" | "a_borrador";

export async function cambiarEstadoNoticia(
  id: string,
  accion: AccionEstadoNoticia
): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();
  const ahora = new Date().toISOString();

  const { data: actual } = await supabase
    .from("news")
    .select("estado, titulo")
    .eq("id", id)
    .single();
  if (!actual) return { ok: false, error: "No encontré la noticia." };

  const update: Record<string, unknown> = { updated_at: ahora };
  if (accion === "publicar") {
    update.estado = "publicada";
    update.publicada_at = ahora;
    update.publicar_at = null;
  } else if (accion === "despublicar" || accion === "archivar") {
    update.estado = "archivada";
  } else if (accion === "a_borrador") {
    update.estado = "borrador";
    update.publicada_at = null;
    update.publicar_at = null;
  }

  const { error } = await supabase.from("news").update(update).eq("id", id);
  if (error) return { ok: false, error: `No se pudo cambiar el estado: ${error.message}` };

  await auditar(
    supabase,
    user.id,
    "noticia_estado",
    { id, estado: actual.estado },
    { accion, estado: update.estado }
  );
  revalidarNoticias();
  return { ok: true };
}

/** Borrado definitivo: SOLO borradores (lo publicado se archiva, no se pierde). */
export async function eliminarNoticia(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { data: noticia } = await supabase
    .from("news")
    .select("estado, titulo, portada_path, galeria, video_tipo, video_path")
    .eq("id", id)
    .single();
  if (!noticia) return { ok: false, error: "No encontré la noticia." };
  if (noticia.estado !== "borrador") {
    return {
      ok: false,
      error: "Solo se pueden borrar borradores. Si ya fue publicada, archivala.",
    };
  }

  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };

  // Limpieza best-effort de archivos asociados en el bucket
  try {
    const paths: string[] = [];
    if (noticia.portada_path) paths.push(noticia.portada_path as string);
    if (Array.isArray(noticia.galeria)) {
      paths.push(...(noticia.galeria as unknown[]).filter((p): p is string => typeof p === "string"));
    }
    if (noticia.video_tipo === "mp4" && noticia.video_path) paths.push(noticia.video_path as string);
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  } catch {
    /* si falla la limpieza, la noticia igual quedó borrada */
  }

  await auditar(supabase, user.id, "noticia_eliminada", { id, titulo: noticia.titulo }, null);
  revalidarNoticias();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN — ARCHIVOS (portada, galería, video MP4)
// ---------------------------------------------------------------------------

/** Sube una imagen (portada/galería) o un video MP4 al bucket público. */
export async function subirArchivoNoticia(
  formData: FormData
): Promise<{ ok: boolean; error?: string; path?: string; url?: string }> {
  const { supabase } = await requerirAdmin();

  const archivo = formData.get("archivo");
  const tipo = formData.get("tipo"); // 'imagen' | 'video'
  const newsId = (formData.get("newsId") as string | null) ?? "sin-asignar";

  if (!(archivo instanceof File)) return { ok: false, error: "No llegó ningún archivo." };
  if (tipo !== "imagen" && tipo !== "video") return { ok: false, error: "Tipo de archivo inválido." };

  const ext = archivo.name.toLowerCase().split(".").pop() ?? "";
  if (tipo === "imagen" && !["jpg", "jpeg", "png", "webp"].includes(ext)) {
    return { ok: false, error: "La imagen tiene que ser JPG, PNG o WebP." };
  }
  if (tipo === "video" && ext !== "mp4") {
    return { ok: false, error: "El video tiene que ser un archivo MP4." };
  }

  const nombreSeguro = archivo.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
  const path = `${newsId}/${Date.now()}-${nombreSeguro}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, archivo, {
    contentType: archivo.type,
    upsert: false,
  });
  if (error) return { ok: false, error: `No se pudo subir el archivo: ${error.message}` };

  return { ok: true, path, url: urlPublica(path) ?? undefined };
}

/** Quita un archivo del bucket (al destildar portada, foto de galería o video). */
export async function eliminarArchivoNoticia(path: string): Promise<{ ok: boolean }> {
  const { supabase } = await requerirAdmin();
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    /* best-effort */
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN — CATEGORÍAS (configurables, con color)
// ---------------------------------------------------------------------------

export async function guardarCategoriaNoticia(input: {
  id?: string;
  nombre: string;
  color: string;
  orden: number;
}): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const nombre = input.nombre.trim();
  if (nombre.length < 3 || nombre.length > 40) {
    return { ok: false, error: "El nombre de la categoría tiene que tener entre 3 y 40 caracteres." };
  }

  if (input.id) {
    const { error } = await supabase
      .from("news_categories")
      .update({ nombre, color: input.color, orden: input.orden })
      .eq("id", input.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    await auditar(supabase, user.id, "categoria_noticia_actualizada", null, input);
  } else {
    const { error } = await supabase
      .from("news_categories")
      .insert({ nombre, color: input.color, orden: input.orden });
    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        return { ok: false, error: "Ya existe una categoría con ese nombre." };
      }
      return { ok: false, error: `No se pudo crear: ${error.message}` };
    }
    await auditar(supabase, user.id, "categoria_noticia_creada", null, input);
  }

  revalidarNoticias();
  return { ok: true };
}

export async function eliminarCategoriaNoticia(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { count } = await supabase
    .from("news")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Hay ${count} noticia(s) con esta categoría. Reasignalas antes de borrarla.`,
    };
  }

  const { error } = await supabase.from("news_categories").delete().eq("id", id);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };

  await auditar(supabase, user.id, "categoria_noticia_eliminada", { id }, null);
  revalidarNoticias();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// ADMIN — ESTADÍSTICAS DE CONTENIDO
// ---------------------------------------------------------------------------

export async function obtenerEstadisticasNoticias(): Promise<EstadisticasNoticias> {
  const { supabase } = await requerirAdmin();

  const [{ data: filas }, { data: vistasMes }] = await Promise.all([
    supabase.from("news").select("*, news_categories(nombre, color)"),
    supabase
      .from("news_views")
      .select("created_at")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const noticias = ((filas ?? []) as unknown as FilaNews[]).map(mapearNoticiaAdmin);

  const totales: KpisNoticias = {
    total: noticias.length,
    publicadas: noticias.filter((n) => n.estado === "publicada").length,
    borradores: noticias.filter((n) => n.estado === "borrador").length,
    programadas: noticias.filter((n) => n.estado === "programada").length,
    archivadas: noticias.filter((n) => n.estado === "archivada").length,
    vistasTotales: noticias.reduce((acc, n) => acc + n.vistas, 0),
    likesTotales: noticias.reduce((acc, n) => acc + n.likes, 0),
  };

  const top = (campo: "vistas" | "likes"): TopNoticia[] =>
    [...noticias]
      .sort((a, b) => b[campo] - a[campo])
      .slice(0, 5)
      .filter((n) => n[campo] > 0)
      .map((n) => ({ id: n.id, titulo: n.titulo, slug: n.slug, vistas: n.vistas, likes: n.likes }));

  const mapaCategorias = new Map<string, { nombre: string; color: string; cantidad: number; vistas: number; likes: number }>();
  for (const n of noticias) {
    const clave = n.categoriaNombre ?? "Sin categoría";
    const actual = mapaCategorias.get(clave) ?? {
      nombre: clave,
      color: n.categoriaColor ?? "#64748B",
      cantidad: 0,
      vistas: 0,
      likes: 0,
    };
    actual.cantidad += 1;
    actual.vistas += n.vistas;
    actual.likes += n.likes;
    mapaCategorias.set(clave, actual);
  }

  // Vistas por día (últimos 30 días)
  const dias: Array<{ dia: string; vistas: number }> = [];
  const hoy = new Date();
  const conteo = new Map<string, number>();
  for (const v of (vistasMes ?? []) as Array<{ created_at: string }>) {
    const dia = v.created_at.slice(0, 10);
    conteo.set(dia, (conteo.get(dia) ?? 0) + 1);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoy.getTime() - i * 24 * 60 * 60 * 1000);
    const clave = d.toISOString().slice(0, 10);
    dias.push({ dia: clave, vistas: conteo.get(clave) ?? 0 });
  }

  return {
    totales,
    topVistas: top("vistas"),
    topLikes: top("likes"),
    porCategoria: [...mapaCategorias.values()].sort((a, b) => b.vistas - a.vistas),
    vistasPorDia: dias,
  };
}

// ---------------------------------------------------------------------------
// PÚBLICO — LECTURA POR RPCs (datos mínimos, security definer)
// ---------------------------------------------------------------------------

/** Lista pública (página /noticias y home). La destacada viene primera. */
export async function obtenerNoticiasPublicas(): Promise<NoticiaPublicaUI[]> {
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("noticias_publicas");
  if (error || !Array.isArray(data)) return [];

  return (data as Array<Record<string, unknown>>).map((n) => {
    const cat = n.categoria as { nombre: string; color: string } | null;
    return {
      id: String(n.id),
      titulo: String(n.titulo),
      slug: String(n.slug),
      resumen: String(n.resumen),
      portadaUrl: urlPublica((n.portada_path as string | null) ?? null),
      destacada: Boolean(n.destacada),
      publicadaAt: String(n.publicada_at),
      likes: Number(n.likes ?? 0),
      vistas: Number(n.vistas ?? 0),
      categoria: cat ? { nombre: cat.nombre, color: cat.color } : null,
    };
  });
}

/** Detalle por slug + relacionadas (null si no existe o no es visible). */
export async function obtenerNoticiaPublica(slug: string): Promise<NoticiaDetalleUI | null> {
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("noticia_por_slug", { p_slug: slug });
  if (error || !data) return null;

  const raiz = data as { noticia?: Record<string, unknown>; relacionadas?: Array<Record<string, unknown>> };
  if (!raiz.noticia) return null;

  const n = raiz.noticia;
  const cat = n.categoria as { nombre: string; color: string } | null;

  return {
    noticia: {
      id: String(n.id),
      titulo: String(n.titulo),
      slug: String(n.slug),
      resumen: String(n.resumen),
      contenido: String(n.contenido),
      portadaUrl: urlPublica((n.portada_path as string | null) ?? null),
      galeria: mapearGaleria(n.galeria),
      videoTipo: (n.video_tipo as TipoVideoNoticia | null) ?? null,
      videoUrl: (n.video_url as string | null) ?? null,
      videoPublicUrl:
        n.video_tipo === "mp4" ? urlPublica((n.video_path as string | null) ?? null) : null,
      destacada: Boolean(n.destacada),
      publicadaAt: String(n.publicada_at),
      likes: Number(n.likes ?? 0),
      vistas: Number(n.vistas ?? 0),
      categoria: cat ? { nombre: cat.nombre, color: cat.color } : null,
    },
    relacionadas: (raiz.relacionadas ?? []).map((r) => ({
      titulo: String(r.titulo),
      slug: String(r.slug),
      resumen: String(r.resumen),
      portadaUrl: urlPublica((r.portada_path as string | null) ?? null),
      publicadaAt: String(r.publicada_at),
    })),
  };
}

// ---------------------------------------------------------------------------
// PÚBLICO — VISTAS Y LIKES (1 por dispositivo, vía RPCs)
// ---------------------------------------------------------------------------

/**
 * Registra la lectura de la noticia (se llama una vez al abrir el detalle).
 * `dispositivo` es un id anónimo guardado en localStorage por el cliente.
 */
export async function registrarVistaPublica(
  newsId: string,
  dispositivo: string
): Promise<{ ok: boolean; vistas?: number }> {
  if (!dispositivo.trim()) return { ok: false };
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("noticia_registrar_vista", {
    p_news_id: newsId,
    p_dispositivo: dispositivo,
  });
  if (error) return { ok: false };
  return { ok: true, vistas: Number(data ?? 0) };
}

/** Alterna el "me gusta" del dispositivo. Devuelve el estado y el total. */
export async function toggleLikePublico(
  newsId: string,
  dispositivo: string
): Promise<{ ok: boolean; liked?: boolean; likes?: number; error?: string }> {
  if (!dispositivo.trim()) return { ok: false, error: "Dispositivo inválido." };
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("noticia_toggle_like", {
    p_news_id: newsId,
    p_dispositivo: dispositivo,
  });
  if (error || !data) return { ok: false, error: "No se pudo registrar. Probá de nuevo." };
  const r = data as { liked?: boolean; likes?: number };
  return { ok: true, liked: Boolean(r.liked), likes: Number(r.likes ?? 0) };
}
