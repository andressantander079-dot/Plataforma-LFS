/**
 * REGLAS DE DASHBOARD — Lógica pura y testeable
 * Todo lo que decide QUÉ se muestra en los paneles de inicio de cada rol:
 * saludos por horario, semáforo de urgencias (criterio 48 hs), racha de
 * resultados, mini-gráficos de actividad y textos de cuenta regresiva.
 * No toca la base de datos: recibe datos y devuelve decisiones.
 */

// ---------------------------------------------------------------------------
// SALUDO INTELIGENTE
// ---------------------------------------------------------------------------

/** Devuelve el saludo según la hora del día (0-23). */
export function saludoPorHora(hora: number): string {
  if (hora >= 6 && hora < 12) return "Buenos días";
  if (hora >= 12 && hora < 20) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Hora actual en Ushuaia (America/Argentina/Ushuaia) sin importar dónde
 * corra el servidor. Devuelve 0-23.
 */
export function horaUshuaia(ahora: Date = new Date()): number {
  const horaStr = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Ushuaia",
    hour: "numeric",
    hour12: false,
  }).format(ahora);
  const h = parseInt(horaStr, 10);
  return Number.isNaN(h) ? ahora.getHours() : h % 24;
}

/** "Buenas tardes, Andrés — tenés 3 cosas que requieren tu atención" */
export function armarSaludo(nombre: string | null | undefined, pendientes: number, ahora: Date = new Date()): string {
  const saludo = saludoPorHora(horaUshuaia(ahora));
  const soloNombre = (nombre ?? "").trim().split(" ")[0] || "equipo";
  if (pendientes <= 0) return `${saludo}, ${soloNombre} — está todo al día 🙌`;
  if (pendientes === 1) return `${saludo}, ${soloNombre} — tenés 1 cosa que requiere tu atención`;
  return `${saludo}, ${soloNombre} — tenés ${pendientes} cosas que requieren tu atención`;
}

// ---------------------------------------------------------------------------
// SEMÁFORO DE URGENCIAS (criterio 48 hs elegido por el usuario)
// ---------------------------------------------------------------------------

export type NivelUrgencia = "rojo" | "amarillo" | "info";

export const HORAS_URGENTE = 48;

/**
 * Clasifica una tarea pendiente según cuánto tiempo pasó desde su fecha
 * de referencia (ej.: el partido se jugó y la planilla sigue sin cargarse).
 *  - rojo:    pasaron más de `horasUmbral` hs (vencido, hay que actuar YA)
 *  - amarillo: pasó la fecha pero menos de `horasUmbral` hs (próximo a vencer)
 *  - info:    todavía no venció (futuro o sin fecha)
 */
export function clasificarUrgencia(
  fechaReferencia: Date | string | null,
  ahora: Date = new Date(),
  horasUmbral: number = HORAS_URGENTE
): NivelUrgencia {
  if (!fechaReferencia) return "info";
  const fecha = fechaReferencia instanceof Date ? fechaReferencia : new Date(fechaReferencia);
  if (Number.isNaN(fecha.getTime())) return "info";
  const horasPasadas = (ahora.getTime() - fecha.getTime()) / 3_600_000;
  if (horasPasadas < 0) return "info";
  return horasPasadas >= horasUmbral ? "rojo" : "amarillo";
}

/** Item de la lista "Requiere atención" (ya clasificado). */
export interface ItemAtencion {
  nivel: NivelUrgencia;
  titulo: string;
  detalle: string;
  href: string;
  accion: string;
}

/** Ordena el semáforo: rojos primero, luego amarillos, al final info. */
export function ordenarPorUrgencia(items: ItemAtencion[]): ItemAtencion[] {
  const peso: Record<NivelUrgencia, number> = { rojo: 0, amarillo: 1, info: 2 };
  return [...items].sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

// ---------------------------------------------------------------------------
// RACHA DE RESULTADOS (círculos W/D/L estilo apps deportivas)
// ---------------------------------------------------------------------------

export type ResultadoRacha = "W" | "D" | "L";

export interface PartidoResultado {
  golesFavor: number;
  golesContra: number;
}

/**
 * Últimos `cantidad` resultados de un equipo, del más viejo al más reciente
 * (se muestran de izquierda a derecha, el último a la derecha).
 */
export function calcularRacha(partidos: PartidoResultado[], cantidad = 5): ResultadoRacha[] {
  return partidos.slice(-cantidad).map((p) => {
    if (p.golesFavor > p.golesContra) return "W";
    if (p.golesFavor < p.golesContra) return "L";
    return "D";
  });
}

// ---------------------------------------------------------------------------
// MINI-GRÁFICO (sparkline) DE ACTIVIDAD
// ---------------------------------------------------------------------------

/**
 * Agrupa fechas en `dias` buckets diarios terminando hoy.
 * Devuelve un array de largo `dias` con el conteo de cada día
 * (el último índice es hoy).
 */
export function bucketsPorDia(
  fechas: (Date | string)[],
  dias: number,
  ahora: Date = new Date()
): number[] {
  const buckets = new Array<number>(dias).fill(0);
  const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  for (const f of fechas) {
    const fecha = f instanceof Date ? f : new Date(f);
    if (Number.isNaN(fecha.getTime())) continue;
    const inicioEseDia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const diffDias = Math.floor((inicioHoy.getTime() - inicioEseDia.getTime()) / 86_400_000);
    if (diffDias >= 0 && diffDias < dias) buckets[dias - 1 - diffDias]++;
  }
  return buckets;
}

/**
 * Convierte valores en los puntos "x,y x,y ..." de una polyline SVG.
 * Si todos los valores son 0, dibuja una línea plana al pie.
 */
export function puntosSparkline(
  valores: number[],
  ancho: number,
  alto: number,
  padding = 2
): string {
  if (valores.length === 0) return "";
  if (valores.length === 1) {
    const y = alto - padding;
    return `${padding},${y} ${ancho - padding},${y}`;
  }
  const max = Math.max(...valores, 1);
  const pasoX = (ancho - padding * 2) / (valores.length - 1);
  return valores
    .map((v, i) => {
      const x = padding + i * pasoX;
      const y = alto - padding - (v / max) * (alto - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// CUENTA REGRESIVA DEL PRÓXIMO PARTIDO
// ---------------------------------------------------------------------------

/**
 * Texto amigable de cuánto falta: "¡Es hoy! 16:00", "Faltan 2 días y 4 hs",
 * "Faltan 45 min". Si ya pasó (hace menos de 3 hs): "¡Se está jugando!".
 */
export function textoCountdown(fechaPartido: Date | string, ahora: Date = new Date()): string {
  const fecha = fechaPartido instanceof Date ? fechaPartido : new Date(fechaPartido);
  if (Number.isNaN(fecha.getTime())) return "";
  const diffMs = fecha.getTime() - ahora.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < -180) return "Finalizado";
  if (diffMin <= 0) return "¡Se está jugando!";

  const mismoDia =
    fecha.getFullYear() === ahora.getFullYear() &&
    fecha.getMonth() === ahora.getMonth() &&
    fecha.getDate() === ahora.getDate();

  if (diffMin < 60) return `Faltan ${diffMin} min`;
  if (mismoDia) {
    const hs = Math.floor(diffMin / 60);
    const min = diffMin % 60;
    return min > 0 ? `¡Es hoy! Faltan ${hs} hs ${min} min` : `¡Es hoy! Faltan ${hs} hs`;
  }
  const dias = Math.floor(diffMin / 1440);
  const hs = Math.floor((diffMin % 1440) / 60);
  if (dias === 1) return hs > 0 ? `Falta 1 día y ${hs} hs` : "Falta 1 día";
  return hs > 0 ? `Faltan ${dias} días y ${hs} hs` : `Faltan ${dias} días`;
}

// ---------------------------------------------------------------------------
// TEXTOS DE CONTEO EN ESPAÑOL RIOPLATENSE
// ---------------------------------------------------------------------------

/** textoConteo(1, "planilla", "planillas") → "1 planilla"; (3, ...) → "3 planillas" */
export function textoConteo(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

// ---------------------------------------------------------------------------
// DOCUMENTACIÓN DE JUGADORES (alerta "faltan documentos")
// ---------------------------------------------------------------------------

/**
 * Cantidad de jugadores con documentación INCOMPLETA.
 * `documentos` es el mapa clave→ruta que guarda la base (players.documents).
 * Se considera completo solo si tiene TODAS las claves obligatorias.
 */
export function contarDocumentacionIncompleta(
  jugadores: { documents: Record<string, string> | null }[],
  clavesObligatorias: readonly string[]
): number {
  return jugadores.filter((j) => {
    const docs = j.documents ?? {};
    return clavesObligatorias.some((clave) => !docs[clave]);
  }).length;
}
