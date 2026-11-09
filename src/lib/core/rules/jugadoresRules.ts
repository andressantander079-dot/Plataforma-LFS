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

export type EstadoJugador = "pendiente" | "activo" | "en_deuda" | "denegado" | "inactivo";

/**
 * ¿Puede este jugador ser incluido en la planilla del partido?
 *  · 'activo': aprobado por la federación.
 *  · 'en_deuda': habilitado temporalmente con deuda hasta el cierre del período.
 *  · 'pendiente', 'denegado', 'inactivo': NO pueden jugar.
 */
export function puedeJugarEnPlanilla(status: EstadoJugador | string | null | undefined): boolean {
  return status === "activo" || status === "en_deuda";
}

export function estadoJugadorInfo(status: EstadoJugador | string | null | undefined): {
  clave: EstadoJugador;
  label: string;
  badgeClase: string;
  descripcion: string;
} {
  switch (status) {
    case "en_deuda":
      return {
        clave: "en_deuda",
        label: "En deuda",
        badgeClase: "bg-orange-100 text-orange-900 border-orange-200",
        descripcion: "Habilitado temporalmente hasta que se cierre el período de inscripción.",
      };
    case "denegado":
      return {
        clave: "denegado",
        label: "Denegado",
        badgeClase: "bg-red-100 text-red-800 border-red-200",
        descripcion: "Inscripción denegada por la federación. No puede ser incluido en planillas.",
      };
    case "inactivo":
      return {
        clave: "inactivo",
        label: "Inactivo",
        badgeClase: "bg-slate-100 text-slate-600 border-slate-200",
        descripcion: "Jugador dado de baja o inactivo.",
      };
    case "pendiente":
      return {
        clave: "pendiente",
        label: "Pendiente LFS",
        badgeClase: "bg-amber-100 text-amber-900 border-amber-200",
        descripcion: "Enviado a Trámites en la federación. Esperando aprobación.",
      };
    case "activo":
    default:
      return {
        clave: "activo",
        label: "Activo",
        badgeClase: "bg-green-100 text-green-800 border-green-200",
        descripcion: "Aprobado por la federación. Habilitado para disputar partidos.",
      };
  }
}

/** Cuántos de los documentos obligatorios tiene cargados el jugador (0 a 4). */
export function contarDocumentosRequeridos(
  documents: Record<string, string> | null | undefined
): number {
  const docs = documents ?? {};
  return DOCUMENTOS_INSCRIPCION.filter((d) => docs[d.clave]).length;
}

/**
 * Tipos de documento que se pueden subir a la ficha de un jugador: los 4 de la
 * federación (Paso 10B) más los 3 del Paso 3, que se conservan para no perder
 * archivos de jugadores cargados antes.
 */
export type TipoDocumentoPlantel = ClaveDocumentoInscripcion | "medical" | "ddjj" | "photo";

/** Resumen del plantel por estado: alimenta los contadores de la pantalla del admin. */
export interface ResumenPlantel {
  total: number;
  pendientes: number;
  enDeuda: number;
  activos: number;
  denegados: number;
  inactivos: number;
  /** Pueden ir a planilla: activos + en deuda. */
  habilitados: number;
  /** Jugadores vigentes (no inactivos) con menos de los 4 documentos obligatorios. */
  conDocsIncompletos: number;
}

export function resumirPlantel(
  jugadores: {
    status: EstadoJugador | string | null | undefined;
    documents: Record<string, string> | null | undefined;
  }[]
): ResumenPlantel {
  const r: ResumenPlantel = {
    total: jugadores.length,
    pendientes: 0,
    enDeuda: 0,
    activos: 0,
    denegados: 0,
    inactivos: 0,
    habilitados: 0,
    conDocsIncompletos: 0,
  };

  for (const j of jugadores) {
    const estado = estadoJugadorInfo(j.status).clave;
    if (estado === "pendiente") r.pendientes++;
    else if (estado === "en_deuda") r.enDeuda++;
    else if (estado === "denegado") r.denegados++;
    else if (estado === "inactivo") r.inactivos++;
    else r.activos++;

    if (puedeJugarEnPlanilla(estado)) r.habilitados++;
    if (estado !== "inactivo" && contarDocumentosRequeridos(j.documents) < DOCUMENTOS_INSCRIPCION.length) {
      r.conDocsIncompletos++;
    }
  }
  return r;
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
