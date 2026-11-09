/**
 * REGLAS DE FIRMAS DIGITALES — Paso 17C
 * Quiénes firman la planilla, quién vota la figura y cuándo se puede
 * cerrar. Solo la firma del árbitro principal es obligatoria; si otro
 * no firma queda el registro "No firmó".
 * Funciones PURAS.
 */

export type RolFirma =
  | "principal"
  | "segundo_arbitro"
  | "planillero"
  | "dt_local"
  | "dt_visitante"
  | "capitan_local"
  | "capitan_visitante";

export const ROLES_FIRMA: RolFirma[] = [
  "capitan_local",
  "capitan_visitante",
  "dt_local",
  "dt_visitante",
  "principal",
  "segundo_arbitro",
  "planillero",
];

export const ETIQUETA_ROL: Record<RolFirma, string> = {
  principal: "Árbitro principal",
  segundo_arbitro: "2do árbitro",
  planillero: "Planillero/a",
  dt_local: "DT Local",
  dt_visitante: "DT Visitante",
  capitan_local: "Capitán Local",
  capitan_visitante: "Capitán Visitante",
};

export interface FirmaRegistro {
  path: string | null; // ruta en el bucket firmas-planillas
  nombre: string;
  firmo: boolean; // false = se registró "No firmó"
  firmadoAt: string | null;
}

export type MapaFirmas = Partial<Record<RolFirma, FirmaRegistro>>;

/** La única firma que bloquea el cierre es la del árbitro principal. */
export function esFirmaObligatoria(rol: RolFirma): boolean {
  return rol === "principal";
}

/**
 * Roles que efectivamente firman en este partido: si no hay 2do árbitro
 * o planillero designados, esos roles no aparecen.
 */
export function rolesPresentes(opciones: {
  haySegundoArbitro: boolean;
  hayPlanillero: boolean;
}): RolFirma[] {
  return ROLES_FIRMA.filter((rol) => {
    if (rol === "segundo_arbitro") return opciones.haySegundoArbitro;
    if (rol === "planillero") return opciones.hayPlanillero;
    return true;
  });
}

export interface EstadoFirmas {
  firmadas: number;
  total: number;
  faltantes: RolFirma[]; // no firmaron todavía (ni "No firmó")
  noFirmaron: RolFirma[]; // registraron "No firmó"
  puedeCerrar: boolean; // firma del principal presente
}

/** Resumen del estado de las firmas para el wizard de cierre. */
export function estadoFirmas(
  firmas: MapaFirmas,
  presentes: RolFirma[]
): EstadoFirmas {
  const faltantes: RolFirma[] = [];
  const noFirmaron: RolFirma[] = [];
  let firmadas = 0;

  for (const rol of presentes) {
    const firma = firmas[rol];
    if (!firma) {
      faltantes.push(rol);
    } else if (!firma.firmo) {
      noFirmaron.push(rol);
    } else {
      firmadas += 1;
    }
  }

  const principal = firmas.principal;
  return {
    firmadas,
    total: presentes.length,
    faltantes,
    noFirmaron,
    puedeCerrar: Boolean(principal?.firmo),
  };
}

/** Ruta de la firma dentro del bucket privado. */
export function rutaFirma(matchId: string, rol: RolFirma): string {
  return `${matchId}/${rol}.png`;
}

// ---------- Votación de la figura del partido ----------

/** Los que votan la figura: oficiales presentes + ambos DTs. */
export type VotanteFigura =
  | "principal"
  | "segundo_arbitro"
  | "planillero"
  | "dt_local"
  | "dt_visitante";

export interface VotoFigura {
  votante: VotanteFigura;
  jugadorId: string;
}

/** Quiénes votan según los oficiales presentes. */
export function votantesEsperados(opciones: {
  haySegundoArbitro: boolean;
  hayPlanillero: boolean;
}): VotanteFigura[] {
  const votantes: VotanteFigura[] = ["dt_local", "dt_visitante", "principal"];
  if (opciones.haySegundoArbitro) votantes.push("segundo_arbitro");
  if (opciones.hayPlanillero) votantes.push("planillero");
  return votantes;
}

/**
 * Agrega o reemplaza el voto de un votante (si vuelve a votar,
 * pisa el voto anterior).
 */
export function registrarVoto(
  votos: VotoFigura[],
  votante: VotanteFigura,
  jugadorId: string
): VotoFigura[] {
  const resto = votos.filter((v) => v.votante !== votante);
  return [...resto, { votante, jugadorId }];
}

/** ¿Votaron todos los esperados? */
export function votacionCompleta(
  votos: VotoFigura[],
  esperados: VotanteFigura[]
): boolean {
  return esperados.every((v) => votos.some((x) => x.votante === v));
}

/**
 * Gana el más votado. En empate, decide el voto del árbitro principal
 * (si él votó a uno de los empatados). Si no hay forma de desempatar,
 * devuelve null y la interfaz le pide al principal que elija.
 */
export function ganadorFigura(
  votos: VotoFigura[],
  votanteDesempate: VotanteFigura = "principal"
): { jugadorId: string; votos: number; empate: boolean } | null {
  if (votos.length === 0) return null;

  const conteo = new Map<string, number>();
  for (const v of votos) {
    conteo.set(v.jugadorId, (conteo.get(v.jugadorId) ?? 0) + 1);
  }
  const max = Math.max(...conteo.values());
  const lideres = [...conteo.entries()]
    .filter(([, cantidad]) => cantidad === max)
    .map(([jugadorId]) => jugadorId);

  if (lideres.length === 1) {
    return { jugadorId: lideres[0], votos: max, empate: false };
  }

  const votoDesempate = votos.find((v) => v.votante === votanteDesempate);
  if (votoDesempate && lideres.includes(votoDesempate.jugadorId)) {
    return { jugadorId: votoDesempate.jugadorId, votos: max, empate: true };
  }
  return null;
}
