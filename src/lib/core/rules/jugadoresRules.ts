/**
 * REGLAS DE JUGADORES (Paso 9B)
 * Edad, mayoría de edad y validación de categorías por año de nacimiento.
 * Todo son funciones puras: se prueban con vitest sin tocar la base.
 */

export interface CategoriaConRango {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

/** ¿Es menor de 18 años a la fecha de referencia? (sin fecha de nac. → no se sabe → false) */
export function calcularEsMenor(
  fechaNacimiento: string | null | undefined,
  hoy: Date = new Date()
): boolean {
  if (!fechaNacimiento) return false;
  const nac = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nac.getTime())) return false;
  const cumple18 = new Date(nac.getFullYear() + 18, nac.getMonth(), nac.getDate());
  return cumple18 > hoy;
}

/** Edad en años cumplidos a la fecha de referencia (null si la fecha es inválida). */
export function calcularEdad(
  fechaNacimiento: string,
  hoy: Date = new Date()
): number | null {
  const nac = new Date(`${fechaNacimiento}T00:00:00`);
  if (Number.isNaN(nac.getTime())) return null;
  let edad = hoy.getFullYear() - nac.getFullYear();
  const cumpleEsteAnio = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
  if (cumpleEsteAnio > hoy) edad--;
  return edad;
}

/** Año de nacimiento desde una fecha ISO (YYYY-MM-DD). */
export function anioDeFecha(fechaIso: string | null | undefined): number | null {
  if (!fechaIso || fechaIso.length < 4) return null;
  const anio = Number(fechaIso.slice(0, 4));
  return Number.isInteger(anio) && anio > 1900 ? anio : null;
}

/**
 * ¿En qué categoría le toca jugar por su año de nacimiento?
 * Devuelve null si ninguna categoría tiene rango configurado o si el año
 * cae fuera de todos los rangos (en ese caso no se bloquea nada).
 */
export function categoriaSugeridaPorAnio(
  anio: number,
  categorias: CategoriaConRango[]
): CategoriaConRango | null {
  const conRango = categorias.filter(
    (c) => c.anio_desde !== null && c.anio_hasta !== null
  );
  if (conRango.length === 0) return null;
  return (
    conRango.find((c) => anio >= (c.anio_desde as number) && anio <= (c.anio_hasta as number)) ??
    null
  );
}

/**
 * Validación de inscripción por año de nacimiento:
 *  · Si ninguna categoría tiene rango → no se bloquea nada (ok).
 *  · Si el año cae fuera de todos los rangos → no se bloquea nada (ok).
 *  · La categoría BASE (la de menor nivel jerárquico entre las elegidas)
 *    TIENE que ser la de su año. Si eligió una menor → error con sugerencia
 *    ("Podría jugar en Sub-…"). Si eligió solo mayores → falta la base.
 *  · Base correcta + categorías mayores (jugar "para arriba") → ok.
 */
export function validarCategoriasPorAnio(
  anio: number,
  seleccionadasIds: string[],
  categorias: CategoriaConRango[]
): { ok: boolean; error?: string } {
  const sugerida = categoriaSugeridaPorAnio(anio, categorias);
  if (!sugerida) return { ok: true }; // sin rangos o fuera de rango: no bloquea

  const seleccionadas = categorias.filter((c) => seleccionadasIds.includes(c.id));
  if (seleccionadas.length === 0) return { ok: true }; // lo valida otra regla

  // La base es la de MENOR nivel jerárquico entre las elegidas
  const base = [...seleccionadas].sort(
    (a, b) => a.level_hierarchy - b.level_hierarchy
  )[0];

  if (base.id === sugerida.id) return { ok: true };

  if (base.level_hierarchy < sugerida.level_hierarchy) {
    return {
      ok: false,
      error: `Por su año de nacimiento (${anio}), este jugador no puede jugar en ${base.name}. Podría jugar en ${sugerida.name}.`,
    };
  }

  return {
    ok: false,
    error: `Por su año de nacimiento (${anio}), la categoría base de este jugador es ${sugerida.name}: inscribilo primero ahí y, si querés, también en categorías mayores.`,
  };
}
