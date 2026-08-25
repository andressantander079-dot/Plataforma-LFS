/**
 * REGLAS DE PASES Y TRANSFERENCIAS (LFS Sprint Plan v3.0)
 * Máquina de estados del circuito de pases, esquemas Zod, contratos de respuesta y
 * validación de elegibilidad de categorías por año de nacimiento.
 * Todo son funciones puras: se prueban con vitest sin tocar la base de datos.
 */

import { z } from "zod";

// ============================================================================
// 1. CONTRATO ESTANDARIZADO DE RESPUESTA DE SERVER ACTIONS
// ============================================================================

export type ActionResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
};

// ============================================================================
// 2. ESQUEMAS ZOD DE VALIDACIÓN
// ============================================================================

/** Inscripción de nuevo jugador o libre desde el panel del club */
export const InscripcionJugadorInputSchema = z.object({
  player_id: z.string().uuid().optional(),
  dni: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/, "El DNI debe contener entre 6 y 10 dígitos numéricos sin puntos ni letras."),
  first_name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres."),
  last_name: z.string().trim().min(2, "El apellido debe tener al menos 2 caracteres."),
  fecha_nacimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (YYYY-MM-DD)."),
  foto_path: z.string().min(1, "La foto de perfil es obligatoria."),
  category_ids: z.array(z.string().uuid()).min(1, "Debe seleccionar al menos una categoría."),
});

export type InscripcionJugadorInput = z.infer<typeof InscripcionJugadorInputSchema>;

/** Parámetros generales del módulo de pases (pase_settings) */
export const PaseSettingsSchema = z
  .object({
    tenencia_anios: z.number().int().min(0, "La tenencia no puede ser negativa.").max(5, "Máximo 5 años."),
    recargo_rescision: z.number().min(0, "El recargo no puede ser negativo."),
    alerta_trabado_horas: z.number().int().min(1).max(720),
    cancelacion_trabado_horas: z.number().int().min(1).max(720),
    aviso_retorno_horas: z.number().int().min(1).max(720),
  })
  .refine((data) => data.cancelacion_trabado_horas > data.alerta_trabado_horas, {
    message: "La cancelación automática tiene que ser posterior a la alerta de pase trabado.",
    path: ["cancelacion_trabado_horas"],
  });

export type PaseSettingsInput = z.infer<typeof PaseSettingsSchema>;

/** Rango de años de nacimiento por categoría (categories) */
export const RangoCategoriaSchema = z
  .object({
    id: z.string().uuid(),
    anio_desde: z.number().int().min(1950).max(new Date().getFullYear()).nullable(),
    anio_hasta: z.number().int().min(1950).max(new Date().getFullYear()).nullable(),
  })
  .refine(
    (data) => {
      if (data.anio_desde === null && data.anio_hasta === null) return true;
      if (data.anio_desde !== null && data.anio_hasta !== null) {
        return data.anio_desde <= data.anio_hasta;
      }
      return false;
    },
    { message: "Complete ambos años (desde <= hasta) o deje ambos campos vacíos." }
  );

export type RangoCategoriaInput = z.infer<typeof RangoCategoriaSchema>;

/** Tarifas y derechos de pase (transfer_fees) */
export const TransferFeeInputSchema = z.object({
  category_id: z.string().uuid("Seleccione una categoría válida."),
  competition_id: z.string().uuid().nullable().optional(),
  tipo: z.enum(["definitivo", "prestamo"] as const),
  monto: z.number().min(0, "El monto no puede ser negativo."),
});

export type TransferFeeInput = z.infer<typeof TransferFeeInputSchema>;

/** Ventanas de mercado (transfer_windows) */
export const TransferWindowInputSchema = z
  .object({
    nombre: z.string().trim().min(3, "El nombre de la ventana debe tener al menos 3 caracteres."),
    fecha_desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de inicio inválida."),
    fecha_hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de fin inválida."),
  })
  .refine((data) => data.fecha_hasta >= data.fecha_desde, {
    message: "La fecha de fin no puede ser anterior a la de inicio.",
    path: ["fecha_hasta"],
  });

export type TransferWindowInput = z.infer<typeof TransferWindowInputSchema>;

// ============================================================================
// 3. VALIDACIÓN DE ELEGIBILIDAD DE CATEGORÍAS (JUGAR PARA ARRIBA)
// ============================================================================

export interface CategoriaElegibilidad {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

/**
 * Valida si un jugador puede inscribirse en las categorías seleccionadas:
 * 1. Encuentra la categoría sugerida (base) según el año de nacimiento.
 * 2. Si no hay rango configurado, todas las categorías son permitidas.
 * 3. Bloquea estrictamente categorías inferiores a la sugerida.
 * 4. Exige obligatoriamente la inclusión de la categoría base si hay categorías seleccionadas.
 * 5. Permite sumar divisiones superiores ("jugar para arriba").
 */
export function validarElegibilidadCategoria(
  birthYear: number,
  selectedCategoryIds: string[],
  allCategories: CategoriaElegibilidad[]
): {
  valid: boolean;
  error?: string;
  sugerida?: CategoriaElegibilidad;
  permitidasIds: string[];
} {
  const sugerida = allCategories.find(
    (c) =>
      c.anio_desde !== null &&
      c.anio_hasta !== null &&
      birthYear >= c.anio_desde &&
      birthYear <= c.anio_hasta
  );

  // Si no hay rango configurado para ese año, todas son elegibles
  if (!sugerida) {
    return {
      valid: true,
      permitidasIds: allCategories.map((c) => c.id),
    };
  }

  // Permitidas: la sugerida (base) + todas las de jerarquía superior
  const permitidas = allCategories.filter((c) => c.level_hierarchy >= sugerida.level_hierarchy);
  const permitidasIds = permitidas.map((c) => c.id);

  const seleccionadas = allCategories.filter((c) => selectedCategoryIds.includes(c.id));

  // 1. Bloqueo estricto de categorías inferiores
  const inferior = seleccionadas.find((c) => c.level_hierarchy < sugerida.level_hierarchy);
  if (inferior) {
    return {
      valid: false,
      error: `Por su año de nacimiento (${birthYear}), el jugador no puede competir en ${inferior.name}. Su categoría base es ${sugerida.name}.`,
      sugerida,
      permitidasIds,
    };
  }

  // 2. Obligatoriedad de incluir la categoría base
  const tieneBase = selectedCategoryIds.includes(sugerida.id);
  if (!tieneBase && selectedCategoryIds.length > 0) {
    return {
      valid: false,
      error: `Por su año de nacimiento (${birthYear}), debe incluir obligatoriamente su categoría base (${sugerida.name}). Opcionalmente puede sumar categorías mayores.`,
      sugerida,
      permitidasIds,
    };
  }

  return {
    valid: true,
    sugerida,
    permitidasIds,
  };
}

// ============================================================================
// 4. MÁQUINA DE ESTADOS Y CREDENCIALES TEMPORALES (Paso 9)
// ============================================================================

/** Verifica si las credenciales temporales generadas para la firma digital siguen activas (límite de 72 horas). */
export function isCredentialActive(approvedAt: string, ttlHours = 72): boolean {
  if (!approvedAt) return false;
  const approvalTime = new Date(approvedAt).getTime();
  const now = new Date().getTime();
  const hoursPassed = (now - approvalTime) / (1000 * 60 * 60);
  return hoursPassed <= ttlHours;
}

export type EstadoPase =
  | "1_INIT_CLUB_A"
  | "2_FVF_REVIEW"
  | "3_NOTIFY_CLUB_B"
  | "4_CLUB_B_DECISION"
  | "5_PLAYER_SIGNATURE"
  | "6_FINAL_AUDIT"
  | "7_COMPLETED"
  | "8_RECHAZADO"
  | "9_CANCELADO";

export const ESTADOS_TERMINALES: EstadoPase[] = [
  "7_COMPLETED",
  "8_RECHAZADO",
  "9_CANCELADO",
];

export function esEstadoTerminal(estado: string): boolean {
  return (ESTADOS_TERMINALES as string[]).includes(estado);
}

/** Etiqueta legible + estilo para cada estado (badges de las listas). */
export const ESTADO_PASE_UI: Record<
  EstadoPase,
  { label: string; className: string }
> = {
  "1_INIT_CLUB_A": {
    label: "Solicitud iniciada",
    className: "bg-slate-100 text-slate-600",
  },
  "2_FVF_REVIEW": {
    label: "Revisión de la liga",
    className: "bg-blue-100 text-blue-700",
  },
  "3_NOTIFY_CLUB_B": {
    label: "Notificado club origen",
    className: "bg-blue-100 text-blue-700",
  },
  "4_CLUB_B_DECISION": {
    label: "Esperando dictamen del club origen",
    className: "bg-orange-100 text-orange-700",
  },
  "5_PLAYER_SIGNATURE": {
    label: "Esperando firma del jugador",
    className: "bg-purple-100 text-purple-700",
  },
  "6_FINAL_AUDIT": {
    label: "Auditoría final",
    className: "bg-blue-100 text-blue-700",
  },
  "7_COMPLETED": {
    label: "Pase efectivo",
    className: "bg-green-100 text-green-700",
  },
  "8_RECHAZADO": {
    label: "Rechazado",
    className: "bg-red-100 text-red-700",
  },
  "9_CANCELADO": {
    label: "Cancelado",
    className: "bg-slate-200 text-slate-500",
  },
};

export const PASOS_CIRCUITO = [
  "Solicitud y revisión de la liga",
  "Dictamen del club de origen",
  "Firma online del jugador",
  "Auditoría final",
  "Pase efectivo",
] as const;

export function progresoPase(estado: string): number {
  switch (estado) {
    case "1_INIT_CLUB_A":
    case "2_FVF_REVIEW":
      return 0;
    case "3_NOTIFY_CLUB_B":
    case "4_CLUB_B_DECISION":
      return 1;
    case "5_PLAYER_SIGNATURE":
      return 2;
    case "6_FINAL_AUDIT":
      return 3;
    case "7_COMPLETED":
      return 4;
    default:
      return -1;
  }
}

export function aQuienLeToca(estado: EstadoPase): string {
  switch (estado) {
    case "1_INIT_CLUB_A":
    case "2_FVF_REVIEW":
      return "la liga (revisión)";
    case "3_NOTIFY_CLUB_B":
    case "4_CLUB_B_DECISION":
      return "el club de origen (dictamen)";
    case "5_PLAYER_SIGNATURE":
      return "el jugador (firma online)";
    case "6_FINAL_AUDIT":
      return "la liga (auditoría final)";
    default:
      return "nadie, el trámite terminó";
  }
}

// ============================================================================
// 5. TIPOS DE PASE Y DOCUMENTO DE CONFORMIDAD (Paso 9B)
// ============================================================================

export type TipoPase = "definitivo" | "prestamo";

export const TIPO_PASE_UI: Record<TipoPase, { label: string; className: string }> = {
  definitivo: {
    label: "Definitivo",
    className: "bg-green-100 text-green-700",
  },
  prestamo: {
    label: "Préstamo",
    className: "bg-amber-100 text-amber-700",
  },
};

export function fechaRetornoValida(
  fechaRetorno: string | null | undefined,
  tipo: TipoPase,
  hoy: Date = new Date()
): { ok: boolean; error?: string } {
  if (tipo === "definitivo") return { ok: true };
  if (!fechaRetorno) {
    return { ok: false, error: "El préstamo necesita una fecha de retorno." };
  }
  const fecha = new Date(`${fechaRetorno}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return { ok: false, error: "La fecha de retorno no es válida." };
  }
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (fecha <= inicioHoy) {
    return { ok: false, error: "La fecha de retorno tiene que ser posterior a hoy." };
  }
  return { ok: true };
}

export interface DatosConsentimiento {
  jugador: string;
  dni: string;
  clubOrigen: string;
  clubDestino: string;
  tipo: TipoPase;
  fechaRetorno?: string | null;
  torneo?: string | null;
}

export function nombreTramite(tipo: TipoPase): string {
  return tipo === "prestamo" ? "PASE A PRÉSTAMO" : "PASE DEFINITIVO";
}

function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR");
}

export function generarTextoConsentimiento(d: DatosConsentimiento): string {
  const lineas: string[] = [
    "DOCUMENTO DE CONFORMIDAD DE TRANSFERENCIA DE JUGADOR/A",
    "Liga de Fútsal de Ushuaia (LFS)",
    "",
    `En el día de la fecha, el/la jugador/a ${d.jugador}, DNI N° ${d.dni}, confirma que realizará el trámite de ${nombreTramite(d.tipo)} desde el club ${d.clubOrigen} hacia el club ${d.clubDestino}.`,
  ];

  if (d.tipo === "prestamo") {
    if (d.torneo) {
      lineas.push(`El préstamo se realiza en el marco del torneo ${d.torneo}.`);
    }
    if (d.fechaRetorno) {
      lineas.push(
        `La fecha de retorno acordada es el ${fechaLegible(d.fechaRetorno)}: llegada esa fecha, el/la jugador/a retornará automáticamente al club ${d.clubOrigen}.`
      );
    }
  }

  lineas.push(
    "",
    "El/La jugador/a declara:",
    "1. Que realiza esta transferencia de manera libre y voluntaria, en pleno conocimiento de los clubes involucrados y de las condiciones del trámite.",
    "2. Que los datos consignados en este documento son auténticos y que la firma dibujada y la foto del documento de identidad adjuntas le pertenecen.",
    "3. Que la presente conformidad registrada de forma digital tiene plena validez ante la Liga de Fútsal de Ushuaia."
  );

  if (d.tipo === "prestamo") {
    lineas.push(
      "4. Que conoce y acepta que, al vencimiento del préstamo, retornará automáticamente a su club de origen, y que la rescisión anticipada solo puede realizarla el club destino con el recargo que establece la liga."
    );
  }

  return lineas.join("\n");
}

export function generarTextoTutor(t: {
  parentesco: string;
  nombre: string;
  apellido: string;
  dni: string;
}): string {
  return [
    "AUTORIZACIÓN DE MADRE, PADRE O TUTOR/A",
    "",
    `Yo, ${t.apellido}, ${t.nombre}, DNI N° ${t.dni}, en mi carácter de ${t.parentesco} del/de la jugador/a menor de edad, AUTORIZO la transferencia declarada en este documento y dejo constancia de mi conformidad con mi firma dibujada y la foto de mi documento de identidad.`,
  ].join("\n");
}
