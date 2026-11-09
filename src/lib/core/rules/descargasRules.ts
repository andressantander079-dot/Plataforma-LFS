// =============================================================================
// DESCARGAS LFS — Reglas de negocio PURAS y testeables (sin base de datos).
// Dos módulos separados: descargas PÚBLICAS (web) y descargas para CLUBES
// (panel del club). La federación sube todo; clubes y público solo descargan.
// 4 carpetas fijas, historial completo de versiones, contador y fijados.
// =============================================================================

// ---------------------------------------------------------------------------
// 1) ESTRUCTURA: ámbitos y carpetas
// ---------------------------------------------------------------------------

export type AmbitoDescarga = "publico" | "clubes";

export const AMBITO_UI: Record<AmbitoDescarga, { label: string; descripcion: string }> = {
  publico: {
    label: "Descargas públicas",
    descripcion: "Visibles para cualquier visitante del sitio web.",
  },
  clubes: {
    label: "Descargas para clubes",
    descripcion: "Solo visibles para usuarios de clubes y árbitros logueados.",
  },
};

export const CARPETAS_DESCARGAS = ["Reglamentos", "Boletines", "Formularios", "Planillas"] as const;

export type CarpetaDescarga = (typeof CARPETAS_DESCARGAS)[number];

export function esCarpetaValida(carpeta: string): carpeta is CarpetaDescarga {
  return (CARPETAS_DESCARGAS as readonly string[]).includes(carpeta);
}

// ---------------------------------------------------------------------------
// 2) ARCHIVOS: formatos permitidos y tamaño
// ---------------------------------------------------------------------------

export const TAMANO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB por archivo

const EXT_FORMATO: Record<string, string> = {
  pdf: "PDF",
  doc: "DOCX",
  docx: "DOCX",
  xls: "XLSX",
  xlsx: "XLSX",
  jpg: "Imagen",
  jpeg: "Imagen",
  png: "Imagen",
  webp: "Imagen",
};

/** Formato lógico del archivo según su extensión (null = no permitido). */
export function formatoDeArchivo(nombre: string): string | null {
  const partes = nombre.toLowerCase().split(".");
  if (partes.length < 2) return null;
  return EXT_FORMATO[partes[partes.length - 1]] ?? null;
}

/** "1.4 MB" · "820 KB" · "450 B" — para mostrar junto al archivo. */
export function textoTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

/** Error de validación del archivo o null si está bien. */
export function validarArchivoDescarga(nombre: string, bytes: number): string | null {
  if (!formatoDeArchivo(nombre)) {
    return "Formato no permitido. Aceptamos PDF, Word, Excel e imágenes (JPG, PNG, WebP).";
  }
  if (bytes > TAMANO_MAX_BYTES) {
    return "El archivo no puede superar los 10 MB.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// 3) ORDENAMIENTO Y VERSIONADO
// ---------------------------------------------------------------------------

interface Ordenable {
  fijado: boolean;
  orden: number;
  nombre: string;
}

/**
 * Orden de exhibición: primero los FIJADOS (siempre arriba),
 * luego por orden manual y al final alfabético por nombre.
 */
export function ordenarDocumentos<T extends Ordenable>(docs: T[]): T[] {
  return [...docs].sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1;
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

/** Historial: versión más nueva primero. */
export function ordenarVersiones<T extends { version: number }>(versiones: T[]): T[] {
  return [...versiones].sort((a, b) => b.version - a.version);
}

/** Próximo número de versión de un documento (1 si no tiene ninguna). */
export function siguienteVersion(versiones: Array<{ version: number }>): number {
  if (versiones.length === 0) return 1;
  return Math.max(...versiones.map((v) => v.version)) + 1;
}

export function esVersionVigente(version: number, versionVigente: number): boolean {
  return version === versionVigente;
}

// ---------------------------------------------------------------------------
// 4) VALIDACIÓN DEL FORMULARIO DE DOCUMENTO
// ---------------------------------------------------------------------------

export interface InputDocumento {
  nombre: string;
  carpeta: string;
  ambito: string;
  descripcion?: string | null;
}

/** Errores campo→mensaje (vacío = todo correcto). */
export function validarDocumento(input: InputDocumento): Record<string, string> {
  const errores: Record<string, string> = {};

  const nombre = input.nombre.trim();
  if (nombre.length < 4 || nombre.length > 140) {
    errores.nombre = "El nombre tiene que tener entre 4 y 140 caracteres.";
  }

  if (!esCarpetaValida(input.carpeta)) {
    errores.carpeta = "Elegí una carpeta válida.";
  }

  if (input.ambito !== "publico" && input.ambito !== "clubes") {
    errores.ambito = "Ámbito inválido.";
  }

  if (input.descripcion && input.descripcion.trim().length > 280) {
    errores.descripcion = "La descripción no puede superar los 280 caracteres.";
  }

  return errores;
}
