/**
 * REGLAS DE PASES Y TRANSFERENCIAS (Paso 9)
 * Máquina de estados del circuito de pases + credencial de firma de 72 hs.
 * Todo son funciones puras: se prueban con vitest sin tocar la base.
 */

/** Verifica si las credenciales temporales generadas para la firma digital siguen activas (límite de 72 horas). */
export function isCredentialActive(approvedAt: string, ttlHours = 72): boolean {
  if (!approvedAt) return false;
  const approvalTime = new Date(approvedAt).getTime();
  const now = new Date().getTime();
  const hoursPassed = (now - approvalTime) / (1000 * 60 * 60);
  return hoursPassed <= ttlHours;
}

// ---------------------------------------------------------------------------
// MÁQUINA DE ESTADOS DEL PASE
// ---------------------------------------------------------------------------

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

/**
 * Pasos del stepper visual. El circuito tiene 5 momentos; los estados
 * 1/2 comparten el paso 0 y 3/4 comparten el paso 1.
 * Estados terminales "malos" (8/9) devuelven -1: el stepper se muestra tachado.
 */
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
      return -1; // rechazado / cancelado
  }
}

/** ¿Qué acción le toca a cada rol en este estado? (para los textos de ayuda) */
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

// ---------------------------------------------------------------------------
// TIPOS DE PASE (Paso 9B): definitivo o préstamo con retorno
// ---------------------------------------------------------------------------

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

/**
 * El préstamo EXIGE fecha de retorno y tiene que ser FUTURA.
 * El definitivo no lleva fecha de retorno.
 */
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

// ---------------------------------------------------------------------------
// DOCUMENTO DE CONFORMIDAD (Paso 9B): texto legal que el jugador lee y
// acepta en la pantalla de firma. Función pura → se prueba con vitest.
// ---------------------------------------------------------------------------

export interface DatosConsentimiento {
  jugador: string;
  dni: string;
  clubOrigen: string;
  clubDestino: string;
  tipo: TipoPase;
  fechaRetorno?: string | null; // ISO (YYYY-MM-DD), solo préstamo
  torneo?: string | null; // nombre del torneo, solo préstamo por torneo
}

/** Nombre formal del trámite para el documento. */
export function nombreTramite(tipo: TipoPase): string {
  return tipo === "prestamo" ? "PASE A PRÉSTAMO" : "PASE DEFINITIVO";
}

function fechaLegible(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-AR");
}

/** Documento completo de conformidad de transferencia. */
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

/** Bloque de autorización de la madre, padre o tutor/a (menores de 18). */
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
