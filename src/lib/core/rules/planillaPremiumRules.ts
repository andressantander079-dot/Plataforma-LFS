/**
 * REGLAS PREMIUM DE LA PLANILLA — Paso 17C
 * Semáforo pre-partido, números de camiseta únicos, faltas acumuladas,
 * doble amarilla, tiempos pedidos y formato de minuto "12' PT".
 * Funciones PURAS: se testean sin base de datos.
 */

// ---------- Constantes de juego ----------

export const TITULARES_REQUERIDOS = 5; // futsal: 5 en cancha
export const FALTAS_AVISO = 4; // a la 4ta avisa
export const FALTAS_LIMITE = 5; // a la 5ta: tiro libre sin barrera
export const TIEMPOS_POR_TIEMPO = 1; // 1 tiempo pedido por equipo por tiempo
export const DURACION_TIEMPO_MUERTO_SEG = 60;

// ---------- Tipos de eventos (espejo de match_events) ----------

export type TipoEvento =
  | "gol"
  | "gol_en_contra"
  | "amarilla"
  | "roja"
  | "cambio"
  | "falta"
  | "tiempo_muerto";

export interface EventoBase {
  tipo: TipoEvento;
  teamId: string;
  playerId: string | null;
  tiempo?: "PT" | "ST" | null;
}

// ---------- Semáforo pre-partido ----------

export type EstadoSemaforo = "ok" | "advertencia" | "bloqueante";

export interface ItemSemaforo {
  clave: string;
  titulo: string;
  detalle: string;
  estado: EstadoSemaforo;
}

export interface DatosSemaforo {
  convocatoriaLocalConfirmada: boolean;
  convocatoriaVisitanteConfirmada: boolean;
  titularesLocal: number;
  titularesVisitante: number;
  capitanLocal: boolean;
  capitanVisitante: boolean;
  numerosDuplicadosLocal: number[];
  numerosDuplicadosVisitante: number[];
  segundoArbitroAsignado: boolean;
  planilleroAsignado: boolean;
}

/**
 * Construye el checklist pre-partido.
 * Bloqueantes: convocatorias confirmadas, 5 titulares, capitanes,
 * números únicos. Advertencias: 2do árbitro y planillero (opcionales,
 * en categorías chicas puede no haber).
 */
export function construirSemaforo(d: DatosSemaforo): ItemSemaforo[] {
  const items: ItemSemaforo[] = [];

  const convocOk = d.convocatoriaLocalConfirmada && d.convocatoriaVisitanteConfirmada;
  items.push({
    clave: "convocatorias",
    titulo: "Convocatorias confirmadas",
    detalle: convocOk
      ? "Ambos clubes confirmaron su plantel"
      : `Falta confirmar: ${[
          !d.convocatoriaLocalConfirmada ? "local" : "",
          !d.convocatoriaVisitanteConfirmada ? "visitante" : "",
        ]
          .filter(Boolean)
          .join(" y ")}`,
    estado: convocOk ? "ok" : "bloqueante",
  });

  const titOk =
    d.titularesLocal >= TITULARES_REQUERIDOS &&
    d.titularesVisitante >= TITULARES_REQUERIDOS;
  items.push({
    clave: "titulares",
    titulo: `${TITULARES_REQUERIDOS} titulares por equipo`,
    detalle: titOk
      ? "Formaciones completas"
      : `Local ${d.titularesLocal}/${TITULARES_REQUERIDOS} · Visitante ${d.titularesVisitante}/${TITULARES_REQUERIDOS}`,
    estado: titOk ? "ok" : "bloqueante",
  });

  const capOk = d.capitanLocal && d.capitanVisitante;
  items.push({
    clave: "capitanes",
    titulo: "Capitanes marcados",
    detalle: capOk
      ? "Ambos equipos tienen capitán"
      : `Falta capitán: ${[!d.capitanLocal ? "local" : "", !d.capitanVisitante ? "visitante" : ""]
          .filter(Boolean)
          .join(" y ")}`,
    estado: capOk ? "ok" : "bloqueante",
  });

  const dupOk =
    d.numerosDuplicadosLocal.length === 0 &&
    d.numerosDuplicadosVisitante.length === 0;
  items.push({
    clave: "numeros",
    titulo: "Números de camiseta únicos",
    detalle: dupOk
      ? "Sin números repetidos"
      : `Repetidos: ${[
          d.numerosDuplicadosLocal.length
            ? `local (${d.numerosDuplicadosLocal.join(", ")})`
            : "",
          d.numerosDuplicadosVisitante.length
            ? `visitante (${d.numerosDuplicadosVisitante.join(", ")})`
            : "",
        ]
          .filter(Boolean)
          .join(" · ")}`,
    estado: dupOk ? "ok" : "bloqueante",
  });

  items.push({
    clave: "segundo_arbitro",
    titulo: "2do árbitro",
    detalle: d.segundoArbitroAsignado ? "Designado" : "No designado (opcional)",
    estado: d.segundoArbitroAsignado ? "ok" : "advertencia",
  });

  items.push({
    clave: "planillero",
    titulo: "Planillero de mesa",
    detalle: d.planilleroAsignado ? "Designado" : "No designado (opcional)",
    estado: d.planilleroAsignado ? "ok" : "advertencia",
  });

  return items;
}

/** ¿El partido puede arrancar? (solo los bloqueantes frenan) */
export function puedeIniciarPartido(items: ItemSemaforo[]): boolean {
  return items.every((i) => i.estado !== "bloqueante");
}

// ---------- Números de camiseta ----------

/** Devuelve los números repetidos dentro de un equipo (vacío = todo bien). */
export function numerosDuplicados(numeros: (number | null)[]): number[] {
  const conteo = new Map<number, number>();
  for (const n of numeros) {
    if (n === null || n === undefined) continue;
    conteo.set(n, (conteo.get(n) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .filter(([, cantidad]) => cantidad > 1)
    .map(([numero]) => numero)
    .sort((a, b) => a - b);
}

// ---------- Faltas acumuladas ----------

export interface FaltasPorTiempo {
  PT: number;
  ST: number;
}

/** Cuenta las faltas de cada equipo separando primer y segundo tiempo. */
export function faltasAcumuladas(
  eventos: EventoBase[],
  homeTeamId: string,
  awayTeamId: string
): { local: FaltasPorTiempo; visitante: FaltasPorTiempo } {
  const resultado = {
    local: { PT: 0, ST: 0 } as FaltasPorTiempo,
    visitante: { PT: 0, ST: 0 } as FaltasPorTiempo,
  };
  for (const e of eventos) {
    if (e.tipo !== "falta") continue;
    const lado = e.teamId === homeTeamId ? "local" : e.teamId === awayTeamId ? "visitante" : null;
    if (!lado) continue;
    const tiempo = e.tiempo === "ST" ? "ST" : "PT";
    resultado[lado][tiempo] += 1;
  }
  return resultado;
}

export type NivelFaltas = "normal" | "aviso" | "limite";

/** Semáforo de faltas de un equipo en el tiempo actual. */
export function nivelFaltas(cantidad: number): NivelFaltas {
  if (cantidad >= FALTAS_LIMITE) return "limite";
  if (cantidad >= FALTAS_AVISO) return "aviso";
  return "normal";
}

// ---------- Tarjetas ----------

/** Cantidad de amarillas que lleva un jugador en el partido. */
export function amarillasDeJugador(eventos: EventoBase[], playerId: string): number {
  return eventos.filter((e) => e.tipo === "amarilla" && e.playerId === playerId).length;
}

/** ¿El jugador ya fue expulsado (roja directa o doble amarilla)? */
export function jugadorExpulsado(eventos: EventoBase[], playerId: string): boolean {
  return eventos.some((e) => e.tipo === "roja" && e.playerId === playerId);
}

/**
 * Si el jugador ya tiene una amarilla, cargarle otra implica roja.
 * Devuelve true para que la interfaz sugiera la expulsión.
 */
export function esDobleAmarilla(eventos: EventoBase[], playerId: string): boolean {
  return amarillasDeJugador(eventos, playerId) >= 1 && !jugadorExpulsado(eventos, playerId);
}

// ---------- Tiempos pedidos ----------

/** ¿El equipo puede pedir tiempo en este tiempo de juego? */
export function puedePedirTiempo(
  eventos: EventoBase[],
  teamId: string,
  tiempo: "PT" | "ST"
): boolean {
  const pedidos = eventos.filter(
    (e) => e.tipo === "tiempo_muerto" && e.teamId === teamId && e.tiempo === tiempo
  ).length;
  return pedidos < TIEMPOS_POR_TIEMPO;
}

/** Tiempos pedidos usados por equipo y tiempo (para mostrar en pantalla). */
export function tiemposPedidosUsados(
  eventos: EventoBase[],
  homeTeamId: string,
  awayTeamId: string
): { local: FaltasPorTiempo; visitante: FaltasPorTiempo } {
  const resultado = {
    local: { PT: 0, ST: 0 } as FaltasPorTiempo,
    visitante: { PT: 0, ST: 0 } as FaltasPorTiempo,
  };
  for (const e of eventos) {
    if (e.tipo !== "tiempo_muerto") continue;
    const lado = e.teamId === homeTeamId ? "local" : e.teamId === awayTeamId ? "visitante" : null;
    if (!lado) continue;
    resultado[lado][e.tiempo === "ST" ? "ST" : "PT"] += 1;
  }
  return resultado;
}

// ---------- Formato de minuto ----------

/** "12' PT" / "7' ST" — el formato que eligió la liga. */
export function formatearMinuto(minuto: number | null, tiempo: "PT" | "ST" | null): string {
  if (minuto === null || minuto === undefined) return "—";
  return `${minuto}' ${tiempo ?? "PT"}`;
}

/** Minuto corrido total del partido (para ordenar el timeline). */
export function minutoTotal(
  minuto: number,
  tiempo: "PT" | "ST",
  duracionTiempoMin: number
): number {
  return tiempo === "ST" ? duracionTiempoMin + minuto : minuto;
}

// ---------- Marcador desde eventos ----------

/** Marcador calculado desde los eventos (gol_en_contra suma al rival). */
export function marcadorDesdeEventos(
  eventos: EventoBase[],
  homeTeamId: string,
  awayTeamId: string
): { local: number; visitante: number } {
  let local = 0;
  let visitante = 0;
  for (const e of eventos) {
    if (e.tipo === "gol") {
      if (e.teamId === homeTeamId) local += 1;
      else if (e.teamId === awayTeamId) visitante += 1;
    } else if (e.tipo === "gol_en_contra") {
      // el jugador se hace el gol en contra: suma al RIVAL
      if (e.teamId === homeTeamId) visitante += 1;
      else if (e.teamId === awayTeamId) local += 1;
    }
  }
  return { local, visitante };
}
