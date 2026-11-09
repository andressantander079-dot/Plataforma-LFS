// =============================================================================
// ESTADÍSTICAS GLOBALES — Reglas PURAS y testeables (Paso 17B).
// Buckets mensuales para gráficos de evolución, etiquetas, promedios,
// variaciones porcentuales y racha de resultados (para el club).
// =============================================================================

export interface PuntoMensual {
  mes: string; // 'YYYY-MM'
  etiqueta: string; // "nov 26"
  cantidad: number;
}

/** Últimos N meses en clave 'YYYY-MM' (incluye el actual), de más viejo a más nuevo. */
export function ultimosMeses(n: number, desde: Date = new Date()): string[] {
  const meses: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(desde.getFullYear(), desde.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return meses;
}

export function etiquetaMesCorto(mes: string): string {
  const texto = new Date(`${mes}-15T12:00:00`).toLocaleDateString("es-AR", {
    month: "short",
  });
  return texto.replace(".", "");
}

/**
 * Reparte fechas ISO en buckets mensuales (últimos N meses).
 * Las fechas fuera del rango se ignoran.
 */
export function agruparEnMeses(
  fechas: string[],
  n: number = 6,
  desde: Date = new Date()
): PuntoMensual[] {
  const meses = ultimosMeses(n, desde);
  const conteo = new Map<string, number>(meses.map((m) => [m, 0]));
  for (const iso of fechas) {
    const mes = iso.slice(0, 7);
    if (conteo.has(mes)) conteo.set(mes, (conteo.get(mes) ?? 0) + 1);
  }
  return meses.map((m) => ({
    mes: m,
    etiqueta: etiquetaMesCorto(m),
    cantidad: conteo.get(m) ?? 0,
  }));
}

/** "1,8" con coma decimal estilo es-AR, 1 decimal sin redondeo raro. */
export function promedioTexto(total: number, cantidad: number): string {
  if (cantidad === 0) return "0";
  return (Math.round((total / cantidad) * 10) / 10).toLocaleString("es-AR");
}

/** Variación porcentual entre dos números (null si no hay base). */
export function variacionPorcentual(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual > 0 ? 100 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

// ---------------------------------------------------------------------------
// RACHA DE RESULTADOS (club): últimos N partidos confirmados
// ---------------------------------------------------------------------------

export type ResultadoRacha = "G" | "E" | "P"; // ganó, empató, perdió

export interface PartidoParaRacha {
  golesFavor: number;
  golesContra: number;
}

export function resultadoDe(p: PartidoParaRacha): ResultadoRacha {
  if (p.golesFavor > p.golesContra) return "G";
  if (p.golesFavor === p.golesContra) return "E";
  return "P";
}

/** Racha de los últimos `n` partidos (el más reciente al final). */
export function rachaDe(partidos: PartidoParaRacha[], n = 5): ResultadoRacha[] {
  return partidos.slice(-n).map(resultadoDe);
}

/** Puntos de una racha (G=3, E=1, P=0) — para el porcentaje de efectividad. */
export function puntosDe(racha: ResultadoRacha[]): number {
  return racha.reduce((acc, r) => acc + (r === "G" ? 3 : r === "E" ? 1 : 0), 0);
}
