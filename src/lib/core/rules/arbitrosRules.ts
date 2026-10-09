/**
 * REGLAS DEL MÓDULO ÁRBITRO (Paso 16) — funciones PURAS y testeables.
 *
 * De acá salen todas las decisiones de negocio del sector arbitral:
 *  · Disponibilidad (días que NO puede dirigir) y conflictos de horario.
 *  · Estados de la designación (directa / propuesta → pendiente/aceptada/rechazada).
 *  · Estadísticas del árbitro calculadas desde los partidos reales.
 *  · Liquidación mensual de honorarios (partidos × tarifa).
 *  · Validaciones de niveles, eventos y bloques de disponibilidad.
 */

// ---------------------------------------------------------------------------
// 1. DESIGNACIONES
// ---------------------------------------------------------------------------

export type ModoDesignacion = "directa" | "propuesta";
export type EstadoDesignacion = "pendiente" | "aceptada" | "rechazada";

export const ESTADO_DESIGNACION_UI: Record<
  EstadoDesignacion,
  { label: string; className: string }
> = {
  pendiente: {
    label: "Esperando respuesta",
    className: "bg-amber-50 text-amber-700 border border-amber-200",
  },
  aceptada: {
    label: "Aceptada",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  rechazada: {
    label: "Rechazada",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
};

/** Texto corto del estado para mostrar junto al partido. */
export function textoDesignacion(
  modo: ModoDesignacion | null,
  estado: EstadoDesignacion | null
): string {
  if (!modo) return "Sin designar";
  if (modo === "directa") return "Designado";
  if (!estado) return "Propuesto";
  return ESTADO_DESIGNACION_UI[estado].label;
}

/** ¿El árbitro tiene que responder esta designación? */
export function debeResponder(
  modo: ModoDesignacion | null,
  estado: EstadoDesignacion | null
): boolean {
  return modo === "propuesta" && estado === "pendiente";
}

// ---------------------------------------------------------------------------
// 2. DISPONIBILIDAD Y CONFLICTOS
// ---------------------------------------------------------------------------

export interface BloqueNoDisponible {
  desde: string; // 'YYYY-MM-DD'
  hasta: string; // 'YYYY-MM-DD'
  motivo?: string | null;
}

/** ¿El árbitro marcó que NO puede dirigir ese día? */
export function estaBloqueado(
  fechaISO: string | null,
  bloques: BloqueNoDisponible[]
): BloqueNoDisponible | null {
  if (!fechaISO) return null;
  const dia = fechaISO.slice(0, 10);
  for (const b of bloques) {
    if (b.desde <= dia && dia <= b.hasta) return b;
  }
  return null;
}

/** Solapamiento de rangos de fechas (para validar bloques nuevos). */
export function rangosSeSolapan(
  aDesde: string,
  aHasta: string,
  bDesde: string,
  bHasta: string
): boolean {
  return aDesde <= bHasta && bDesde <= aHasta;
}

export interface PartidoHorario {
  id: string;
  scheduled_at: string | null;
}

const VENTANA_CONFLICTO_MIN = 120; // 2 horas entre partidos del mismo árbitro

/**
 * Detecta si el árbitro ya tiene un partido a menos de 2 hs del horario dado.
 * Devuelve el partido en conflicto (si hay). Sin horario cargado → sin conflicto.
 */
export function conflictoHorario(
  partidos: PartidoHorario[],
  fechaISO: string | null,
  excluirMatchId?: string
): PartidoHorario | null {
  if (!fechaISO) return null;
  const objetivo = new Date(fechaISO).getTime();
  if (isNaN(objetivo)) return null;
  for (const p of partidos) {
    if (p.id === excluirMatchId || !p.scheduled_at) continue;
    const t = new Date(p.scheduled_at).getTime();
    if (isNaN(t)) continue;
    if (Math.abs(t - objetivo) < VENTANA_CONFLICTO_MIN * 60 * 1000) return p;
  }
  return null;
}

/** Validación del bloque de disponibilidad que carga el árbitro. */
export function validarBloqueDisponibilidad(input: {
  desde: string;
  hasta: string;
  motivo?: string | null;
}): { ok: true } | { ok: false; error: string } {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(input.desde) || !re.test(input.hasta)) {
    return { ok: false, error: "Las fechas tienen que ser válidas (AAAA-MM-DD)." };
  }
  if (input.hasta < input.desde) {
    return { ok: false, error: "La fecha 'hasta' no puede ser anterior a la fecha 'desde'." };
  }
  const dias =
    (new Date(input.hasta).getTime() - new Date(input.desde).getTime()) / 86400000 + 1;
  if (dias > 90) {
    return { ok: false, error: "El bloque no puede durar más de 90 días. Cargá dos bloques si hace falta." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. ESTADÍSTICAS DEL ÁRBITRO (desde partidos y eventos reales)
// ---------------------------------------------------------------------------

export interface PartidoParaStats {
  status: string; // 'jugado' | 'wo' | 'programado' | 'suspendido'
  home_score: number | null;
  away_score: number | null;
  amarillas: number;
  rojas: number;
}

export interface EstadisticasArbitro {
  dirigidos: number;        // jugados + wo
  golesPromedio: number;    // por partido jugado (no wo sin goles)
  amarillasPromedio: number;
  rojasTotal: number;
  wo: number;
}

export function calcularEstadisticasArbitro(
  partidos: PartidoParaStats[]
): EstadisticasArbitro {
  const finalizados = partidos.filter(
    (p) => p.status === "jugado" || p.status === "wo"
  );
  const dirigidos = finalizados.length;
  if (dirigidos === 0) {
    return { dirigidos: 0, golesPromedio: 0, amarillasPromedio: 0, rojasTotal: 0, wo: 0 };
  }
  const jugados = finalizados.filter((p) => p.status === "jugado");
  const divisor = Math.max(1, jugados.length);
  const goles = jugados.reduce(
    (acc, p) => acc + (p.home_score ?? 0) + (p.away_score ?? 0),
    0
  );
  const amarillas = finalizados.reduce((acc, p) => acc + p.amarillas, 0);
  const rojas = finalizados.reduce((acc, p) => acc + p.rojas, 0);
  return {
    dirigidos,
    golesPromedio: Math.round((goles / divisor) * 100) / 100,
    amarillasPromedio: Math.round((amarillas / dirigidos) * 100) / 100,
    rojasTotal: rojas,
    wo: finalizados.filter((p) => p.status === "wo").length,
  };
}

// ---------------------------------------------------------------------------
// 4. LIQUIDACIONES MENSUALES (honorarios = partidos × tarifa)
// ---------------------------------------------------------------------------

/** Monto de la liquidación: partidos dirigidos × tarifa. Redondeo a 2 decimales. */
export function calcularLiquidacion(partidos: number, tarifa: number): number {
  if (partidos <= 0 || tarifa <= 0) return 0;
  return Math.round(partidos * tarifa * 100) / 100;
}

/** Tarifa efectiva: el override del árbitro gana; si no hay, la de su nivel. */
export function tarifaEfectiva(
  tarifaOverride: number | null,
  tarifaNivel: number | null
): number {
  if (tarifaOverride !== null && tarifaOverride > 0) return tarifaOverride;
  return tarifaNivel ?? 0;
}

/** Período 'YYYY-MM' del mes actual (para liquidar). */
export function periodoActual(hoy?: Date): string {
  const h = hoy ?? new Date();
  const mes = String(h.getMonth() + 1).padStart(2, "0");
  return `${h.getFullYear()}-${mes}`;
}

/** Nombre lindo del período: '2026-10' → 'octubre 2026'. */
export function nombrePeriodo(periodo: string): string {
  const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [anio, mes] = periodo.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return periodo;
  return `${MESES[mes - 1]} ${anio}`;
}

/** ¿Un partido cuenta para la liquidación? (jugado o WO con resultado confirmado) */
export function partidoLiquidable(status: string, resultConfirmed: boolean): boolean {
  return (status === "jugado" || status === "wo") && resultConfirmed;
}

// ---------------------------------------------------------------------------
// 5. VALIDACIONES DE CONFIGURACIÓN (niveles y eventos)
// ---------------------------------------------------------------------------

export function validarNivelArbitro(input: {
  nombre: string;
  orden: number;
  tarifa_partido: number;
}): { ok: true } | { ok: false; error: string } {
  const nombre = input.nombre.trim();
  if (nombre.length < 2 || nombre.length > 40) {
    return { ok: false, error: "El nombre del nivel tiene que tener entre 2 y 40 caracteres." };
  }
  if (!Number.isInteger(input.orden) || input.orden < 1 || input.orden > 99) {
    return { ok: false, error: "El orden tiene que ser un número entre 1 y 99." };
  }
  if (input.tarifa_partido < 0 || input.tarifa_partido > 999999) {
    return { ok: false, error: "La tarifa no puede ser negativa ni superar $ 999.999." };
  }
  return { ok: true };
}

export function validarEventoArbitral(input: {
  fecha: string;
  titulo: string;
  descripcion?: string | null;
}): { ok: true } | { ok: false; error: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) {
    return { ok: false, error: "La fecha del evento no es válida." };
  }
  const titulo = input.titulo.trim();
  if (titulo.length < 3 || titulo.length > 80) {
    return { ok: false, error: "El título tiene que tener entre 3 y 80 caracteres." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 6. COLEGIO DE ÁRBITROS — orden y etiquetas
// ---------------------------------------------------------------------------

export const ESTADO_ARBITRO_UI: Record<
  string,
  { label: string; className: string }
> = {
  activo: {
    label: "Activo",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  suspendido: {
    label: "Suspendido",
    className: "bg-red-50 text-red-700 border border-red-200",
  },
};

/** Ordena árbitros por nivel (A primero) y después por nombre. */
export function ordenarArbitrosPadron<
  T extends { nombre: string; nivelOrden: number | null }
>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    const na = a.nivelOrden ?? 99;
    const nb = b.nivelOrden ?? 99;
    if (na !== nb) return na - nb;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export interface InputRegistroArbitro {
  nombre: string;
  email: string;
  password: string;
  telefono?: string | null;
  dni?: string | null;
  rol?: string | null;
  tarifaOverride?: number | null;
}

/** Valida los campos requeridos para dar de alta un árbitro con su cuenta. */
export function validarRegistroArbitro(input: InputRegistroArbitro): { ok: true } | { ok: false; error: string } {
  const nombre = (input.nombre ?? "").trim();
  if (nombre.length < 3) {
    return { ok: false, error: "El nombre y apellido debe tener al menos 3 caracteres." };
  }
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "El correo electrónico no es válido." };
  }
  const password = input.password ?? "";
  if (password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }
  if (input.tarifaOverride !== null && input.tarifaOverride !== undefined) {
    if (Number.isNaN(input.tarifaOverride) || input.tarifaOverride < 0 || input.tarifaOverride > 999999) {
      return { ok: false, error: "La tarifa personalizada no es válida." };
    }
  }
  return { ok: true };
}

