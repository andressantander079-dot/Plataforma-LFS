"use server";

import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { agruparEnMeses, promedioTexto } from "@/lib/core/rules/estadisticasRules";

/**
 * ESTADÍSTICAS GLOBALES DE LA LIGA (Paso 17B) — solo admin.
 *
 * · KPIs reales: jugadores, clubes, partidos, goles, tarjetas, planillas,
 *   pases y recaudación.
 * · Filtro por TORNEO y/o TEMPORADA (afecta partidos, goles, tarjetas,
 *   planillas, evolución y rankings; los conteos de jugadores/clubes/pases
 *   y la recaudación son contexto global de la liga).
 * · Rankings: goleadores y disciplina por jugador + clubes goleadores,
 *   fair play y fichas por equipo.
 * · Evolución de los últimos 6 meses (partidos y goles) para los gráficos.
 */

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface TorneoFiltro {
  id: string;
  nombre: string;
  categoria: string | null;
  temporada: string;
}

export interface FiltrosEstadisticas {
  torneos: TorneoFiltro[];
  temporadas: string[];
}

export interface FiltroEstadisticas {
  competitionId: string | null;
  temporada: string | null;
}

export interface KpisGlobales {
  jugadores: number;
  clubes: number;
  partidosJugados: number;
  goles: number;
  amarillas: number;
  rojas: number;
  planillasAprobadas: number;
  pasesCompletados: number;
  recaudacion: number;
}

export interface PuntoEvolucion {
  mes: string;
  etiqueta: string;
  partidos: number;
  goles: number;
}

export interface RankingJugador {
  jugadorId: string;
  nombre: string;
  equipo: string;
  valor: number;
  detalle: string;
}

export interface RankingClub {
  teamId: string;
  equipo: string;
  club: string;
  valor: number;
  detalle: string;
}

export interface EstadisticasGlobales {
  kpis: KpisGlobales;
  evolucion: PuntoEvolucion[];
  goleadores: RankingJugador[];
  disciplinaJugadores: RankingJugador[];
  clubesGoleadores: RankingClub[];
  clubesFairPlay: RankingClub[];
  clubesFichas: RankingClub[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requerirAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Solo la federación puede hacer esto.");
  return { supabase, user };
}

interface FilaMatch {
  id: string;
  competition_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result_confirmed: boolean;
  scheduled_at: string | null;
  competitions: unknown;
}

interface CompEmbed {
  name: string;
  season: string;
  categories: { name: string } | null;
}

function compDe(m: FilaMatch): CompEmbed | null {
  const c = m.competitions as CompEmbed | CompEmbed[] | null;
  if (!c) return null;
  return Array.isArray(c) ? (c[0] ?? null) : c;
}

const esJugado = (m: FilaMatch) =>
  m.result_confirmed || m.status === "jugado" || m.status === "wo";

// ---------------------------------------------------------------------------
// Filtros disponibles (torneos + temporadas)
// ---------------------------------------------------------------------------

export async function obtenerFiltrosEstadisticas(): Promise<FiltrosEstadisticas> {
  const { supabase } = await requerirAdmin();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, name, season, categories(name)")
    .order("season", { ascending: false })
    .order("name");
  if (error) throw new Error(`No se pudieron cargar los torneos: ${error.message}`);

  const torneos: TorneoFiltro[] = (data ?? []).map((c) => {
    const cat = c.categories as unknown as { name: string } | { name: string }[] | null;
    const categoria = Array.isArray(cat) ? (cat[0]?.name ?? null) : (cat?.name ?? null);
    return { id: c.id, nombre: c.name, categoria, temporada: c.season };
  });
  const temporadas = Array.from(new Set(torneos.map((t) => t.temporada))).sort().reverse();
  return { torneos, temporadas };
}

// ---------------------------------------------------------------------------
// Estadísticas globales (con filtro opcional torneo/temporada)
// ---------------------------------------------------------------------------

export async function obtenerEstadisticasGlobales(
  filtro: FiltroEstadisticas
): Promise<EstadisticasGlobales> {
  const { supabase } = await requerirAdmin();

  // --- Partidos (base de casi todo lo demás)
  const { data: matchRows, error: errMatches } = await supabase
    .from("matches")
    .select(
      "id, competition_id, home_team_id, away_team_id, home_score, away_score, status, result_confirmed, scheduled_at, competitions(name, season, categories(name))"
    )
    .limit(5000);
  if (errMatches) {
    throw new Error(`No se pudieron cargar los partidos: ${errMatches.message}`);
  }

  const matches = ((matchRows ?? []) as FilaMatch[]).filter((m) => {
    if (filtro.competitionId && m.competition_id !== filtro.competitionId) return false;
    if (filtro.temporada && compDe(m)?.season !== filtro.temporada) return false;
    return true;
  });
  const matchIds = matches.map((m) => m.id);
  const jugados = matches.filter(esJugado);
  const fechaPartido = new Map(
    matches.map((m) => [m.id, (m.scheduled_at ?? "").slice(0, 10)] as const)
  );

  // --- Eventos de esos partidos (goles y tarjetas)
  let eventos: Array<{ tipo: string; team_id: string; player_id: string; match_id: string }> = [];
  if (matchIds.length > 0) {
    const { data: ev } = await supabase
      .from("match_events")
      .select("tipo, team_id, player_id, match_id")
      .in("match_id", matchIds)
      .limit(10000);
    eventos = (ev ?? []) as typeof eventos;
  }
  const golesEventos = eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol_en_contra");
  const amarillasEventos = eventos.filter((e) => e.tipo === "amarilla");
  const rojasEventos = eventos.filter((e) => e.tipo === "roja");

  // Goles: prioriza el MARCADOR confirmado (cubre W.O. sin eventos cargados);
  // si no hay marcadores todavía, cae al conteo de eventos.
  const golesMarcador = jugados.reduce(
    (acc, m) => acc + (m.home_score ?? 0) + (m.away_score ?? 0),
    0
  );
  const golesTotales = golesMarcador > 0 ? golesMarcador : golesEventos.length;

  // --- Planillas aprobadas de esos partidos
  let planillasAprobadas = 0;
  if (matchIds.length > 0) {
    const { data: sheets } = await supabase
      .from("match_sheets")
      .select("match_id, status")
      .in("match_id", matchIds)
      .eq("status", "aprobada");
    planillasAprobadas = (sheets ?? []).length;
  }

  // --- Contexto global de la liga (no se filtran por torneo)
  const [
    { count: jugadores },
    { count: clubes },
    { count: pasesCompletados },
    { data: pagos },
  ] = await Promise.all([
    supabase.from("players").select("id", { count: "exact", head: true }).eq("status", "activo"),
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("status", "habilitado"),
    supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("status", "7_COMPLETED"),
    supabase.from("treasury_payments").select("monto").eq("status", "aprobado"),
  ]);
  const recaudacion = (pagos ?? []).reduce(
    (acc, p) => acc + Number((p as { monto: number }).monto ?? 0),
    0
  );

  // --- Mapas de nombres (equipos, clubes, jugadores)
  const teamIds = new Set<string>();
  for (const m of matches) {
    teamIds.add(m.home_team_id);
    teamIds.add(m.away_team_id);
  }
  for (const e of eventos) teamIds.add(e.team_id);
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name, club_id")
    .in("id", teamIds.size > 0 ? Array.from(teamIds) : ["sin-equipos"]);
  const equipos = (teamRows ?? []) as Array<{ id: string; name: string; club_id: string }>;
  const nombreEquipo = new Map(equipos.map((t) => [t.id, t.name]));

  const clubIds = Array.from(new Set(equipos.map((t) => t.club_id)));
  const { data: clubRows } = await supabase
    .from("clubs")
    .select("id, name")
    .in("id", clubIds.length > 0 ? clubIds : ["sin-clubes"]);
  const nombreClub = new Map(
    ((clubRows ?? []) as Array<{ id: string; name: string }>).map((c) => [c.id, c.name])
  );
  const clubDeEquipo = new Map(equipos.map((t) => [t.id, nombreClub.get(t.club_id) ?? "—"]));

  const playerIds = Array.from(new Set(eventos.map((e) => e.player_id)));
  const { data: playerRows } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .in("id", playerIds.length > 0 ? playerIds : ["sin-jugadores"]);
  const nombreJugador = new Map(
    ((playerRows ?? []) as Array<{ id: string; first_name: string; last_name: string }>).map(
      (p) => [p.id, `${p.first_name} ${p.last_name}`.trim()]
    )
  );

  // --- KPIs
  const kpis: KpisGlobales = {
    jugadores: jugadores ?? 0,
    clubes: clubes ?? 0,
    partidosJugados: jugados.length,
    goles: golesTotales,
    amarillas: amarillasEventos.length,
    rojas: rojasEventos.length,
    planillasAprobadas,
    pasesCompletados: pasesCompletados ?? 0,
    recaudacion,
  };

  // --- Evolución 6 meses (partidos jugados y goles por mes)
  const fechasPartidos = jugados
    .map((m) => (m.scheduled_at ?? "").slice(0, 10))
    .filter((f) => f.length === 10);
  const fechasGoles = golesEventos
    .map((e) => fechaPartido.get(e.match_id) ?? "")
    .filter((f) => f.length === 10);
  const bucketPartidos = agruparEnMeses(fechasPartidos, 6);
  const bucketGoles = agruparEnMeses(fechasGoles, 6);
  const evolucion: PuntoEvolucion[] = bucketPartidos.map((p, i) => ({
    mes: p.mes,
    etiqueta: p.etiqueta,
    partidos: p.cantidad,
    goles: bucketGoles[i]?.cantidad ?? 0,
  }));

  // --- Ranking goleadores (jugadores): solo goles a favor
  const golesPorJugador = new Map<string, { cantidad: number; teamId: string }>();
  for (const e of eventos) {
    if (e.tipo !== "gol") continue;
    const prev = golesPorJugador.get(e.player_id) ?? { cantidad: 0, teamId: e.team_id };
    golesPorJugador.set(e.player_id, { cantidad: prev.cantidad + 1, teamId: e.team_id });
  }
  const goleadores: RankingJugador[] = Array.from(golesPorJugador.entries())
    .map(([jugadorId, v]) => ({
      jugadorId,
      nombre: nombreJugador.get(jugadorId) ?? "Jugador",
      equipo: nombreEquipo.get(v.teamId) ?? "—",
      valor: v.cantidad,
      detalle: `${v.cantidad} ${v.cantidad === 1 ? "gol" : "goles"}`,
    }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 10);

  // --- Ranking disciplina (jugadores): tarjetas (roja pesa doble)
  const tarjetasPorJugador = new Map<
    string,
    { amarillas: number; rojas: number; teamId: string }
  >();
  for (const e of eventos) {
    if (e.tipo !== "amarilla" && e.tipo !== "roja") continue;
    const prev = tarjetasPorJugador.get(e.player_id) ?? {
      amarillas: 0,
      rojas: 0,
      teamId: e.team_id,
    };
    if (e.tipo === "amarilla") prev.amarillas += 1;
    else prev.rojas += 1;
    tarjetasPorJugador.set(e.player_id, prev);
  }
  const disciplinaJugadores: RankingJugador[] = Array.from(tarjetasPorJugador.entries())
    .map(([jugadorId, v]) => ({
      jugadorId,
      nombre: nombreJugador.get(jugadorId) ?? "Jugador",
      equipo: nombreEquipo.get(v.teamId) ?? "—",
      valor: v.amarillas + v.rojas * 2,
      detalle: `${v.amarillas} amarilla${v.amarillas === 1 ? "" : "s"} · ${v.rojas} roja${v.rojas === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.valor - a.valor || a.nombre.localeCompare(b.nombre, "es"))
    .slice(0, 10);

  // --- Rankings por equipo (clubes)
  const gfPorEquipo = new Map<string, number>();
  const pjPorEquipo = new Map<string, number>();
  for (const m of jugados) {
    pjPorEquipo.set(m.home_team_id, (pjPorEquipo.get(m.home_team_id) ?? 0) + 1);
    pjPorEquipo.set(m.away_team_id, (pjPorEquipo.get(m.away_team_id) ?? 0) + 1);
    gfPorEquipo.set(m.home_team_id, (gfPorEquipo.get(m.home_team_id) ?? 0) + (m.home_score ?? 0));
    gfPorEquipo.set(m.away_team_id, (gfPorEquipo.get(m.away_team_id) ?? 0) + (m.away_score ?? 0));
  }
  const tarjetasPorEquipo = new Map<string, { amarillas: number; rojas: number }>();
  for (const e of eventos) {
    if (e.tipo !== "amarilla" && e.tipo !== "roja") continue;
    const prev = tarjetasPorEquipo.get(e.team_id) ?? { amarillas: 0, rojas: 0 };
    if (e.tipo === "amarilla") prev.amarillas += 1;
    else prev.rojas += 1;
    tarjetasPorEquipo.set(e.team_id, prev);
  }

  const infoEquipo = (teamId: string) => ({
    equipo: nombreEquipo.get(teamId) ?? "—",
    club: clubDeEquipo.get(teamId) ?? "—",
  });

  const clubesGoleadores: RankingClub[] = Array.from(gfPorEquipo.entries())
    .map(([teamId, gf]) => ({
      teamId,
      ...infoEquipo(teamId),
      valor: gf,
      detalle: `${promedioTexto(gf, pjPorEquipo.get(teamId) ?? 0)} por partido`,
    }))
    .sort((a, b) => b.valor - a.valor || a.equipo.localeCompare(b.equipo, "es"))
    .slice(0, 10);

  // Fair play: puntos de disciplina por partido (amarilla 1, roja 2), MENOR es mejor.
  // Mínimo 3 partidos jugados para que el promedio sea representativo.
  const clubesFairPlay: RankingClub[] = Array.from(tarjetasPorEquipo.entries())
    .map(([teamId, t]) => {
      const pj = pjPorEquipo.get(teamId) ?? 0;
      const puntos = t.amarillas + t.rojas * 2;
      return { teamId, pj, puntos, amarillas: t.amarillas, rojas: t.rojas };
    })
    .filter((v) => v.pj >= 3)
    .sort((a, b) => a.puntos / a.pj - b.puntos / b.pj)
    .slice(0, 10)
    .map((v) => ({
      teamId: v.teamId,
      ...infoEquipo(v.teamId),
      valor: v.puntos,
      detalle: `${promedioTexto(v.puntos, v.pj)} pts/partido (${v.amarillas} am · ${v.rojas} ro)`,
    }));

  // Fichas: total de tarjetas (amarillas + rojas), de mayor a menor.
  const clubesFichas: RankingClub[] = Array.from(tarjetasPorEquipo.entries())
    .map(([teamId, t]) => ({
      teamId,
      ...infoEquipo(teamId),
      valor: t.amarillas + t.rojas,
      detalle: `${t.amarillas} amarilla${t.amarillas === 1 ? "" : "s"} · ${t.rojas} roja${t.rojas === 1 ? "" : "s"}`,
    }))
    .sort((a, b) => b.valor - a.valor || a.equipo.localeCompare(b.equipo, "es"))
    .slice(0, 10);

  return {
    kpis,
    evolucion,
    goleadores,
    disciplinaJugadores,
    clubesGoleadores,
    clubesFairPlay,
    clubesFichas,
  };
}
