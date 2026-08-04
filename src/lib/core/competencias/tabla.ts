/**
 * TABLA DE POSICIONES — Cálculo automático
 * Se alimenta solo de partidos con resultado CONFIRMADO por la federación.
 * Puntos configurables por torneo y dos criterios de desempate:
 *  - diferencia_gol: DIF descendente, luego goles a favor
 *  - enfrentamiento_directo: mini-tabla entre los empatados, luego DIF general
 */

export interface PartidoParaTabla {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
}

export interface ConfigTabla {
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  tiebreaker: "diferencia_gol" | "enfrentamiento_directo";
}

export interface FilaTabla {
  teamId: string;
  puntos: number;
  pj: number; // partidos jugados
  pg: number; // ganados
  pe: number; // empatados
  pp: number; // perdidos
  gf: number; // goles a favor
  gc: number; // goles en contra
  dif: number; // diferencia de gol
}

export function calcularTabla(
  teamIds: string[],
  partidos: PartidoParaTabla[],
  config: ConfigTabla
): FilaTabla[] {
  const filas = new Map<string, FilaTabla>();
  for (const id of teamIds) {
    filas.set(id, { teamId: id, puntos: 0, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dif: 0 });
  }

  for (const p of partidos) {
    const local = filas.get(p.homeTeamId);
    const visitante = filas.get(p.awayTeamId);
    if (!local || !visitante) continue;

    local.pj++;
    visitante.pj++;
    local.gf += p.homeScore;
    local.gc += p.awayScore;
    visitante.gf += p.awayScore;
    visitante.gc += p.homeScore;

    if (p.homeScore > p.awayScore) {
      local.pg++;
      local.puntos += config.pointsWin;
      visitante.pp++;
      visitante.puntos += config.pointsLoss;
    } else if (p.homeScore < p.awayScore) {
      visitante.pg++;
      visitante.puntos += config.pointsWin;
      local.pp++;
      local.puntos += config.pointsLoss;
    } else {
      local.pe++;
      visitante.pe++;
      local.puntos += config.pointsDraw;
      visitante.puntos += config.pointsDraw;
    }
  }

  for (const fila of filas.values()) {
    fila.dif = fila.gf - fila.gc;
  }

  const resultado = Array.from(filas.values());

  resultado.sort((a, b) => {
    if (b.puntos !== a.puntos) return b.puntos - a.puntos;
    if (config.tiebreaker === "enfrentamiento_directo") {
      return desempateDirecto(a, b, partidos, config);
    }
    // diferencia_gol
    if (b.dif !== a.dif) return b.dif - a.dif;
    if (b.gf !== a.gf) return b.gf - a.gf;
    return 0;
  });

  return resultado;
}

/**
 * Desempate por enfrentamiento directo: mini-tabla con los partidos
 * entre los dos equipos empatados. Si persisten, DIF general y GF general.
 */
function desempateDirecto(
  a: FilaTabla,
  b: FilaTabla,
  partidos: PartidoParaTabla[],
  config: ConfigTabla
): number {
  const entreEllos = partidos.filter(
    (p) =>
      (p.homeTeamId === a.teamId && p.awayTeamId === b.teamId) ||
      (p.homeTeamId === b.teamId && p.awayTeamId === a.teamId)
  );

  const mini = calcularTabla([a.teamId, b.teamId], entreEllos, {
    ...config,
    tiebreaker: "diferencia_gol", // dentro del mini-cruce manda la diferencia de gol
  });

  const posA = mini.findIndex((f) => f.teamId === a.teamId);
  const posB = mini.findIndex((f) => f.teamId === b.teamId);
  if (posA !== posB && mini[posA].puntos !== mini[posB].puntos) return posA - posB;
  if (mini[posA].dif !== mini[posB].dif) return mini[posB].dif - mini[posA].dif;

  // Si ni el cruce directo los separa, vale la diferencia de gol general
  if (b.dif !== a.dif) return b.dif - a.dif;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return 0;
}

/** Valla menos vencida: el equipo con menos goles en contra (null si no hay datos). */
export function vallaMenosVencida(tabla: FilaTabla[]): FilaTabla | null {
  const conPartidos = tabla.filter((f) => f.pj > 0);
  if (conPartidos.length === 0) return null;
  return conPartidos.reduce((min, f) => (f.gc < min.gc ? f : min), conPartidos[0]);
}
