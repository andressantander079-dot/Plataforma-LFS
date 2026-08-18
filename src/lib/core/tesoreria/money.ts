/**
 * TESORERÍA — Cálculos puros (Paso 8A)
 * Sin base de datos: funciones de dinero, recargos y estado de cargos.
 * Se testean con vitest. Los montos se manejan en pesos con 2 decimales.
 */

/** Formatea un monto como moneda argentina: $ 45.000,00 */
export function formatoPesos(monto: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(monto);
}

/** Redondeo a 2 decimales (evita errores de punto flotante). */
export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Recargo por mora: si el cargo está vencido (hoy > fecha_vencimiento),
 * se aplica el porcentaje configurado sobre el monto original.
 * Devuelve el TOTAL a pagar (monto + recargo). Sin vencimiento o sin
 * configurar recargo, el total es el monto original.
 */
export function totalConRecargo(
  monto: number,
  fechaVencimiento: string | null,
  lateFeePercent: number,
  hoy: Date = new Date()
): number {
  if (!fechaVencimiento || lateFeePercent <= 0) return redondear(monto);
  const venc = new Date(fechaVencimiento + "T23:59:59");
  if (hoy <= venc) return redondear(monto);
  return redondear(monto * (1 + lateFeePercent / 100));
}

/** ¿El cargo está vencido? (fecha de vencimiento pasada) */
export function estaVencido(fechaVencimiento: string | null, hoy: Date = new Date()): boolean {
  if (!fechaVencimiento) return false;
  return hoy > new Date(fechaVencimiento + "T23:59:59");
}

export type EstadoCargo = "pendiente" | "parcial" | "pagado" | "anulado" | "vencido";

export interface EstadoCuentaCargo {
  estado: EstadoCargo;
  total: number; // monto + recargo si corresponde
  pagado: number; // suma de pagos aprobados
  saldo: number; // lo que falta pagar
  recargo: number; // cuánto recargo se aplicó
}

/**
 * Estado completo de un cargo, considerando pagos aprobados y mora.
 * "vencido" es un estado VISUAL: en la base queda pendiente/parcial,
 * pero si pasó la fecha y debe plata, se muestra vencido.
 */
export function estadoCargo(
  monto: number,
  fechaVencimiento: string | null,
  lateFeePercent: number,
  pagosAprobados: number,
  anulado: boolean,
  hoy: Date = new Date()
): EstadoCuentaCargo {
  if (anulado) {
    return { estado: "anulado", total: redondear(monto), pagado: redondear(pagosAprobados), saldo: 0, recargo: 0 };
  }
  const total = totalConRecargo(monto, fechaVencimiento, lateFeePercent, hoy);
  const recargo = redondear(total - monto);
  const pagado = redondear(pagosAprobados);
  const saldo = redondear(Math.max(0, total - pagado));

  let estado: EstadoCargo;
  if (saldo <= 0) estado = "pagado";
  else if (estaVencido(fechaVencimiento, hoy)) estado = "vencido";
  else if (pagado > 0) estado = "parcial";
  else estado = "pendiente";

  return { estado, total, pagado, saldo, recargo };
}

/** Etiquetas legibles para los tipos de cargo. */
export const TIPO_CARGO_UI: Record<string, string> = {
  inscripcion_torneo: "Inscripción a torneo",
  cuota_mensual: "Cuota mensual",
  cuota_anual: "Cuota anual",
  multa_roja: "Multa · tarjeta roja",
  multa_wo: "Multa · W.O.",
  multa_acumulacion_amarillas: "Multa · acumulación de amarillas",
  otro: "Otro cargo",
};

/** Tipos que la tesorería puede cargar a mano (las multas son automáticas). */
export const TIPOS_CARGO_MANUALES = [
  "inscripcion_torneo",
  "cuota_mensual",
  "cuota_anual",
  "otro",
] as const;

export const METODO_PAGO_UI: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  deposito: "Depósito bancario",
};
