/**
 * LLAVES DE PLAYOFF — Lógica pura (Paso 7C)
 * Sin base de datos: recibe equipos y devuelve cruces. Se testea con vitest.
 *
 * Conceptos:
 *  - Etapa: fase_regular → octavos → cuartos → semifinal → final.
 *  - Semilla (seed): posición en la tabla al terminar la fase regular.
 *  - stage_order: número de partido dentro de la llave; los ganadores de
 *    partidos 1 y 2 se cruzan entre sí, igual 3 y 4, y así.
 */

export type Etapa = "fase_regular" | "octavos" | "cuartos" | "semifinal" | "final";

export const NOMBRE_ETAPA: Record<Etapa, string> = {
  fase_regular: "Fase regular",
  octavos: "Octavos de final",
  cuartos: "Cuartos de final",
  semifinal: "Semifinales",
  final: "Final",
};

/** Orden de las etapas para listarlas (la final va última). */
export const ORDEN_ETAPA: Record<Etapa, number> = {
  fase_regular: 0,
  octavos: 1,
  cuartos: 2,
  semifinal: 3,
  final: 4,
};

/** Etapa inicial de una llave según cuántos equipos participan. */
export function etapaParaCantidad(equipos: number): Etapa {
  if (equipos <= 2) return "final";
  if (equipos <= 4) return "semifinal";
  if (equipos <= 8) return "cuartos";
  return "octavos";
}

/** Etapa que sigue (null si ya es la final). */
export function siguienteEtapa(etapa: Etapa): Etapa | null {
  switch (etapa) {
    case "octavos":
      return "cuartos";
    case "cuartos":
      return "semifinal";
    case "semifinal":
      return "final";
    default:
      return null;
  }
}

export interface CruceLlave {
  homeIndex: number; // índice dentro del array de participantes
  awayIndex: number;
  orden: number; // stage_order
}

/**
 * Reparto de grupos con sistema "serpiente" (snake draft):
 * con 8 equipos y 2 grupos queda A: 1,4,5,8 — B: 2,3,6,7,
 * así los grupos quedan parejos.
 */
export function asignarGrupos(
  teamIds: string[],
  groupsCount: number
): { nombre: string; teamIds: string[] }[] {
  const grupos: { nombre: string; teamIds: string[] }[] = [];
  for (let g = 0; g < groupsCount; g++) {
    grupos.push({ nombre: String.fromCharCode(65 + g), teamIds: [] });
  }
  teamIds.forEach((id, i) => {
    const vuelta = Math.floor(i / groupsCount);
    const pos = i % groupsCount;
    const grupo = vuelta % 2 === 0 ? pos : groupsCount - 1 - pos;
    grupos[grupo].teamIds.push(id);
  });
  return grupos;
}

/**
 * Orden de sembrado clásico de llave: con 4 equipos [1,4,2,3];
 * con 8 equipos [1,8,4,5,2,7,3,6]. Así el 1° y el 2° solo pueden
 * cruzarse en la final.
 */
export function ordenSembrado(cantidad: number): number[] {
  let semillas = [1, 2];
  let n = 2;
  while (n < cantidad) {
    n *= 2;
    const siguiente: number[] = [];
    for (const s of semillas) {
      siguiente.push(s, n + 1 - s);
    }
    semillas = siguiente;
  }
  return semillas;
}

/**
 * Cruces de la primera llave a partir de CLASIFICADOS ORDENADOS
 * (índice 0 = 1° de la tabla). Devuelve pares por índice del array.
 */
export function crucesSembrados(cantidad: number): CruceLlave[] {
  const semillas = ordenSembrado(cantidad);
  const cruces: CruceLlave[] = [];
  for (let i = 0; i < semillas.length; i += 2) {
    cruces.push({
      homeIndex: semillas[i] - 1,
      awayIndex: semillas[i + 1] - 1,
      orden: cruces.length + 1,
    });
  }
  return cruces;
}

/**
 * Primera ronda de ELIMINACIÓN DIRECTA con sorteo puro (sin tabla previa).
 * La llave se dimensiona a la próxima potencia de 2; los equipos que sobran
 * pasan de ronda directo (bye). Devuelve la etapa, los cruces y los byes.
 */
export function primeraRondaEliminacion(teamIds: string[]): {
  etapa: Etapa;
  cruces: { home: string; away: string; orden: number }[];
  byes: string[];
} {
  const n = teamIds.length;
  let tamLlave = 2;
  while (tamLlave < n) tamLlave *= 2;

  const byesCount = tamLlave - n;
  const juegan = teamIds.slice(byesCount);
  const byes = teamIds.slice(0, byesCount);

  const cruces: { home: string; away: string; orden: number }[] = [];
  for (let i = 0; i + 1 < juegan.length; i += 2) {
    cruces.push({ home: juegan[i], away: juegan[i + 1], orden: cruces.length + 1 });
  }

  return { etapa: etapaParaCantidad(tamLlave), cruces, byes };
}

/**
 * Cruces de playoff para formato GRUPOS: clasifican los 2 primeros de cada
 * grupo y se cruzan 1° de un grupo contra 2° de otro.
 * clasificados[i] = equipo en la posición i (por grupo, ordenado).
 * Con 2 grupos → semifinales. Con 4 grupos → cuartos.
 */
export function crucesEntreGrupos(
  clasificadosPorGrupo: { grupo: string; posicion: number; teamId: string }[]
): { home: string; away: string; orden: number }[] {
  const primeros = clasificadosPorGrupo.filter((c) => c.posicion === 1);
  const segundos = clasificadosPorGrupo.filter((c) => c.posicion === 2);
  const n = primeros.length;

  const cruces: { home: string; away: string; orden: number }[] = [];
  for (let i = 0; i < n; i++) {
    // 1° del grupo i contra 2° del grupo siguiente (cruzado)
    const rival = (i + 1) % n;
    cruces.push({
      home: primeros[i].teamId,
      away: segundos[rival].teamId,
      orden: cruces.length + 1,
    });
  }

  // Reordenar para que los ganadores de partidos 1-2 y 3-4 se crucen
  // entre sí en la siguiente ronda (igual que en el sembrado clásico).
  if (cruces.length === 4) {
    return [cruces[0], cruces[2], cruces[1], cruces[3]].map((c, i) => ({
      ...c,
      orden: i + 1,
    }));
  }
  return cruces;
}

/**
 * Empareja a los PARTICIPANTES de una ronda para armar la siguiente:
 * ganadores ordenados por stage_order + equipos que pasaron de ronda (bye).
 * Se cruzan consecutivos: 1° con 2°, 3° con 4°…
 */
export function emparejarSiguienteRonda(participantes: string[]): {
  home: string;
  away: string;
  orden: number;
}[] {
  const cruces: { home: string; away: string; orden: number }[] = [];
  for (let i = 0; i + 1 < participantes.length; i += 2) {
    cruces.push({ home: participantes[i], away: participantes[i + 1], orden: cruces.length + 1 });
  }
  return cruces;
}
