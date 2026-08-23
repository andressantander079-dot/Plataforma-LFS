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
