/**
 * TRÁMITES LFS — Reglas de negocio puras (Paso 15)
 * -------------------------------------------------
 * Cerebro del rediseño de trámites: bandeja con pestañas, pases trabados,
 * checklist previa a la aprobación, cargo previsto de tesorería, acción
 * principal "qué tenés que hacer ahora", timeline del pase y validación
 * de la configuración unificada del mercado.
 * Sin dependencias de servidor: se usa en actions, componentes y tests.
 */

import type { EstadoPase } from "./pasesRules";
import { esEstadoTerminal } from "./pasesRules";

// ---------------------------------------------------------------------------
// 1. CONFIGURACIÓN UNIFICADA DEL MERCADO (pase_settings, fuente única)
// ---------------------------------------------------------------------------

export type RecargoModo = "fijo" | "multiplicador";

export interface ReglasMercadoInput {
  tenencia_anios: number;
  recargo_modo: RecargoModo;
  recargo_valor: number;
  alerta_trabado_horas: number;
  cancelacion_trabado_horas: number;
  aviso_retorno_horas: number;
  cupo_plantel: number;
  firma_obligatoria: boolean;
}

export function validarReglasMercado(input: ReglasMercadoInput): {
  ok: boolean;
  error?: string;
} {
  if (!Number.isInteger(input.tenencia_anios) || input.tenencia_anios < 0 || input.tenencia_anios > 5) {
    return { ok: false, error: "La tenencia debe ser un número entero entre 0 y 5 años." };
  }
  if (input.recargo_modo !== "fijo" && input.recargo_modo !== "multiplicador") {
    return { ok: false, error: "Modo de recargo inválido." };
  }
  if (input.recargo_modo === "fijo" && input.recargo_valor < 0) {
    return { ok: false, error: "El recargo fijo no puede ser negativo." };
  }
  if (input.recargo_modo === "multiplicador" && input.recargo_valor < 1) {
    return { ok: false, error: "El multiplicador debe ser 1 o más (1 = sin recargo)." };
  }
  if (!Number.isInteger(input.alerta_trabado_horas) || input.alerta_trabado_horas < 1 || input.alerta_trabado_horas > 720) {
    return { ok: false, error: "La alerta de pase trabado debe ser entre 1 y 720 horas." };
  }
  if (!Number.isInteger(input.cancelacion_trabado_horas) || input.cancelacion_trabado_horas <= input.alerta_trabado_horas || input.cancelacion_trabado_horas > 720) {
    return { ok: false, error: "La cancelación automática tiene que ser posterior a la alerta (y hasta 720 hs)." };
  }
  if (!Number.isInteger(input.aviso_retorno_horas) || input.aviso_retorno_horas < 1 || input.aviso_retorno_horas > 720) {
    return { ok: false, error: "El aviso de retorno debe ser entre 1 y 720 horas." };
  }
  if (!Number.isInteger(input.cupo_plantel) || input.cupo_plantel < 10 || input.cupo_plantel > 50) {
    return { ok: false, error: "El cupo por plantel debe ser entre 10 y 50 jugadores." };
  }
  return { ok: true };
}

/** Texto humano del recargo por rescisión configurado. */
export function textoRecargo(modo: RecargoModo, valor: number): string {
  if (modo === "fijo") {
    return valor > 0
      ? `$${valor.toLocaleString("es-AR")} fijos por rescindir`
      : "Sin recargo por rescisión";
  }
  return valor > 1
    ? `Multiplicador x${valor} sobre la tarifa del préstamo`
    : "Sin recargo por rescisión";
}

/** Recargo final en $ al rescindir un préstamo. */
export function calcularRecargoRescision(
  modo: RecargoModo,
  valor: number,
  tarifaPrestamo: number
): number {
  if (modo === "fijo") return Math.max(0, valor);
  return valor > 1 ? Math.round(valor * tarifaPrestamo * 100) / 100 : 0;
}

// ---------------------------------------------------------------------------
// 2. VENTANAS DE MERCADO (estado automático por fecha)
// ---------------------------------------------------------------------------

export type EstadoVentana = "proxima" | "abierta" | "cerrada";

export function estadoVentana(
  desde: string,
  hasta: string,
  hoy?: string
): EstadoVentana {
  const h = hoy ?? new Date().toISOString().slice(0, 10);
  if (h < desde) return "proxima";
  if (h > hasta) return "cerrada";
  return "abierta";
}

export const ESTADO_VENTANA_UI: Record<EstadoVentana, { label: string; clases: string }> = {
  proxima: { label: "Próxima", clases: "bg-sky-50 text-sky-700 border-sky-200" },
  abierta: { label: "Abierta", clases: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cerrada: { label: "Cerrada", clases: "bg-slate-100 text-slate-500 border-slate-200" },
};

// ---------------------------------------------------------------------------
// 3. PASES TRABADOS (esperando a alguien más de lo permitido)
// ---------------------------------------------------------------------------

/** Estados en los que el pase está "esperando" a que alguien actúe. */
export const ESTADOS_EN_ESPERA: EstadoPase[] = [
  "1_INIT_CLUB_A",
  "2_FVF_REVIEW",
  "4_CLUB_B_DECISION",
  "5_PLAYER_SIGNATURE",
  "6_FINAL_AUDIT",
];

/** Última vez que el pase tuvo movimiento (para medir el estancamiento). */
export function ultimaActividadPase(pase: {
  created_at: string;
  approved_at: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const candidatos: string[] = [pase.created_at];
  if (pase.approved_at) candidatos.push(pase.approved_at);
  const m = pase.metadata ?? {};
  for (const clave of ["notificado_at", "firmado_at", "recordatorio_at"] as const) {
    const v = m[clave];
    if (typeof v === "string") candidatos.push(v);
  }
  return candidatos
    .map((c) => new Date(c).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)
    .map((t) => new Date(t).toISOString())[0];
}

/** ¿El pase lleva trabado más horas de las configuradas? */
export function estaTrabado(
  estado: EstadoPase,
  ultimaActividadIso: string,
  horasAlerta: number,
  ahora?: Date
): boolean {
  if (esEstadoTerminal(estado)) return false;
  if (!ESTADOS_EN_ESPERA.includes(estado)) return false;
  const ref = ahora ?? new Date();
  const horas = (ref.getTime() - new Date(ultimaActividadIso).getTime()) / 3600000;
  return horas > horasAlerta;
}

// ---------------------------------------------------------------------------
// 4. BANDEJA DE TRÁMITES (pestañas)
// ---------------------------------------------------------------------------

export type TabBandeja = "pendientes" | "en_curso" | "trabados" | "historial";

export const TABS_BANDEJA: Array<{ id: TabBandeja; label: string }> = [
  { id: "pendientes", label: "Pendientes de la liga" },
  { id: "en_curso", label: "En curso" },
  { id: "trabados", label: "Trabados" },
  { id: "historial", label: "Historial" },
];

/** La liga tiene que actuar en estos estados. */
export const ESTADOS_TURNO_LIGA: EstadoPase[] = ["1_INIT_CLUB_A", "2_FVF_REVIEW", "6_FINAL_AUDIT"];

export function tabDelPase(
  estado: EstadoPase,
  ultimaActividadIso: string,
  horasAlerta: number,
  ahora?: Date
): TabBandeja {
  if (esEstadoTerminal(estado)) return "historial";
  if (estaTrabado(estado, ultimaActividadIso, horasAlerta, ahora)) return "trabados";
  if (ESTADOS_TURNO_LIGA.includes(estado)) return "pendientes";
  return "en_curso";
}

// ---------------------------------------------------------------------------
// 5. ACCIÓN PRINCIPAL — "Qué tenés que hacer ahora" (vista de la liga)
// ---------------------------------------------------------------------------

export interface AccionPrincipal {
  titulo: string;
  detalle: string;
  /** Identificador de la acción que dispara el botón principal. */
  accion: "aprobar_revision" | "completar" | "recordar" | "ninguna";
}

export function accionPrincipalAdmin(estado: EstadoPase, trabado: boolean): AccionPrincipal {
  if (trabado) {
    return {
      titulo: "Este pase está trabado",
      detalle: "Superó el tiempo de espera configurado. Podés recordar al responsable, destrabarlo o cancelarlo con motivo.",
      accion: "recordar",
    };
  }
  switch (estado) {
    case "1_INIT_CLUB_A":
    case "2_FVF_REVIEW":
      return {
        titulo: "Revisar y aprobar la solicitud",
        detalle: "Revisá la checklist: documentos, deudas y ventana de mercado. Si está todo bien, aprobá la revisión para que el club de origen dictamine.",
        accion: "aprobar_revision",
      };
    case "6_FINAL_AUDIT":
      return {
        titulo: "Auditoría final y cierre",
        detalle: "El jugador ya firmó. Verificá la evidencia (firma + DNI) y completá el pase: el jugador se mueve de club y se genera el derecho de pase en tesorería.",
        accion: "completar",
      };
    case "4_CLUB_B_DECISION":
      return {
        titulo: "Esperando al club de origen",
        detalle: "El club de origen tiene que aprobar o rechazar el pase. Si tarda demasiado, podés recordarle por mensajería.",
        accion: "recordar",
      };
    case "5_PLAYER_SIGNATURE":
      return {
        titulo: "Esperando la firma del jugador",
        detalle: "El club destino tiene que compartirle el link de firma al jugador (dura 72 hs). Podés reenviar el recordatorio.",
        accion: "recordar",
      };
    default:
      return {
        titulo: "Trámite terminado",
        detalle: "Este pase ya no requiere acciones.",
        accion: "ninguna",
      };
  }
}

// ---------------------------------------------------------------------------
// 6. CARGO PREVISTO (derecho de pase) — se muestra desde el inicio
// ---------------------------------------------------------------------------

export interface FeeRegla {
  category_id: string;
  competition_id: string | null;
  tipo: string;
  monto: number;
}

export interface CargoPrevisto {
  monto: number;
  origen: "torneo" | "general" | null;
}

/**
 * Mismo criterio que usa el motor al completar el pase:
 * primero la regla especial del torneo, si no la general de la categoría.
 */
export function calcularCargoPrevisto(params: {
  fees: FeeRegla[];
  categoriaBaseId: string | null;
  competitionId: string | null;
  tipoPase: string;
}): CargoPrevisto {
  const { fees, categoriaBaseId, competitionId, tipoPase } = params;
  if (!categoriaBaseId) return { monto: 0, origen: null };

  if (competitionId) {
    const reglaTorneo = fees.find(
      (f) => f.category_id === categoriaBaseId && f.competition_id === competitionId && f.tipo === tipoPase
    );
    if (reglaTorneo && reglaTorneo.monto > 0) return { monto: reglaTorneo.monto, origen: "torneo" };
  }
  const reglaGeneral = fees.find(
    (f) => f.category_id === categoriaBaseId && f.competition_id === null && f.tipo === tipoPase
  );
  if (reglaGeneral && reglaGeneral.monto > 0) return { monto: reglaGeneral.monto, origen: "general" };
  return { monto: 0, origen: null };
}

// ---------------------------------------------------------------------------
// 7. CHECKLIST PREVIA A LA APROBACIÓN
// ---------------------------------------------------------------------------

export interface ItemChecklist {
  id: string;
  label: string;
  ok: boolean;
  detalle: string;
}

export function armarChecklist(params: {
  tieneDocumentos: boolean;
  ventanaAbierta: boolean;
  tieneDeudaBloqueante: boolean;
  deudaSaldada: boolean;
  firmaObligatoria: boolean;
  firmado: boolean;
  cupoPlantel: number;
  jugadoresActuales: number;
}): ItemChecklist[] {
  const items: ItemChecklist[] = [
    {
      id: "documentos",
      label: "Documentos del pase",
      ok: params.tieneDocumentos,
      detalle: params.tieneDocumentos ? "Hay documentación adjunta" : "Sin documentos adjuntos todavía",
    },
    {
      id: "ventana",
      label: "Ventana de mercado",
      ok: params.ventanaAbierta,
      detalle: params.ventanaAbierta ? "El libro de pases está abierto" : "No hay ventana abierta (el pase ya estaba iniciado)",
    },
    {
      id: "deuda",
      label: "Deuda bloqueante",
      ok: !params.tieneDeudaBloqueante || params.deudaSaldada,
      detalle: !params.tieneDeudaBloqueante
        ? "Sin deuda declarada que bloquee"
        : params.deudaSaldada
          ? "La deuda bloqueante ya fue saldada"
          : "Hay una deuda bloqueante SIN saldar",
    },
    {
      id: "firma",
      label: "Firma del jugador",
      ok: !params.firmaObligatoria || params.firmado,
      detalle: !params.firmaObligatoria
        ? "La liga no exige firma online"
        : params.firmado
          ? "El jugador ya firmó"
          : "Todavía no firmó (se pide después del dictamen)",
    },
    {
      id: "cupo",
      label: "Cupo del plantel destino",
      ok: params.jugadoresActuales < params.cupoPlantel,
      detalle: `${params.jugadoresActuales}/${params.cupoPlantel} jugadores en el plantel`,
    },
  ];
  return items;
}

// ---------------------------------------------------------------------------
// 8. TIMELINE DEL PASE (fecha y hora de cada evento)
// ---------------------------------------------------------------------------

export interface EventoTimelinePase {
  clave: string;
  label: string;
  at: string | null;
}

export function timelineDePase(pase: {
  created_at: string;
  approved_at: string | null;
  metadata?: Record<string, unknown> | null;
}): EventoTimelinePase[] {
  const m = (pase.metadata ?? {}) as Record<string, unknown>;
  const pick = (k: string): string | null => (typeof m[k] === "string" ? (m[k] as string) : null);

  const eventos: EventoTimelinePase[] = [
    { clave: "solicitud", label: "Solicitud iniciada", at: pase.created_at },
    { clave: "revision", label: "Revisión de la liga aprobada", at: pick("revisado_at") ?? pase.approved_at },
    { clave: "notificacion", label: "Club de origen notificado", at: pick("notificado_at") },
    { clave: "dictamen", label: "Dictamen del club de origen", at: pick("dictamen_at") },
    { clave: "firma", label: "Firma online del jugador", at: pick("firmado_at") },
    { clave: "completado", label: "Pase efectivo", at: pick("completado_at") },
    { clave: "rechazado", label: "Rechazado", at: pick("rechazado_at") },
    { clave: "cancelado", label: "Cancelado", at: pick("cancelado_at") },
  ];
  // Solo eventos que ocurrieron, ordenados cronológicamente
  return eventos
    .filter((e) => e.at !== null)
    .sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
}
