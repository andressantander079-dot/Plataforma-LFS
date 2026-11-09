// =============================================================================
// NOTICIAS LFS — Reglas de negocio PURAS y testeables (sin base de datos).
// Cubre: slugs limpios para SEO, lectura estimada, visibilidad pública con
// programación y vencimiento, estados derivados, videos de YouTube/MP4,
// validaciones del editor y paleta de colores de categorías.
// =============================================================================

// ---------------------------------------------------------------------------
// 1) ESTADOS Y SU PRESENTACIÓN
// ---------------------------------------------------------------------------

/** Estados guardados en la base (news.estado). */
export type EstadoNoticia = "borrador" | "programada" | "publicada" | "archivada";

/**
 * Estados que se MUESTRAN: incluye "vencida", que no se guarda en la base
 * (se deriva de vence_at al vuelo: una publicada vencida se archiva sola,
 * pero mientras tanto la mostramos como vencida en el panel).
 */
export type EstadoDerivadoNoticia = EstadoNoticia | "vencida";

export const ESTADO_NOTICIA_UI: Record<
  EstadoDerivadoNoticia,
  { label: string; badge: string }
> = {
  borrador:   { label: "Borrador",   badge: "bg-slate-100 text-slate-600 border-slate-300" },
  programada: { label: "Programada", badge: "bg-sky-50 text-sky-700 border-sky-300" },
  publicada:  { label: "Publicada",  badge: "bg-emerald-50 text-emerald-700 border-emerald-300" },
  vencida:    { label: "Vencida",    badge: "bg-amber-50 text-amber-700 border-amber-300" },
  archivada:  { label: "Archivada",  badge: "bg-slate-100 text-slate-500 border-slate-200" },
};

// ---------------------------------------------------------------------------
// 2) SLUGS (URLs limpias: /noticias/copa-de-campeones-2026)
// ---------------------------------------------------------------------------

/**
 * Convierte un título en slug URL-safe: minúsculas, sin tildes ni ñ,
 * cualquier otro caracter pasa a guion, sin guiones repetidos ni en los bordes.
 * Ej.: "¡Copa de Campeones — Femenino 2026!" → "copa-de-campeones-femenino-2026"
 */
export function slugify(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tildes y diacríticos
    .replace(/ñ/gi, (l) => (l === "Ñ" ? "N" : "n"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Slug válido: letras minúsculas, números y guiones simples. */
export function esSlugValido(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80;
}

// ---------------------------------------------------------------------------
// 3) CONTENIDO: lectura estimada y resumen automático
// ---------------------------------------------------------------------------

/** Quita etiquetas HTML y entidades básicas, dejando texto plano legible. */
export function limpiarHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tiempo de lectura estimado en minutos (200 palabras por minuto,
 * mínimo 1). Ej.: noticia de 450 palabras → 3 min.
 */
export function tiempoLecturaMin(contenidoHtml: string): number {
  const palabras = limpiarHtml(contenidoHtml).split(" ").filter(Boolean).length;
  if (palabras === 0) return 1;
  return Math.max(1, Math.ceil(palabras / 200));
}

/** Resumen automático a partir del contenido cuando el admin no carga uno. */
export function resumenAutomatico(contenidoHtml: string, max = 220): string {
  const texto = limpiarHtml(contenidoHtml);
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(" ");
  return (ultimoEspacio > 60 ? corte.slice(0, ultimoEspacio) : corte).trim() + "…";
}

// ---------------------------------------------------------------------------
// 4) VISIBILIDAD PÚBLICA Y ESTADO DERIVADO
// ---------------------------------------------------------------------------

export interface NoticiaFechas {
  estado: EstadoNoticia;
  publicar_at: string | null;
  vence_at: string | null;
  publicada_at: string | null;
  created_at?: string;
}

/**
 * ¿La ve el público? Misma regla que usan los RPCs SQL:
 * - tiene que estar 'publicada' (las programadas las activa la autocuración)
 * - si tiene vencimiento, todavía no tiene que haber llegado
 */
export function esVisiblePublica(n: NoticiaFechas, ahora: Date = new Date()): boolean {
  if (n.estado !== "publicada") return false;
  if (n.vence_at && new Date(n.vence_at) <= ahora) return false;
  return true;
}

/**
 * Estado para MOSTRAR en el panel admin:
 * una publicada cuyo vencimiento ya pasó se muestra como "vencida"
 * (la autocuración la archivará en la próxima lectura).
 */
export function estadoDerivado(n: NoticiaFechas, ahora: Date = new Date()): EstadoDerivadoNoticia {
  if (
    (n.estado === "publicada" || n.estado === "programada") &&
    n.vence_at &&
    new Date(n.vence_at) <= ahora
  ) {
    return "vencida";
  }
  return n.estado;
}

// ---------------------------------------------------------------------------
// 5) VIDEO: YouTube o MP4
// ---------------------------------------------------------------------------

export type TipoVideoNoticia = "youtube" | "mp4";

/**
 * Extrae el ID de un video de YouTube aceptando todos los formatos comunes:
 * watch?v=ID · youtu.be/ID · /embed/ID · /shorts/ID · /live/ID · ID crudo.
 */
export function extraerYoutubeId(url: string): string | null {
  const limpia = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(limpia)) return limpia;
  const patrones = [
    /youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patrones) {
    const m = limpia.match(p);
    if (m) return m[1];
  }
  return null;
}

export function urlEmbedYoutube(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}

// ---------------------------------------------------------------------------
// 6) CATEGORÍAS: paleta de colores sugerida
// ---------------------------------------------------------------------------

export const COLORES_CATEGORIA = [
  "#F97316", // naranja LFS
  "#1A2A44", // azul marino LFS
  "#DC2626", // rojo
  "#0F766E", // verde azulado
  "#7C3AED", // violeta
  "#0369A1", // celeste
  "#B45309", // ámbar
  "#BE185D", // rosa
] as const;

export function esColorValido(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

// ---------------------------------------------------------------------------
// 7) LÍMITES Y VALIDACIONES
// ---------------------------------------------------------------------------

export const GALERIA_MAX = 6;
export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024;   // 5 MB por foto
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;  // 100 MB por MP4

const EXT_IMAGEN = ["jpg", "jpeg", "png", "webp"];

export function extensionDe(nombre: string): string {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes[partes.length - 1] : "";
}

/** Error de validación de imagen (portada/galería) o null si está bien. */
export function validarImagen(nombre: string, bytes: number): string | null {
  if (!EXT_IMAGEN.includes(extensionDe(nombre))) {
    return "La imagen tiene que ser JPG, PNG o WebP.";
  }
  if (bytes > IMAGEN_MAX_BYTES) {
    return "La imagen no puede superar los 5 MB.";
  }
  return null;
}

/** Error de validación del video MP4 o null si está bien. */
export function validarVideo(nombre: string, bytes: number): string | null {
  if (extensionDe(nombre) !== "mp4") {
    return "El video tiene que ser un archivo MP4.";
  }
  if (bytes > VIDEO_MAX_BYTES) {
    return "El video no puede superar los 100 MB. Si es más largo, subilo a YouTube y pegá el link.";
  }
  return null;
}

export interface InputNoticia {
  titulo: string;
  slug?: string;
  resumen: string;
  contenido: string;
  categoriaId?: string | null;
  galeria?: string[];
  videoTipo?: TipoVideoNoticia | null;
  videoUrl?: string | null;
  videoPath?: string | null;
  estado?: EstadoNoticia;
  publicarAt?: string | null;
  venceAt?: string | null;
}

/**
 * Valida el formulario de noticia. Devuelve un objeto campo→mensaje
 * (vacío = todo correcto). Mismo criterio en cliente y server action.
 */
export function validarNoticia(input: InputNoticia): Record<string, string> {
  const errores: Record<string, string> = {};

  const titulo = input.titulo.trim();
  if (titulo.length < 5 || titulo.length > 140) {
    errores.titulo = "El título tiene que tener entre 5 y 140 caracteres.";
  }

  if (input.slug !== undefined && input.slug !== "" && !esSlugValido(input.slug)) {
    errores.slug = "La URL solo puede tener letras minúsculas, números y guiones.";
  }

  const resumen = input.resumen.trim();
  if (resumen.length < 10 || resumen.length > 280) {
    errores.resumen = "El resumen tiene que tener entre 10 y 280 caracteres.";
  }

  if (limpiarHtml(input.contenido).length < 20) {
    errores.contenido = "El contenido es muy corto: contá la noticia con un poco más de detalle.";
  }

  if ((input.galeria?.length ?? 0) > GALERIA_MAX) {
    errores.galeria = `La galería admite hasta ${GALERIA_MAX} fotos.`;
  }

  // Coherencia del video
  if (input.videoTipo === "youtube") {
    if (!input.videoUrl || !extraerYoutubeId(input.videoUrl)) {
      errores.video = "Pegá un link válido de YouTube.";
    }
  } else if (input.videoTipo === "mp4") {
    if (!input.videoPath) {
      errores.video = "Falta subir el archivo de video MP4.";
    }
  }

  // Coherencia de fechas y estado
  if (input.estado === "programada") {
    if (!input.publicarAt) {
      errores.publicarAt = "Indicá la fecha y hora de publicación.";
    }
  }
  if (input.publicarAt && input.venceAt) {
    if (new Date(input.venceAt) <= new Date(input.publicarAt)) {
      errores.venceAt = "El vencimiento tiene que ser posterior a la publicación.";
    }
  }

  return errores;
}
