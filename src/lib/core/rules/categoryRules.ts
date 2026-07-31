/**
 * Valida la elegibilidad de un jugador para jugar en una categoría objetivo.
 * 
 * Jerarquía de niveles de categoría (Valores enteros crecientes):
 * - Nivel 1: Sub-14 (Menor)
 * - Nivel 2: Sub-16
 * - Nivel 3: Sub-18
 * - Nivel 4: Primera (Mayor)
 * 
 * Regla: Un jugador de categoría inferior (nivel menor) puede jugar en una categoría superior (nivel mayor).
 * Un jugador de categoría superior (nivel mayor) NUNCA puede ser alineado en una inferior (nivel menor).
 * 
 * @param playerCategoryLevel Nivel de categoría base del jugador (1-4)
 * @param targetCategoryLevel Nivel de categoría de destino del partido (1-4)
 */
export function validateCategoryEligibility(
  playerCategoryLevel: number,
  targetCategoryLevel: number
): boolean {
  if (playerCategoryLevel > targetCategoryLevel) {
    throw new Error(
      "Bloqueo LFS: Un jugador de categoría superior no puede ser alineado en una categoría inferior."
    );
  }
  return true;
}
