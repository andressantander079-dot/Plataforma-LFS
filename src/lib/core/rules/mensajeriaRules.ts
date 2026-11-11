/**
 * MENSAJERÍA LFS — Reglas de negocio y sanitizer HTML
 * ---------------------------------------------------
 * Módulo puro (sin dependencias de servidor): se usa tanto en las
 * Server Actions como en los componentes de React y en los tests.
 *
 * Incluye:
 *  - sanitizarHtml: sanitizer con lista blanca para el editor tipo Word.
 *  - textoPlanoDeHtml: previews seguros en listas y buscador.
 *  - Tipografías (10 familias), tamaños de fuente, categorías y prioridades.
 *  - Metadata de mensajes: comunicados oficiales, asunto, prioridad, categoría,
 *    bloqueo de respuestas y múltiples adjuntos.
 *  - Validadores de adjuntos (máx. 10 MB) y programación de envíos.
 */

// ---------------------------------------------------------------------------
// 1. CATÁLOGOS DEL EDITOR Y CONFIGURACIÓN DE MENSAJES
// ---------------------------------------------------------------------------

export interface TipografiaOpcion {
  id: string;
  nombre: string;
  cssFamily: string;
  esGoogleFont: boolean;
}

/** Las 10 familias tipográficas oficiales del editor empresarial LFS. */
export const TIPOGRAFIAS_DISPONIBLES: readonly TipografiaOpcion[] = [
  { id: "arial", nombre: "Arial", cssFamily: "Arial, sans-serif", esGoogleFont: false },
  { id: "helvetica", nombre: "Helvetica", cssFamily: "Helvetica, Arial, sans-serif", esGoogleFont: false },
  { id: "roboto", nombre: "Roboto", cssFamily: "Roboto, sans-serif", esGoogleFont: true },
  { id: "open-sans", nombre: "Open Sans", cssFamily: "'Open Sans', sans-serif", esGoogleFont: true },
  { id: "lato", nombre: "Lato", cssFamily: "Lato, sans-serif", esGoogleFont: true },
  { id: "montserrat", nombre: "Montserrat", cssFamily: "Montserrat, sans-serif", esGoogleFont: true },
  { id: "poppins", nombre: "Poppins", cssFamily: "Poppins, sans-serif", esGoogleFont: true },
  { id: "georgia", nombre: "Georgia", cssFamily: "Georgia, serif", esGoogleFont: false },
  { id: "times-new-roman", nombre: "Times New Roman", cssFamily: "'Times New Roman', Times, serif", esGoogleFont: false },
  { id: "verdana", nombre: "Verdana", cssFamily: "Verdana, Geneva, sans-serif", esGoogleFont: false },
] as const;

export interface TamanioFuenteOpcion {
  etiqueta: string;
  valor: string;
}

export const TAMANIOS_FUENTE_DISPONIBLES: readonly TamanioFuenteOpcion[] = [
  { etiqueta: "12 px (Pequeño)", valor: "12px" },
  { etiqueta: "14 px (Normal)", valor: "14px" },
  { etiqueta: "16 px (Mediano)", valor: "16px" },
  { etiqueta: "18 px (Subtítulo)", valor: "18px" },
  { etiqueta: "20 px (Grande)", valor: "20px" },
  { etiqueta: "24 px (Título)", valor: "24px" },
  { etiqueta: "28 px (Destacado)", valor: "28px" },
  { etiqueta: "32 px (Portada)", valor: "32px" },
] as const;

export const CATEGORIAS_MENSAJE = [
  "Institucional",
  "Torneo y Fixture",
  "Tribunal de Disciplina",
  "Tesorería y Aranceles",
  "Arbitraje",
  "Pases y Fichajes",
  "Urgente",
] as const;

export type CategoriaMensaje = (typeof CATEGORIAS_MENSAJE)[number];

export type PrioridadMensaje = "normal" | "importante" | "urgente";

export interface PrioridadConfig {
  id: PrioridadMensaje;
  etiqueta: string;
  descripcion: string;
  badgeClase: string;
  bordeClase: string;
}

export const PRIORIDADES_MENSAJE: Record<PrioridadMensaje, PrioridadConfig> = {
  normal: {
    id: "normal",
    etiqueta: "Normal",
    descripcion: "Comunicación habitual e informativa.",
    badgeClase: "bg-slate-100 text-slate-700 border-slate-200",
    bordeClase: "border-slate-200",
  },
  importante: {
    id: "importante",
    etiqueta: "Importante",
    descripcion: "Requiere atención prioritaria de delegados o árbitros.",
    badgeClase: "bg-amber-50 text-amber-800 border-amber-300",
    bordeClase: "border-amber-300",
  },
  urgente: {
    id: "urgente",
    etiqueta: "Urgente",
    descripcion: "Carácter inmediato o resolución crítica.",
    badgeClase: "bg-red-50 text-red-700 border-red-300",
    bordeClase: "border-red-400",
  },
};

export function esPrioridadValida(val: unknown): val is PrioridadMensaje {
  return val === "normal" || val === "importante" || val === "urgente";
}

// ---------------------------------------------------------------------------
// 2. SANITIZER HTML (lista blanca estricta)
// ---------------------------------------------------------------------------

const ETIQUETAS_PERMITIDAS = new Set([
  "b", "strong", "i", "em", "u", "s", "strike",
  "span", "p", "br", "div",
  "h1", "h2", "h3", "h4",
  "ul", "ol", "li",
  "a", "blockquote", "hr",
]);

/** Etiquetas cuyo contenido completo se descarta (no solo la etiqueta). */
const ETIQUETAS_CON_CONTENIDO_PROHIBIDO = new Set([
  "script", "style", "iframe", "object", "embed", "form",
  "textarea", "select", "button", "input", "svg", "math",
]);

const ESTILOS_PERMITIDOS = new Set([
  "color",
  "background-color",
  "text-align",
  "font-size",
  "font-family",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
  "padding-left",
  "margin-left",
  "line-height",
]);

/** Valores de estilo que nunca pueden pasar (vectores de XSS). */
const PATRON_ESTILO_PELIGROSO = /url\s*\(|expression\s*\(|javascript:|<|>|@import/i;

/** Caracteres seguros para declaración de font-family. */
const PATRON_FONT_FAMILY_SEGURO = /^[a-zA-Z0-9\s,'"-]+$/;

function sanitizarEstilos(style: string): string {
  const declaraciones: string[] = [];
  for (const parte of style.split(";")) {
    const [propiedadCruda, ...resto] = parte.split(":");
    if (!resto.length) continue;
    const propiedad = propiedadCruda.trim().toLowerCase();
    const valor = resto.join(":").trim();
    if (!ESTILOS_PERMITIDOS.has(propiedad)) continue;
    if (!valor || PATRON_ESTILO_PELIGROSO.test(valor)) continue;
    if (propiedad === "font-family" && !PATRON_FONT_FAMILY_SEGURO.test(valor)) {
      continue;
    }
    declaraciones.push(`${propiedad}: ${valor}`);
  }
  return declaraciones.join("; ");
}

function escaparTexto(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escaparAtributo(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizarHref(href: string): string | null {
  const limpio = href.trim().replace(/[\u0000-\u001F\u007F\s]+/g, "");
  if (/^(https?:\/\/|mailto:)/i.test(limpio)) return href.trim();
  return null;
}

const REGEX_ETIQUETA = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>]*)*)>/g;
const REGEX_ATRIBUTO = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

/**
 * Sanitiza el HTML producido por el editor enriquecido.
 * - Elimina etiquetas fuera de la lista blanca (conservando su texto).
 * - Elimina por completo script/style/iframe/etc. CON su contenido.
 * - En <a> solo conserva href http(s)/mailto y fuerza rel/target seguros.
 * - En el resto solo conserva style filtrado por lista blanca de propiedades.
 */
export function sanitizarHtml(html: string): string {
  if (!html) return "";

  let entrada = String(html);

  // 1) Eliminar bloques prohibidos con su contenido (script, style, etc.)
  for (const etiqueta of ETIQUETAS_CON_CONTENIDO_PROHIBIDO) {
    const bloque = new RegExp(
      `<${etiqueta}[^>]*>[\\s\\S]*?<\\/${etiqueta}\\s*>`,
      "gi"
    );
    entrada = entrada.replace(bloque, "");
    // Etiquetas huérfanas de apertura/cierre
    const huerfana = new RegExp(`<\\/?${etiqueta}[^>]*>`, "gi");
    entrada = entrada.replace(huerfana, "");
  }

  // 2) Reconstruir solo las etiquetas permitidas
  let salida = "";
  let cursor = 0;
  REGEX_ETIQUETA.lastIndex = 0;

  let coincidencia: RegExpExecArray | null;
  while ((coincidencia = REGEX_ETIQUETA.exec(entrada)) !== null) {
    // Texto plano antes de la etiqueta → escapado
    salida += escaparTexto(entrada.slice(cursor, coincidencia.index));
    cursor = coincidencia.index + coincidencia[0].length;

    const [, cierre, nombreCrudo, atributosCrudos] = coincidencia;
    const nombre = nombreCrudo.toLowerCase();

    if (!ETIQUETAS_PERMITIDAS.has(nombre)) continue; // se descarta la etiqueta

    if (cierre === "/") {
      // br/hr no tienen cierre real; el resto sí
      if (nombre !== "br" && nombre !== "hr") salida += `</${nombre}>`;
      continue;
    }

    if (nombre === "br" || nombre === "hr") {
      salida += `<${nombre}>`;
      continue;
    }

    // Parsear atributos
    let estilos = "";
    let href: string | null = null;
    REGEX_ATRIBUTO.lastIndex = 0;
    let atributo: RegExpExecArray | null;
    while ((atributo = REGEX_ATRIBUTO.exec(atributosCrudos ?? "")) !== null) {
      const nombreAttr = atributo[1].toLowerCase();
      const valorAttr = atributo[2] ?? atributo[3] ?? atributo[4] ?? "";
      if (nombreAttr === "style") estilos = sanitizarEstilos(valorAttr);
      if (nombre === "a" && nombreAttr === "href") href = sanitizarHref(valorAttr);
    }

    if (nombre === "a") {
      if (!href) {
        // Enlace sin destino seguro → se convierte en <u> para no perder el texto
        salida += "<u>";
        continue;
      }
      salida += `<a href="${escaparAtributo(href)}" target="_blank" rel="noopener noreferrer nofollow">`;
      continue;
    }

    salida += estilos ? `<${nombre} style="${escaparAtributo(estilos)}">` : `<${nombre}>`;
  }

  salida += escaparTexto(entrada.slice(cursor));
  return salida.trim();
}

// ---------------------------------------------------------------------------
// 3. TEXTO PLANO (previews y búsqueda)
// ---------------------------------------------------------------------------

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/** Convierte HTML (ya sanitizado o no) en texto plano legible para previews. */
export function textoPlanoDeHtml(html: string, largoMaximo = 120): string {
  if (!html) return "";
  let texto = String(html)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-4]|blockquote)>/gi, " ")
    .replace(/<[^>]*>/g, "");
  for (const [entidad, caracter] of Object.entries(ENTIDADES)) {
    texto = texto.split(entidad).join(caracter);
  }
  texto = texto.replace(/\s+/g, " ").trim();
  if (texto.length > largoMaximo) return `${texto.slice(0, largoMaximo - 1)}…`;
  return texto;
}

// ---------------------------------------------------------------------------
// 4. METADATA DE MENSAJES (comunicados oficiales)
// ---------------------------------------------------------------------------

export const TIPO_CHAT = "chat";
export const TIPO_COMUNICADO = "comunicado";

export interface AdjuntoMetadata {
  path: string;
  name: string;
  type: string;
  size: number;
}

export interface MetadataMensaje {
  tipo?: string;
  asunto?: string;
  sin_respuestas?: boolean;
  html?: boolean;
  anuncio_id?: string;
  prioridad?: PrioridadMensaje;
  categoria?: string;
  adjuntos?: AdjuntoMetadata[];
  idempotency_key?: string;
  origen?: "club" | "federacion" | string;
}

/** Lee la metadata cruda de la fila (jsonb) con tipos seguros. */
export function leerMetadata(raw: unknown): MetadataMensaje {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const prioridad = esPrioridadValida(obj.prioridad) ? obj.prioridad : undefined;

  let adjuntos: AdjuntoMetadata[] | undefined;
  if (Array.isArray(obj.adjuntos)) {
    adjuntos = obj.adjuntos
      .filter(
        (a): a is Record<string, unknown> =>
          Boolean(a) && typeof a === "object" && typeof (a as Record<string, unknown>).path === "string"
      )
      .map((a) => ({
        path: String(a.path),
        name: typeof a.name === "string" ? a.name : "adjunto",
        type: typeof a.type === "string" ? a.type : "application/octet-stream",
        size: typeof a.size === "number" ? a.size : 0,
      }));
  }

  return {
    tipo: typeof obj.tipo === "string" ? obj.tipo : undefined,
    asunto: typeof obj.asunto === "string" ? obj.asunto : undefined,
    sin_respuestas: obj.sin_respuestas === true,
    html: obj.html === true,
    anuncio_id: typeof obj.anuncio_id === "string" ? obj.anuncio_id : undefined,
    prioridad,
    categoria: typeof obj.categoria === "string" ? obj.categoria : undefined,
    origen: typeof obj.origen === "string" ? obj.origen : undefined,
    adjuntos,
    idempotency_key: typeof obj.idempotency_key === "string" ? obj.idempotency_key : undefined,
  };
}

export function esComunicado(raw: unknown): boolean {
  return leerMetadata(raw).tipo === TIPO_COMUNICADO;
}

/** Un mensaje bloquea respuestas solo si es comunicado marcado sin_respuestas. */
export function bloqueaRespuestas(raw: unknown): boolean {
  const meta = leerMetadata(raw);
  return meta.tipo === TIPO_COMUNICADO && meta.sin_respuestas === true;
}

/**
 * ¿El club/árbitro puede escribir en esta conversación?
 * Regla: si el ÚLTIMO mensaje es un comunicado "sin respuestas",
 * el canal queda en solo lectura hasta que la federación escriba algo nuevo.
 * El admin nunca queda bloqueado.
 */
export function puedeEscribir(params: {
  esAdmin: boolean;
  ultimoMensajeMetadata: unknown;
}): boolean {
  if (params.esAdmin) return true;
  return !bloqueaRespuestas(params.ultimoMensajeMetadata);
}

// ---------------------------------------------------------------------------
// 5. VALIDACIONES DEL COMPOSITOR, ARCHIVOS (10 MB) Y PROGRAMACIÓN
// ---------------------------------------------------------------------------

export const LARGO_MIN_ASUNTO = 3;
export const LARGO_MAX_ASUNTO = 120;
export const LARGO_MAX_CUERPO_HTML = 50_000;
export const MAX_BYTES_ADJUNTO = 10 * 1024 * 1024; // 10 MB

export const TIPOS_MIME_ADJUNTOS_PERMITIDOS = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

export function validarAsunto(asunto: string): { ok: boolean; error?: string } {
  const limpio = asunto.trim();
  if (limpio.length < LARGO_MIN_ASUNTO) {
    return { ok: false, error: `El asunto necesita al menos ${LARGO_MIN_ASUNTO} caracteres.` };
  }
  if (limpio.length > LARGO_MAX_ASUNTO) {
    return { ok: false, error: `El asunto no puede superar ${LARGO_MAX_ASUNTO} caracteres.` };
  }
  return { ok: true };
}

export function validarCuerpoHtml(html: string): { ok: boolean; error?: string } {
  if (html.length > LARGO_MAX_CUERPO_HTML) {
    return { ok: false, error: "El mensaje es demasiado largo." };
  }
  if (!textoPlanoDeHtml(html, 10).trim()) {
    return { ok: false, error: "Escribí el cuerpo del mensaje." };
  }
  return { ok: true };
}

export function validarArchivoAdjunto(archivo: {
  name: string;
  type: string;
  size: number;
}): { ok: boolean; error?: string } {
  if (!archivo || archivo.size <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (archivo.size > MAX_BYTES_ADJUNTO) {
    return {
      ok: false,
      error: `El archivo "${archivo.name}" supera el límite máximo de 10 MB.`,
    };
  }
  const mime = archivo.type.toLowerCase();
  if (!TIPOS_MIME_ADJUNTOS_PERMITIDOS.has(mime)) {
    return {
      ok: false,
      error: "Formato no permitido. Solo se aceptan imágenes JPG, JPEG, PNG, WEBP o documentos PDF.",
    };
  }
  return { ok: true };
}

export function formatearTamanioArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function validarFechaProgramada(
  fechaIso: string,
  ahora: Date = new Date()
): { ok: boolean; fecha?: Date; error?: string } {
  if (!fechaIso || !fechaIso.trim()) {
    return { ok: false, error: "Seleccioná la fecha y hora de programación." };
  }
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) {
    return { ok: false, error: "La fecha y hora ingresadas no son válidas." };
  }
  // Al menos 1 minuto en el futuro
  if (fecha.getTime() <= ahora.getTime() + 30_000) {
    return {
      ok: false,
      error: "La fecha y hora de programación deben ser futuras.",
    };
  }
  return { ok: true, fecha };
}
