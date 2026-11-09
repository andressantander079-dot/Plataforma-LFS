// =============================================================================
// AGENDA DE LA LIGA — Reglas de negocio PURAS y testeables (sin base de datos).
// Cubre: tipos de evento con color, audiencias de aviso, validaciones del
// formulario, armado del calendario mensual y ordenamiento de ítems.
// =============================================================================

// ---------------------------------------------------------------------------
// 1) TIPOS DE EVENTO (con color de marca para chips y calendario)
// ---------------------------------------------------------------------------

export type TipoEvento =
  | "reunion_delegados"
  | "congreso"
  | "cierre_inscripcion"
  | "consejo"
  | "evento_social"
  | "otro";

export interface TipoEventoUI {
  nombre: string;
  /** Color principal (chips, puntos del calendario). */
  color: string;
  /** Fondo suave para tarjetas. */
  fondo: string;
}

export const TIPOS_EVENTO: Record<TipoEvento, TipoEventoUI> = {
  reunion_delegados: { nombre: "Reunión de delegados", color: "#F97316", fondo: "bg-orange-50" },
  congreso:          { nombre: "Congreso",             color: "#7C3AED", fondo: "bg-violet-50" },
  cierre_inscripcion:{ nombre: "Cierre de inscripción",color: "#DC2626", fondo: "bg-rose-50" },
  consejo:           { nombre: "Consejo",              color: "#1A2A44", fondo: "bg-slate-100" },
  evento_social:     { nombre: "Evento social",        color: "#0F766E", fondo: "bg-teal-50" },
  otro:              { nombre: "Otro",                 color: "#64748B", fondo: "bg-slate-50" },
};

export const TIPOS_EVENTO_LISTA = Object.entries(TIPOS_EVENTO).map(([id, ui]) => ({
  id: id as TipoEvento,
  ...ui,
}));

export function esTipoEventoValido(tipo: string): tipo is TipoEvento {
  return tipo in TIPOS_EVENTO;
}

// ---------------------------------------------------------------------------
// 2) AUDIENCIAS DE AVISO (mensajería interna al crear el evento)
// ---------------------------------------------------------------------------

export type AudienciaAviso = "nadie" | "clubes" | "arbitros" | "todos";

export const AUDIENCIAS_AVISO: Record<AudienciaAviso, string> = {
  nadie: "Sin aviso",
  clubes: "Avisar a los clubes",
  arbitros: "Avisar a los árbitros",
  todos: "Avisar a clubes y árbitros",
};

export function esAudienciaValida(a: string): a is AudienciaAviso {
  return a in AUDIENCIAS_AVISO;
}

// ---------------------------------------------------------------------------
// 3) VALIDACIÓN DEL FORMULARIO
// ---------------------------------------------------------------------------

export interface InputEvento {
  titulo: string;
  tipo: string;
  fecha: string; // 'YYYY-MM-DD'
  hora?: string | null; // 'HH:MM' o vacío
  ubicacion?: string | null;
  descripcion?: string | null;
  avisar?: string;
}

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validarEvento(input: InputEvento): Record<string, string> {
  const errores: Record<string, string> = {};

  const titulo = input.titulo.trim();
  if (titulo.length < 4 || titulo.length > 140) {
    errores.titulo = "El título tiene que tener entre 4 y 140 caracteres.";
  }

  if (!esTipoEventoValido(input.tipo)) {
    errores.tipo = "Elegí un tipo de evento válido.";
  }

  if (!REGEX_FECHA.test(input.fecha) || isNaN(new Date(`${input.fecha}T12:00:00`).getTime())) {
    errores.fecha = "La fecha es obligatoria.";
  }

  if (input.hora && !REGEX_HORA.test(input.hora)) {
    errores.hora = "La hora tiene que tener formato HH:MM (24 hs).";
  }

  if ((input.ubicacion?.length ?? 0) > 140) {
    errores.ubicacion = "La ubicación no puede superar los 140 caracteres.";
  }

  if ((input.descripcion?.length ?? 0) > 500) {
    errores.descripcion = "La descripción no puede superar los 500 caracteres.";
  }

  if (input.avisar !== undefined && !esAudienciaValida(input.avisar)) {
    errores.avisar = "Audiencia de aviso inválida.";
  }

  return errores;
}

// ---------------------------------------------------------------------------
// 4) ÍTEMS DE AGENDA (eventos propios + partidos automáticos del fixture)
// ---------------------------------------------------------------------------

export interface ItemAgenda {
  kind: "evento" | "partido";
  id: string;
  fecha: string; // 'YYYY-MM-DD'
  hora: string | null; // 'HH:MM'
  titulo: string;
  detalle: string | null; // ubicación o "Local vs Visitante · Torneo"
  tipo: TipoEvento | null; // null en partidos
  href: string | null; // link al detalle (partidos) o null
}

export function ordenarItemsAgenda(items: ItemAgenda[]): ItemAgenda[] {
  return [...items].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    const ha = a.hora ?? "99:99";
    const hb = b.hora ?? "99:99";
    if (ha !== hb) return ha.localeCompare(hb);
    return a.titulo.localeCompare(b.titulo, "es");
  });
}

/** Agrupa los ítems por fecha (clave 'YYYY-MM-DD'), ya ordenados. */
export function agruparPorFecha(items: ItemAgenda[]): Map<string, ItemAgenda[]> {
  const mapa = new Map<string, ItemAgenda[]>();
  for (const item of ordenarItemsAgenda(items)) {
    const lista = mapa.get(item.fecha) ?? [];
    lista.push(item);
    mapa.set(item.fecha, lista);
  }
  return mapa;
}

// ---------------------------------------------------------------------------
// 5) CALENDARIO MENSUAL (grilla de 42 celdas, semana empezando lunes)
// ---------------------------------------------------------------------------

export interface CeldaCalendario {
  fecha: string; // 'YYYY-MM-DD'
  dia: number;
  esDelMes: boolean;
  esHoy: boolean;
}

export function fechaLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function mesActual(): string {
  return fechaLocalISO(new Date()).slice(0, 7);
}

export function etiquetaMes(mes: string): string {
  const texto = new Date(`${mes}-15T12:00:00`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function mesMovido(mes: string, delta: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const d = new Date(anio, m - 1 + delta, 1);
  return fechaLocalISO(d).slice(0, 7);
}

/**
 * Devuelve las 42 celdas (6 semanas × 7 días) del calendario del mes,
 * empezando en lunes, completando con días del mes anterior/siguiente.
 */
export function celdasDelMes(mes: string, hoy: string = fechaLocalISO(new Date())): CeldaCalendario[] {
  const [anio, m] = mes.split("-").map(Number);
  const primero = new Date(anio, m - 1, 1);
  // getDay(): 0=domingo … 6=sábado → queremos lunes=0
  const desfasaje = (primero.getDay() + 6) % 7;
  const inicio = new Date(anio, m - 1, 1 - desfasaje);

  const celdas: CeldaCalendario[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    const fecha = fechaLocalISO(d);
    celdas.push({
      fecha,
      dia: d.getDate(),
      esDelMes: d.getMonth() === m - 1,
      esHoy: fecha === hoy,
    });
  }
  return celdas;
}

// ---------------------------------------------------------------------------
// 6) FORMATOS PARA MOSTRAR
// ---------------------------------------------------------------------------

/** "jueves 12 de noviembre" — para agrupar la lista cronológica. */
export function fechaLargaEvento(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** true si la fecha es anterior a hoy (evento ya pasado). */
export function esPasado(fecha: string, hoy: string = fechaLocalISO(new Date())): boolean {
  return fecha < hoy;
}
