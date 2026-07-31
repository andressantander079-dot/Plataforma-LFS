export interface TeamStats {
  won: number;
  drawn: number;
  lost: number;
}

/**
 * Calcula el puntaje total de un equipo basado en sus partidos ganados y empatados.
 * Aislado del árbol de renderizado para garantizar SRP y pruebas unitarias puras.
 */
export function calculatePoints(
  stats: TeamStats,
  winPoints = 3,
  drawPoints = 1
): number {
  return stats.won * winPoints + stats.drawn * drawPoints;
}
