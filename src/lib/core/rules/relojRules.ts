/**
 * REGLAS DEL RELOJ EN VIVO — Paso 17C
 * Cuenta regresiva por tiempo (PT/ST) y entretiempo, con pausa manual.
 * Funciones PURAS: nada de base de datos, todo se calcula con los
 * timestamps guardados en matches (reloj_iniciado_at + reloj_segundos_base).
 *
 * Cómo se guarda el estado en la base:
 *  - reloj_segundos_base: segundos YA descontados del tramo actual
 *    (cuando está en pausa, es el total consumido; cuando corre, es lo
 *    consumido hasta reloj_iniciado_at).
 *  - reloj_iniciado_at: cuándo se reanudó el reloj por última vez.
 *  - reloj_corriendo: si hay que seguir descontando del "ahora".
 */

export type FaseReloj =
  | "sin_iniciar"
  | "pre_partido"
  | "primer_tiempo"
  | "entretiempo"
  | "segundo_tiempo"
  | "finalizado";

export interface EstadoReloj {
  fase: FaseReloj;
  corriendo: boolean;
  iniciadoAt: string | null; // ISO timestamptz
  segundosBase: number;
  duracionTiempoMin: number;
  duracionEntretiempoMin: number;
}

/** Duración en segundos del tramo actual según la fase. */
export function duracionDelTramo(
  fase: FaseReloj,
  duracionTiempoMin: number,
  duracionEntretiempoMin: number
): number {
  if (fase === "entretiempo") return duracionEntretiempoMin * 60;
  if (fase === "primer_tiempo" || fase === "segundo_tiempo")
    return duracionTiempoMin * 60;
  return 0;
}

/**
 * Segundos que quedan en el tramo actual (nunca negativo).
 * `ahoraMs` es Date.now() del cliente (se pasa para poder testear).
 */
export function segundosRestantes(estado: EstadoReloj, ahoraMs: number): number {
  const total = duracionDelTramo(
    estado.fase,
    estado.duracionTiempoMin,
    estado.duracionEntretiempoMin
  );
  if (total <= 0) return 0;

  let consumidos = estado.segundosBase;
  if (estado.corriendo && estado.iniciadoAt) {
    consumidos += Math.max(
      0,
      Math.floor((ahoraMs - new Date(estado.iniciadoAt).getTime()) / 1000)
    );
  }
  return Math.max(0, total - consumidos);
}

/** Segundos consumidos del tramo (para saber el minuto de juego). */
export function segundosConsumidos(estado: EstadoReloj, ahoraMs: number): number {
  const total = duracionDelTramo(
    estado.fase,
    estado.duracionTiempoMin,
    estado.duracionEntretiempoMin
  );
  if (total <= 0) return 0;
  return total - segundosRestantes(estado, ahoraMs);
}

/** "24:59" — minutos:segundos de lo que queda. */
export function formatoReloj(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

/** Etiqueta corta de la fase para badges ("1T", "ET", "2T"...). */
export function etiquetaFase(fase: FaseReloj): string {
  switch (fase) {
    case "sin_iniciar":
      return "SIN INICIAR";
    case "pre_partido":
      return "PRE-PARTIDO";
    case "primer_tiempo":
      return "1T";
    case "entretiempo":
      return "ENTRETIEMPO";
    case "segundo_tiempo":
      return "2T";
    case "finalizado":
      return "FINALIZADO";
  }
}

/** ¿Se pueden cargar eventos de juego en esta fase? (durante el ET no) */
export function puedeCargarEventos(fase: FaseReloj): boolean {
  return fase === "primer_tiempo" || fase === "segundo_tiempo";
}

/**
 * Minuto de juego actual (arranca en 1) y su tiempo, para estampar
 * eventos con el formato "12' PT". Si el reloj no arrancó, devuelve
 * minuto 1 del primer tiempo.
 */
export function minutoActual(
  estado: EstadoReloj,
  ahoraMs: number
): { minuto: number; tiempo: "PT" | "ST" } {
  const tiempo: "PT" | "ST" =
    estado.fase === "segundo_tiempo" ? "ST" : "PT";
  if (!puedeCargarEventos(estado.fase)) return { minuto: 1, tiempo };
  const consumidos = segundosConsumidos(estado, ahoraMs);
  const minuto = Math.min(
    estado.duracionTiempoMin,
    Math.floor(consumidos / 60) + 1
  );
  return { minuto, tiempo };
}

/** ¿Llegó a cero? (para disparar la alarma una sola vez) */
export function llegoACero(estado: EstadoReloj, ahoraMs: number): boolean {
  if (
    estado.fase !== "primer_tiempo" &&
    estado.fase !== "segundo_tiempo" &&
    estado.fase !== "entretiempo"
  ) {
    return false;
  }
  return segundosRestantes(estado, ahoraMs) <= 0;
}
