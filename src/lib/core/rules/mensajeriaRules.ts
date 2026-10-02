/**
 * MENSAJERÍA LFS — Reglas de negocio y sanitizer HTML
 * ---------------------------------------------------
 * Módulo puro (sin dependencias de servidor): se usa tanto en las
 * Server Actions como en los componentes de React y en los tests.
 *
 * Incluye:
 *  - sanitizarHtml: sanitizer con lista blanca para el editor tipo Word.
 *  - textoPlanoDeHtml: previews seguros en listas y buscador.
 *  - Metadata de mensajes: comunicados oficiales, asunto, sin respuestas.
 */

// ---------------------------------------------------------------------------
// 1. SANITIZER HTML (lista blanca estricta)
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
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

/** Valores de estilo que nunca pueden pasar (vectores de XSS). */
const PATRON_ESTILO_PELIGROSO = /url\s*\(|expression\s*\(|javascript:|<|>|@import/i;

function sanitizarEstilos(style: string): string {
  const declaraciones: string[] = [];
  for (const parte of style.split(";")) {
    const [propiedadCruda, ...resto] = parte.split(":");
    if (!resto.length) continue;
    const propiedad = propiedadCruda.trim().toLowerCase();
    const valor = resto.join(":").trim();
    if (!ESTILOS_PERMITIDOS.has(propiedad)) continue;
    if (!valor || PATRON_ESTILO_PELIGROSO.test(valor)) continue;
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
// 2. TEXTO PLANO (previews y búsqueda)
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
// 3. METADATA DE MENSAJES (comunicados oficiales)
// ---------------------------------------------------------------------------

export const TIPO_CHAT = "chat";
export const TIPO_COMUNICADO = "comunicado";

export interface MetadataMensaje {
  tipo?: string;
  asunto?: string;
  sin_respuestas?: boolean;
  html?: boolean;
  anuncio_id?: string;
}

/** Lee la metadata cruda de la fila (jsonb) con tipos seguros. */
export function leerMetadata(raw: unknown): MetadataMensaje {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  return {
    tipo: typeof obj.tipo === "string" ? obj.tipo : undefined,
    asunto: typeof obj.asunto === "string" ? obj.asunto : undefined,
    sin_respuestas: obj.sin_respuestas === true,
    html: obj.html === true,
    anuncio_id: typeof obj.anuncio_id === "string" ? obj.anuncio_id : undefined,
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
// 4. VALIDACIONES DEL COMPOSITOR
// ---------------------------------------------------------------------------

export const LARGO_MIN_ASUNTO = 3;
export const LARGO_MAX_ASUNTO = 120;
export const LARGO_MAX_CUERPO_HTML = 50_000;

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
