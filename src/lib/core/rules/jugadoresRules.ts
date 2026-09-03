/**
 * REGLAS DE JUGADORES (Paso 9B)
 * Edad, mayoría de edad y validación de categorías por año de nacimiento.
 * Todo son funciones puras: se prueban con vitest sin tocar la base.
 */

export interface CategoriaConRango {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

// ---------------------------------------------------------------------------
// DOCUMENTOS OBLIGATORIOS DE INSCRIPCIÓN (Paso 10B)
// Sin estos 4 documentos no se puede inscribir al jugador. Las claves se
// guardan en players.documents (jsonb) y los archivos en el bucket
// "documentos-jugadores" con path {clubId}/{playerId}/{clave}.{ext}.
// ---------------------------------------------------------------------------

export const DOCUMENTOS_INSCRIPCION = [
  { clave: "dni", nombre: "DNI (foto o escaneo)" },
  { clave: "cemad_medico", nombre: "CEMAD médico (aptitud física)" },
  { clave: "cemad_autorizacion", nombre: "CEMAD de autorización" },
  { clave: "comprobante_federacion", nombre: "Comprobante de pago de federación" },
] as const;

export type ClaveDocumentoInscripcion = (typeof DOCUMENTOS_INSCRIPCION)[number]["clave"];

/** Cuántos de los documentos obligatorios tiene cargados el jugador (0 a 4). */
export function contarDocumentosRequeridos(
  documents: Record<string, string> | null | undefined
): number {
  const docs = documents ?? {};
  return DOCUMENTOS_INSCRIPCION.filter((d) => docs[d.clave]).length;
}

/** Nombres de los documentos obligatorios que todavía faltan. */
export function documentosFaltantes(
  documents: Record<string, string> | null | undefined
): string[] {
  const docs = documents ?? {};
  return DOCUMENTOS_INSCRIPCION.filter((d) => !docs[d.clave]).map((d) => d.nombre);
}

/** ¿Es menor de 18 años a la fecha de referencia? (sin fecha de nac. → no se sabe → false) */
export function calcularEsMenor(
  fechaNacimiento: string | null | undefined,
  hoy: Date = new Date()
): boolean {
  if (!fechaNacimiento) return false;
  const nac = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nac.getTime())) return false;
  const cumple18 = new Date(nac.getFullYear() + 18, nac.getMonth(), nac.getDate());
  return cumple18 > hoy;
}

/** Edad en años cumplidos a la fecha de referencia (null si la fecha es inválida). */
export function calcularEdad(
  fechaNacimiento: string,
  hoy: Date = new Date()
): number | null {
  const nac = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const cumpleEsteAnio = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (cumpleEsteAnio > hoy) edad--;
  return edad;
}

/** Año de nacimiento desde una fecha ISO (YYYY-MM-DD). */
export function anioDeFecha(fechaIso: string | null | undefined): number | null {
  if (!fechaIso || fechaIso.length < 4) return null;
  const anio = Number(fechaIso.slice(0, 4));
  return Number.isInteger(anio) && anio > 1900 ? anio : null;
}

/**
 * ¿En qué categoría le toca jugar por su año de nacimiento?
 * Devuelve null si ninguna categoría tiene rango configurado o si el año
 * cae fuera de todos los rangos (en ese caso no se bloquea nada).
 */
export function categoriaSugeridaPorAnio(
  anio: number,
  categorias: CategoriaConRango[]
): CategoriaConRango | null {
  const conRango = categorias.filter(
    (c) => c.anio_desde !== null && c.anio_hasta !== null
  );
  if (conRango.length === 0) return null;
  return (
    conRango.find((c) => anio >= (c.anio_desde as number) && anio <= (c.anio_hasta as number)) ??
    null
  );
}

/**
 * Validación de inscripción por año de nacimiento — REGLA ESTRICTA (Paso 10B):
 * el jugador juega SOLO en la categoría de su año. Ni una más grande
 * ("para arriba") ni una más chica.
 *  · Si ninguna categoría tiene rango → no se bloquea nada (ok).
 *  · Si el año cae fuera de todos los rangos → no se bloquea nada (ok).
 *  · Si alguna categoría elegida no es la de su año → error con sugerencia.
 */
export function validarCategoriasPorAnio(
  anio: number,
  seleccionadasIds: string[],
  categorias: CategoriaConRango[]
): { ok: boolean; error?: string } {
  const sugerida = categoriaSugeridaPorAnio(anio, categorias);
  if (!sugerida) return { ok: true }; // sin rangos o fuera de rango: no bloquea

  const seleccionadas = categorias.filter((c) => seleccionadasIds.includes(c.id));
  if (seleccionadas.length === 0) return { ok: true }; // lo valida otra regla

  const otra = seleccionadas.find((c) => c.id !== sugerida.id);
  if (otra) {
    return {
      ok: false,
      error: `Por su año de nacimiento (${anio}), este jugador juega en ${sugerida.name}: no puede inscribirse en ${otra.name} (ni en una categoría más grande ni más chica).`,
    };
  }

  return { ok: true };
}
