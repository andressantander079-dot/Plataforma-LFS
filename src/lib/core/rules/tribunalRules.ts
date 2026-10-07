/**
 * TRIBUNAL DE DISCIPLINA LFS — Reglas de negocio (puras y testeadas)
 * ------------------------------------------------------------------
 * Motor de decisiones del tribunal: plazos de apelación, estados de
 * sanción, validaciones de sanciones manuales y textos de la UI.
 * Sin dependencias de servidor: se usa en actions, componentes y tests.
 */

// ---------------------------------------------------------------------------
// 1. CONSTANTES
// ---------------------------------------------------------------------------

/** Plazo para apelar una sanción: 72 horas desde que se carga (decisión del usuario). */
export const PLAZO_APELACION_HORAS = 72;

export const TIPOS_SANCIONADO = ["jugador", "cuerpo_tecnico", "club"] as const;
export type TipoSancionado = (typeof TIPOS_SANCIONADO)[number];

export const ETIQUETA_TIPO_SANCIONADO: Record<TipoSancionado, string> = {
  jugador: "Jugador",
  cuerpo_tecnico: "Cuerpo técnico",
  club: "Club (institucional)",
};

// ---------------------------------------------------------------------------
// 2. ESTADO DE UNA SANCION
// ---------------------------------------------------------------------------

export type EstadoSancion = "activa" | "cumplida" | "anulada";

export function estadoSancion(s: {
  anulada_at: string | null;
  partidos_pendientes: number;
}): EstadoSancion {
  if (s.anulada_at) return "anulada";
  if (s.partidos_pendientes > 0) return "activa";
  return "cumplida";
}

export const ESTADO_SANCION_UI: Record<
  EstadoSancion,
  { label: string; clases: string }
> = {
  activa: {
    label: "Activa",
    clases: "bg-red-50 text-red-700 border-red-200",
  },
  cumplida: {
    label: "Cumplida",
    clases: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  anulada: {
    label: "Anulada",
    clases: "bg-slate-100 text-slate-500 border-slate-200",
  },
};

/** Nombres legibles para los motivos históricos del motor automático (7B). */
export function motivoLegible(motivo: string): string {
  if (motivo === "roja") return "Roja directa (automática)";
  if (motivo === "acumulacion_amarillas") return "Acumulación de amarillas (automática)";
  return motivo;
}

// ---------------------------------------------------------------------------
// 3. APELACIONES (plazo 72 hs, una sola por sanción)
// ---------------------------------------------------------------------------

/** Fecha/hora límite para apelar (created_at de la sanción + 72 hs). */
export function calcularLimiteApelacion(creadaAtIso: string): Date {
  return new Date(
    new Date(creadaAtIso).getTime() + PLAZO_APELACION_HORAS * 60 * 60 * 1000
  );
}

export interface ResultadoApelacion {
  ok: boolean;
  motivo?: string;
}

/**
 * ¿El club puede apelar esta sanción ahora?
 * Reglas: no anulada, sin apelación previa, dentro de las 72 hs.
 * (La sanción SE CUMPLE igual mientras se evalúa — decisión del usuario.)
 */
export function puedeApelar(params: {
  creadaAtIso: string;
  ahora?: Date;
  yaApelo: boolean;
  anulada: boolean;
}): ResultadoApelacion {
  if (params.anulada) {
    return { ok: false, motivo: "La sanción ya fue anulada por la federación." };
  }
  if (params.yaApelo) {
    return { ok: false, motivo: "Esta sanción ya tiene una apelación presentada." };
  }
  const ahora = params.ahora ?? new Date();
  if (ahora > calcularLimiteApelacion(params.creadaAtIso)) {
    return {
      ok: false,
      motivo: `El plazo de ${PLAZO_APELACION_HORAS} hs para apelar ya venció.`,
    };
  }
  return { ok: true };
}

export type EstadoApelacion = "pendiente" | "aceptada" | "rechazada";

export const ESTADO_APELACION_UI: Record<
  EstadoApelacion,
  { label: string; clases: string }
> = {
  pendiente: {
    label: "Pendiente de fallo",
    clases: "bg-amber-50 text-amber-700 border-amber-200",
  },
  aceptada: {
    label: "Aceptada",
    clases: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  rechazada: {
    label: "Rechazada",
    clases: "bg-red-50 text-red-700 border-red-200",
  },
};

// ---------------------------------------------------------------------------
// 4. MULTAS (estado del cargo en tesorería, como lo ve el club)
// ---------------------------------------------------------------------------

export type EstadoMulta = "sin_multa" | "pendiente" | "parcial" | "pagado" | "anulado";

export const ESTADO_MULTA_UI: Record<
  EstadoMulta,
  { label: string; clases: string }
> = {
  sin_multa: { label: "Sin multa", clases: "bg-slate-100 text-slate-500 border-slate-200" },
  pendiente: { label: "Pendiente de pago", clases: "bg-amber-50 text-amber-700 border-amber-200" },
  parcial: { label: "Pago parcial", clases: "bg-sky-50 text-sky-700 border-sky-200" },
  pagado: { label: "Pagada", clases: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  anulado: { label: "Multa anulada", clases: "bg-slate-100 text-slate-500 border-slate-200" },
};

/** Formato de moneda argentino para montos del tribunal. */
export function formatoPesos(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
}

// ---------------------------------------------------------------------------
// 5. VALIDACIONES DEL TRIBUNAL
// ---------------------------------------------------------------------------

export interface SancionManualInput {
  sancionadoTipo: TipoSancionado;
  playerId: string | null;
  nombreLibre: string; // DT u otro integrante sin ficha de jugador
  clubId: string;
  infraccion: string;
  fechas: number;
  montoMulta: number;
}

export function validarSancionManual(input: SancionManualInput): {
  ok: boolean;
  error?: string;
} {
  if (!TIPOS_SANCIONADO.includes(input.sancionadoTipo)) {
    return { ok: false, error: "Tipo de sancionado inválido." };
  }
  if (!input.clubId) {
    return { ok: false, error: "Elegí el club al que pertenece la sanción." };
  }
  if (input.sancionadoTipo === "jugador" && !input.playerId) {
    return { ok: false, error: "Buscá y elegí al jugador por su DNI." };
  }
  if (input.sancionadoTipo === "cuerpo_tecnico" && input.nombreLibre.trim().length < 3) {
    return { ok: false, error: "Escribí el nombre y apellido del integrante del cuerpo técnico." };
  }
  if (input.infraccion.trim().length < 3) {
    return { ok: false, error: "Elegí una infracción del catálogo o escribí el motivo." };
  }
  if (!Number.isInteger(input.fechas) || input.fechas < 0 || input.fechas > 30) {
    return { ok: false, error: "Las fechas de suspensión deben ser un número entre 0 y 30." };
  }
  if (input.sancionadoTipo === "club" && input.fechas > 0) {
    return { ok: false, error: "Las sanciones institucionales al club no suspenden fechas: usá solo multa." };
  }
  if (input.montoMulta < 0) {
    return { ok: false, error: "La multa no puede ser negativa." };
  }
  if (input.fechas === 0 && input.montoMulta === 0) {
    return { ok: false, error: "La sanción necesita al menos fechas de suspensión o una multa." };
  }
  return { ok: true };
}

/** Modificación de una sanción existente (admin: fechas y/o motivo). */
export function validarModificacionSancion(params: {
  fechas: number;
  infraccion: string;
}): { ok: boolean; error?: string } {
  if (!Number.isInteger(params.fechas) || params.fechas < 0 || params.fechas > 30) {
    return { ok: false, error: "Las fechas deben ser un número entre 0 y 30." };
  }
  if (params.infraccion.trim().length < 3) {
    return { ok: false, error: "El motivo no puede quedar vacío." };
  }
  return { ok: true };
}

export function validarAnulacion(motivo: string): { ok: boolean; error?: string } {
  if (motivo.trim().length < 5) {
    return { ok: false, error: "Explicá el motivo de la anulación (mínimo 5 caracteres)." };
  }
  return { ok: true };
}

export function validarResolucionApelacion(resolucion: string): {
  ok: boolean;
  error?: string;
} {
  if (resolucion.trim().length < 5) {
    return { ok: false, error: "Escribí los fundamentos del fallo (mínimo 5 caracteres)." };
  }
  return { ok: true };
}

export function validarMotivoApelacion(motivo: string): { ok: boolean; error?: string } {
  if (motivo.trim().length < 10) {
    return { ok: false, error: "Contanos por qué apelan (mínimo 10 caracteres)." };
  }
  return { ok: true };
}
