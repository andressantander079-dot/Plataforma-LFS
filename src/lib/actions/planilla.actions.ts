"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { anularMultaDeEvento, crearMultaAutomatica } from "@/lib/actions/tesoreria.actions";

/**
 * PLANILLA DIGITAL LFS — Paso 7A
 * Convocatoria del club ("Gestionar Plantel") con la regla de categorías
 * (los más chicos pueden jugar en categorías más grandes, nunca al revés),
 * edición por el árbitro, aprobación de la federación y eventos del
 * partido (goles, tarjetas y cambios) por jugador.
 *
 * Paso 7B: disciplina automática. Las rojas y la acumulación de amarillas
 * (regla del torneo) generan suspensiones que bloquean la convocatoria
 * del jugador hasta cumplir las fechas.
 */

// ---------- Tipos compartidos ----------

export interface Convocable {
  playerId: string;
  nombre: string;
  dni: string;
  categoria: string; // categoría en la que está registrado dentro del club
  suspendido: string | null; // motivo legible si tiene suspensión activa
}

export interface Convocado {
  id: string; // id de match_sheet_players
  playerId: string;
  nombre: string;
  dni: string;
  teamId: string;
  esTitular: boolean;
  agregadoPor: "club" | "arbitro" | "admin";
}

export interface EventoPlanilla {
  id: string;
  teamId: string;
  playerId: string;
  jugadorNombre: string;
  relacionadoId: string | null;
  relacionadoNombre: string | null;
  tipo: "gol" | "gol_en_contra" | "amarilla" | "roja" | "cambio";
  minuto: number | null;
}

export interface PlanillaCompleta {
  matchId: string;
  competitionId: string;
  torneo: string;
  categoria: string;
  temporada: string;
  matchday: number | null;
  scheduledAt: string | null;
  cancha: string | null;
  arbitro: string | null;
  statusPartido: string;
  homeTeamId: string;
  awayTeamId: string;
  local: string;
  visitante: string;
  homeScore: number | null;
  awayScore: number | null;
  sheet: {
    id: string;
    status: "borrador" | "confirmada" | "aprobada";
    confirmadaLocal: string | null;
    confirmadaVisitante: string | null;
    approvedAt: string | null;
  } | null;
  convocados: Convocado[];
  eventos: EventoPlanilla[];
  // permisos del que mira
  esAdmin: boolean;
  esArbitroPartido: boolean;
  miClubId: string | null;
  clubLocalId: string;
  clubVisitanteId: string;
}

// ---------- Helpers internos ----------

type Supabase = Awaited<ReturnType<typeof createLfsServerClient>>;

async function obtenerContexto() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    role: (profile?.role ?? "club") as string,
    clubId: (profile?.club_id ?? null) as string | null,
  };
}

/** Datos del partido con equipos, clubes y árbitro. */
async function obtenerPartido(supabase: Supabase, matchId: string) {
  const { data: match, error } = await supabase
    .from("matches")
    .select(
      "id, competition_id, matchday, scheduled_at, venue_id, referee_id, status, home_team_id, away_team_id, home_score, away_score"
    )
    .eq("id", matchId)
    .single();
  if (error || !match) throw new Error("No se encontró el partido.");

  const teamIds = [match.home_team_id, match.away_team_id];
  const [{ data: equipos }, { data: torneo }, { data: cancha }, { data: arbitro }] =
    await Promise.all([
      supabase.from("teams").select("id, club_id, category_id, name").in("id", teamIds),
      supabase
        .from("competitions")
        .select("id, name, season, category_id")
        .eq("id", match.competition_id)
        .single(),
      match.venue_id
        ? supabase.from("venues").select("name").eq("id", match.venue_id).single()
        : Promise.resolve({ data: null }),
      match.referee_id
        ? supabase.from("profiles").select("full_name").eq("id", match.referee_id).single()
        : Promise.resolve({ data: null }),
    ]);

  const local = (equipos ?? []).find((e) => e.id === match.home_team_id);
  const visitante = (equipos ?? []).find((e) => e.id === match.away_team_id);
  if (!local || !visitante) throw new Error("El partido no tiene equipos válidos.");

  const { data: categoria } = torneo?.category_id
    ? await supabase.from("categories").select("name").eq("id", torneo.category_id).single()
    : { data: null };

  return { match, local, visitante, torneo, cancha, arbitro, categoria };
}

function revalidarPlanillas(matchId: string) {
  revalidatePath("/club/partidos");
  revalidatePath(`/club/partidos/${matchId}`);
  revalidatePath(`/arbitro/planillas/${matchId}`);
  revalidatePath(`/admin/planillas/${matchId}`);
  revalidatePath("/arbitro/designaciones");
  revalidatePath("/estadisticas");
}

/** Motivo de suspensión en texto legible. */
function textoMotivoSuspension(motivo: string, pendientes: number): string {
  const base =
    motivo === "roja" ? "Tarjeta roja" : "Acumulación de amarillas";
  return `${base} · le queda${pendientes > 1 ? "n" : ""} ${pendientes} fecha${pendientes > 1 ? "s" : ""}`;
}

/**
 * Devuelve el motivo si el jugador tiene una suspensión activa en el
 * torneo (le quedan fechas por cumplir), o null si puede jugar.
 */
async function motivoSuspensionActiva(
  supabase: Supabase,
  competitionId: string,
  playerId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("player_suspensions")
    .select("motivo, partidos_pendientes")
    .eq("competition_id", competitionId)
    .eq("player_id", playerId)
    .gt("partidos_pendientes", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return textoMotivoSuspension(data.motivo, data.partidos_pendientes);
}

/**
 * Regla de categorías LFS:
 * un jugador puede ser convocado para un equipo si está registrado en el
 * MISMO club en una categoría de jerarquía MENOR O IGUAL a la del equipo
 * (los más chicos pueden subir, los más grandes NUNCA pueden bajar).
 * level_hierarchy: 1 = la más chica … 4 = Primera.
 */
async function cumpleReglaCategorias(
  supabase: Supabase,
  teamId: string,
  playerId: string
): Promise<{ ok: boolean; error?: string }> {
  const { data: team } = await supabase
    .from("teams")
    .select("club_id, category_id, name")
    .eq("id", teamId)
    .single();
  if (!team) return { ok: false, error: "Equipo no encontrado." };

  const { data: catEquipo } = await supabase
    .from("categories")
    .select("name, level_hierarchy")
    .eq("id", team.category_id)
    .single();
  if (!catEquipo) return { ok: false, error: "Categoría del equipo no encontrada." };

  const { data: registros } = await supabase
    .from("player_categories")
    .select("categories!inner(name, level_hierarchy)")
    .eq("club_id", team.club_id)
    .eq("player_id", playerId);

  const niveles = (registros ?? []).map(
    (r) => (r.categories as unknown as { level_hierarchy: number }).level_hierarchy
  );
  if (niveles.length === 0) {
    return { ok: false, error: "Ese jugador no está registrado en este club." };
  }

  const puedeSubir = niveles.some((n) => n <= catEquipo.level_hierarchy);
  if (!puedeSubir) {
    return {
      ok: false,
      error: `No se puede convocar: un jugador de categoría más grande no puede jugar en ${catEquipo.name} (solo los más chicos pueden subir).`,
    };
  }
  return { ok: true };
}

// ============================================================================
// LECTURAS
// ============================================================================

/** Planilla completa del partido (vista, edición y aprobación). */
export async function obtenerPlanilla(matchId: string): Promise<PlanillaCompleta> {
  const { supabase, user, role, clubId } = await obtenerContexto();
  const { match, local, visitante, torneo, cancha, arbitro, categoria } =
    await obtenerPartido(supabase, matchId);

  const esAdmin = role === "admin";
  const esArbitroPartido = match.referee_id === user.id;
  const esClubInvolucrado =
    clubId !== null && (local.club_id === clubId || visitante.club_id === clubId);
  if (!esAdmin && !esArbitroPartido && !esClubInvolucrado) {
    throw new Error("No tenés permiso para ver esta planilla.");
  }

  const { data: sheet } = await supabase
    .from("match_sheets")
    .select("id, status, confirmada_local, confirmada_visitante, approved_at")
    .eq("match_id", matchId)
    .maybeSingle();

  let convocados: Convocado[] = [];
  let eventos: EventoPlanilla[] = [];

  if (sheet) {
    const [{ data: filas }, { data: evs }] = await Promise.all([
      supabase
        .from("match_sheet_players")
        .select("id, team_id, player_id, es_titular, agregado_por, players(first_name, last_name, dni)")
        .eq("sheet_id", sheet.id)
        .order("created_at"),
      supabase
        .from("match_events")
        .select(
          "id, team_id, player_id, jugador_relacionado_id, tipo, minuto, players!match_events_player_id_fkey(first_name, last_name)"
        )
        .eq("match_id", matchId)
        .order("minuto", { nullsFirst: false })
        .order("created_at"),
    ]);

    convocados = (filas ?? []).map((f) => {
      const p = f.players as unknown as { first_name: string; last_name: string; dni: string };
      return {
        id: f.id,
        playerId: f.player_id,
        nombre: `${p?.last_name ?? ""}, ${p?.first_name ?? ""}`.trim(),
        dni: p?.dni ?? "",
        teamId: f.team_id,
        esTitular: f.es_titular,
        agregadoPor: f.agregado_por as Convocado["agregadoPor"],
      };
    });

    // nombres de los jugadores relacionados (cambios)
    const relacionadoIds = [...new Set((evs ?? []).map((e) => e.jugador_relacionado_id).filter(Boolean))] as string[];
    const nombresRel = new Map<string, string>();
    if (relacionadoIds.length > 0) {
      const { data: rels } = await supabase
        .from("players")
        .select("id, first_name, last_name")
        .in("id", relacionadoIds);
      (rels ?? []).forEach((r) => nombresRel.set(r.id, `${r.last_name}, ${r.first_name}`));
    }

    eventos = (evs ?? []).map((e) => {
      const p = e.players as unknown as { first_name: string; last_name: string } | null;
      return {
        id: e.id,
        teamId: e.team_id,
        playerId: e.player_id,
        jugadorNombre: p ? `${p.last_name}, ${p.first_name}` : "Jugador",
        relacionadoId: e.jugador_relacionado_id,
        relacionadoNombre: e.jugador_relacionado_id
          ? (nombresRel.get(e.jugador_relacionado_id) ?? null)
          : null,
        tipo: e.tipo as EventoPlanilla["tipo"],
        minuto: e.minuto,
      };
    });
  }

  return {
    matchId: match.id,
    competitionId: match.competition_id,
    torneo: torneo?.name ?? "Torneo",
    categoria: categoria?.name ?? "",
    temporada: torneo?.season ?? "",
    matchday: match.matchday,
    scheduledAt: match.scheduled_at,
    cancha: cancha?.name ?? null,
    arbitro: arbitro?.full_name ?? null,
    statusPartido: match.status,
    homeTeamId: match.home_team_id,
    awayTeamId: match.away_team_id,
    local: local.name,
    visitante: visitante.name,
    homeScore: match.home_score,
    awayScore: match.away_score,
    sheet: sheet
      ? {
          id: sheet.id,
          status: sheet.status,
          confirmadaLocal: sheet.confirmada_local,
          confirmadaVisitante: sheet.confirmada_visitante,
          approvedAt: sheet.approved_at,
        }
      : null,
    convocados,
    eventos,
    esAdmin,
    esArbitroPartido,
    miClubId: clubId,
    clubLocalId: local.club_id,
    clubVisitanteId: visitante.club_id,
  };
}

/**
 * Jugadores convocables para un equipo: registrados en el mismo club en
 * categorías de jerarquía menor o igual (regla LFS), activos.
 */
export async function obtenerConvocables(
  matchId: string,
  teamId: string
): Promise<{ convocables?: Convocable[]; error?: string }> {
  const { supabase, user, role, clubId } = await obtenerContexto();

  const { data: team } = await supabase
    .from("teams")
    .select("club_id, category_id, name")
    .eq("id", teamId)
    .single();
  if (!team) return { error: "Equipo no encontrado." };

  const { data: match } = await supabase
    .from("matches")
    .select("referee_id, competition_id")
    .eq("id", matchId)
    .single();

  const esAdmin = role === "admin";
  const esArbitroPartido = match?.referee_id === user.id;
  const esMiEquipo = clubId !== null && team.club_id === clubId;
  if (!esAdmin && !esArbitroPartido && !esMiEquipo) {
    return { error: "No tenés permiso para ver los jugadores de este equipo." };
  }

  const { data: catEquipo } = await supabase
    .from("categories")
    .select("level_hierarchy")
    .eq("id", team.category_id)
    .single();
  if (!catEquipo) return { error: "Categoría del equipo no encontrada." };

  const { data: registros, error } = await supabase
    .from("player_categories")
    .select(
      "player_id, players!inner(id, first_name, last_name, dni, status), categories!inner(name, level_hierarchy)"
    )
    .eq("club_id", team.club_id)
    .eq("players.status", "activo")
    .lte("categories.level_hierarchy", catEquipo.level_hierarchy);

  if (error) return { error: "No se pudo cargar el plantel." };

  // Un jugador puede figurar en varias categorías: nos quedamos con la más alta permitida
  const porJugador = new Map<string, Convocable & { nivel: number }>();
  (registros ?? []).forEach((r) => {
    const p = r.players as unknown as {
      id: string;
      first_name: string;
      last_name: string;
      dni: string;
    };
    const c = r.categories as unknown as { name: string; level_hierarchy: number };
    const actual = porJugador.get(p.id);
    if (!actual || c.level_hierarchy > actual.nivel) {
      porJugador.set(p.id, {
        playerId: p.id,
        nombre: `${p.last_name}, ${p.first_name}`,
        dni: p.dni,
        categoria: c.name,
        nivel: c.level_hierarchy,
        suspendido: null,
      });
    }
  });

  // Disciplina automática (Paso 7B): marcar a los suspendidos del torneo
  const playerIds = [...porJugador.keys()];
  if (match?.competition_id && playerIds.length > 0) {
    const { data: suspensiones } = await supabase
      .from("player_suspensions")
      .select("player_id, motivo, partidos_pendientes")
      .eq("competition_id", match.competition_id)
      .in("player_id", playerIds)
      .gt("partidos_pendientes", 0);
    (suspensiones ?? []).forEach((s) => {
      const entrada = porJugador.get(s.player_id);
      if (entrada) {
        entrada.suspendido = textoMotivoSuspension(s.motivo, s.partidos_pendientes);
      }
    });
  }

  const convocables = [...porJugador.values()]
    .map(({ nivel: _nivel, ...resto }) => resto)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return { convocables };
}

/** Estado de planilla de varios partidos (para los botones del club). */
export async function obtenerEstadosPlanilla(
  matchIds: string[]
): Promise<Record<string, { status: string; miLadoConfirmado: boolean }>> {
  const { supabase, clubId } = await obtenerContexto();
  if (matchIds.length === 0) return {};

  const { data: sheets } = await supabase
    .from("match_sheets")
    .select("match_id, status, confirmada_local, confirmada_visitante")
    .in("match_id", matchIds);

  // saber de qué lado juega mi club en cada partido
  const { data: partidos } = await supabase
    .from("matches")
    .select("id, home_team_id, teams!matches_home_team_id_fkey(club_id)")
    .in("id", matchIds);

  const esLocalMio = new Map<string, boolean>();
  (partidos ?? []).forEach((p) => {
    const home = p.teams as unknown as { club_id: string } | null;
    esLocalMio.set(p.id, home?.club_id === clubId);
  });

  const resultado: Record<string, { status: string; miLadoConfirmado: boolean }> = {};
  (sheets ?? []).forEach((s) => {
    const soyLocal = esLocalMio.get(s.match_id) ?? true;
    resultado[s.match_id] = {
      status: s.status,
      miLadoConfirmado: soyLocal ? !!s.confirmada_local : !!s.confirmada_visitante,
    };
  });
  return resultado;
}

// ============================================================================
// CONVOCATORIA (CLUB)
// ============================================================================

async function obtenerOCrearPlanilla(
  supabase: Supabase,
  matchId: string
): Promise<{ id: string; status: string; confirmada_local: string | null; confirmada_visitante: string | null }> {
  const { data: existente } = await supabase
    .from("match_sheets")
    .select("id, status, confirmada_local, confirmada_visitante")
    .eq("match_id", matchId)
    .maybeSingle();
  if (existente) return existente;

  const { data: nueva, error } = await supabase
    .from("match_sheets")
    .insert({ match_id: matchId })
    .select("id, status, confirmada_local, confirmada_visitante")
    .single();
  if (error || !nueva) throw new Error("No se pudo crear la planilla del partido.");
  return nueva;
}

export async function convocarJugador(
  matchId: string,
  teamId: string,
  playerId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, role, clubId } = await obtenerContexto();

  const { data: team } = await supabase
    .from("teams")
    .select("club_id")
    .eq("id", teamId)
    .single();
  if (!team) return { error: "Equipo no encontrado." };

  const esAdmin = role === "admin";
  const esMiEquipo = clubId !== null && team.club_id === clubId;
  if (!esAdmin && !esMiEquipo) {
    return { error: "Solo podés convocar jugadores de tu propio club." };
  }

  // Regla de categorías (validación del lado del servidor)
  const regla = await cumpleReglaCategorias(supabase, teamId, playerId);
  if (!regla.ok) return { error: regla.error };

  // Disciplina automática: un suspendido no se puede convocar
  const { data: partido } = await supabase
    .from("matches")
    .select("competition_id")
    .eq("id", matchId)
    .single();
  if (partido?.competition_id) {
    const suspendido = await motivoSuspensionActiva(supabase, partido.competition_id, playerId);
    if (suspendido) return { error: `No se puede convocar: el jugador está suspendido (${suspendido}).` };
  }

  const sheet = await obtenerOCrearPlanilla(supabase, matchId);
  if (!esAdmin) {
    if (sheet.status !== "borrador") {
      return { error: "La convocatoria ya fue confirmada. Si hay una baja, la carga el árbitro." };
    }
    // si mi lado ya confirmó, no puedo seguir tocando
    const { match, local } = await datosLado(supabase, matchId, teamId);
    void match;
    const yaConfirme = local ? !!sheet.confirmada_local : !!sheet.confirmada_visitante;
    if (yaConfirme) {
      return { error: "Ya confirmaste tu convocatoria. Cualquier cambio lo hace el árbitro o la federación." };
    }
  }

  const { error } = await supabase.from("match_sheet_players").insert({
    sheet_id: sheet.id,
    team_id: teamId,
    player_id: playerId,
    es_titular: true,
    agregado_por: esAdmin ? "admin" : "club",
  });
  if (error) {
    if (error.code === "23505") return { error: "Ese jugador ya está convocado." };
    return { error: "No se pudo convocar al jugador." };
  }

  revalidarPlanillas(matchId);
  return { ok: true };
}

async function datosLado(supabase: Supabase, matchId: string, teamId: string) {
  const { data: match } = await supabase
    .from("matches")
    .select("home_team_id")
    .eq("id", matchId)
    .single();
  return { match, local: match?.home_team_id === teamId };
}

export async function quitarConvocado(
  convocadoId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role, clubId } = await obtenerContexto();

  const { data: fila } = await supabase
    .from("match_sheet_players")
    .select("id, sheet_id, team_id, teams(club_id)")
    .eq("id", convocadoId)
    .single();
  if (!fila) return { error: "Convocado no encontrado." };

  const { data: sheet } = await supabase
    .from("match_sheets")
    .select("match_id, status")
    .eq("id", fila.sheet_id)
    .single();
  if (!sheet) return { error: "Planilla no encontrada." };

  const clubDelEquipo = (fila.teams as unknown as { club_id: string }).club_id;
  const esAdmin = role === "admin";
  const esClubEnBorrador = sheet.status === "borrador" && clubId === clubDelEquipo;

  let esArbitroEnConfirmada = false;
  if (!esAdmin && !esClubEnBorrador && sheet.status === "confirmada") {
    const { data: m } = await supabase
      .from("matches")
      .select("referee_id")
      .eq("id", sheet.match_id)
      .single();
    esArbitroEnConfirmada = m?.referee_id === user.id;
  }

  if (!esAdmin && !esClubEnBorrador && !esArbitroEnConfirmada) {
    return { error: "No podés quitar jugadores en este estado de la planilla." };
  }

  const { error } = await supabase.from("match_sheet_players").delete().eq("id", convocadoId);
  if (error) return { error: "No se pudo quitar al jugador." };

  revalidarPlanillas(sheet.match_id);
  return { ok: true };
}

export async function alternarTitular(
  convocadoId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role, clubId } = await obtenerContexto();

  const { data: fila } = await supabase
    .from("match_sheet_players")
    .select("id, sheet_id, team_id, es_titular, teams(club_id)")
    .eq("id", convocadoId)
    .single();
  if (!fila) return { error: "Convocado no encontrado." };

  const { data: sheet } = await supabase
    .from("match_sheets")
    .select("match_id, status")
    .eq("id", fila.sheet_id)
    .single();
  if (!sheet) return { error: "Planilla no encontrada." };

  const clubDelEquipo = (fila.teams as unknown as { club_id: string }).club_id;
  const esAdmin = role === "admin";
  const esClubEnBorrador = sheet.status === "borrador" && clubId === clubDelEquipo;

  let esArbitroEnConfirmada = false;
  if (!esAdmin && !esClubEnBorrador && sheet.status === "confirmada") {
    const { data: m } = await supabase
      .from("matches")
      .select("referee_id")
      .eq("id", sheet.match_id)
      .single();
    esArbitroEnConfirmada = m?.referee_id === user.id;
  }
  if (!esAdmin && !esClubEnBorrador && !esArbitroEnConfirmada) {
    return { error: "No podés modificar la titularidad en este estado." };
  }

  const { error } = await supabase
    .from("match_sheet_players")
    .update({ es_titular: !fila.es_titular })
    .eq("id", convocadoId);
  if (error) return { error: "No se pudo cambiar la titularidad." };

  revalidarPlanillas(sheet.match_id);
  return { ok: true };
}

/** El club confirma SU lado de la convocatoria. Cuando ambos confirman → 'confirmada'. */
export async function confirmarMiConvocatoria(
  matchId: string,
  teamId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, role, clubId } = await obtenerContexto();

  const { data: team } = await supabase
    .from("teams")
    .select("club_id, name")
    .eq("id", teamId)
    .single();
  if (!team) return { error: "Equipo no encontrado." };

  const esAdmin = role === "admin";
  if (!esAdmin && team.club_id !== clubId) {
    return { error: "Solo podés confirmar la convocatoria de tu propio club." };
  }

  const sheet = await obtenerOCrearPlanilla(supabase, matchId);
  if (sheet.status !== "borrador") {
    return { error: "La planilla ya está confirmada." };
  }

  // al menos un jugador convocado de este equipo
  const { count } = await supabase
    .from("match_sheet_players")
    .select("id", { count: "exact", head: true })
    .eq("sheet_id", sheet.id)
    .eq("team_id", teamId);
  if (!count || count === 0) {
    return { error: "Convocá al menos un jugador antes de confirmar." };
  }

  const { local } = await datosLado(supabase, matchId, teamId);
  const ahora = new Date().toISOString();
  const update = local
    ? { confirmada_local: ahora }
    : { confirmada_visitante: ahora };

  const otraConfirmada = local ? sheet.confirmada_visitante : sheet.confirmada_local;
  const estadoFinal = otraConfirmada
    ? { ...update, status: "confirmada", confirmed_at: ahora }
    : update;

  const { error } = await supabase
    .from("match_sheets")
    .update(estadoFinal)
    .eq("id", sheet.id);
  if (error) return { error: "No se pudo confirmar la convocatoria." };

  revalidarPlanillas(matchId);
  return { ok: true };
}

// ============================================================================
// ÁRBITRO (bajas/altas en el partido, con la misma regla de categorías)
// ============================================================================

export async function arbitroAgregarJugador(
  matchId: string,
  teamId: string,
  playerId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role } = await obtenerContexto();

  const { data: match } = await supabase
    .from("matches")
    .select("referee_id, competition_id")
    .eq("id", matchId)
    .single();
  const esAdmin = role === "admin";
  if (!esAdmin && match?.referee_id !== user.id) {
    return { error: "Solo el árbitro designado puede modificar la planilla confirmada." };
  }

  const sheet = await obtenerOCrearPlanilla(supabase, matchId);
  if (!esAdmin && sheet.status !== "confirmada") {
    return { error: "La planilla todavía no está confirmada por ambos clubes." };
  }

  const regla = await cumpleReglaCategorias(supabase, teamId, playerId);
  if (!regla.ok) return { error: regla.error };

  // Disciplina automática: el árbitro tampoco puede agregar suspendidos
  if (match?.competition_id) {
    const suspendido = await motivoSuspensionActiva(supabase, match.competition_id, playerId);
    if (suspendido) return { error: `No se puede agregar: el jugador está suspendido (${suspendido}).` };
  }

  const { error } = await supabase.from("match_sheet_players").insert({
    sheet_id: sheet.id,
    team_id: teamId,
    player_id: playerId,
    es_titular: false,
    agregado_por: esAdmin ? "admin" : "arbitro",
  });
  if (error) {
    if (error.code === "23505") return { error: "Ese jugador ya está en la planilla." };
    return { error: "No se pudo agregar al jugador." };
  }

  revalidarPlanillas(matchId);
  return { ok: true };
}

// ============================================================================
// FEDERACIÓN (aprobación)
// ============================================================================

export async function aprobarPlanilla(
  matchId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role } = await obtenerContexto();
  if (role !== "admin") return { error: "Solo la federación puede aprobar planillas." };

  const sheet = await obtenerOCrearPlanilla(supabase, matchId);
  if (sheet.status === "aprobada") return { error: "La planilla ya está aprobada." };

  const { error } = await supabase
    .from("match_sheets")
    .update({
      status: "aprobada",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      confirmed_at: sheet.status === "borrador" ? new Date().toISOString() : undefined,
    })
    .eq("id", sheet.id);
  if (error) return { error: "No se pudo aprobar la planilla." };

  revalidarPlanillas(matchId);
  return { ok: true };
}

export async function reabrirPlanilla(
  matchId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, role } = await obtenerContexto();
  if (role !== "admin") return { error: "Solo la federación puede reabrir planillas." };

  const { error } = await supabase
    .from("match_sheets")
    .update({
      status: "borrador",
      confirmada_local: null,
      confirmada_visitante: null,
      confirmed_at: null,
      approved_by: null,
      approved_at: null,
    })
    .eq("match_id", matchId);
  if (error) return { error: "No se pudo reabrir la planilla." };

  revalidarPlanillas(matchId);
  return { ok: true };
}

// ============================================================================
// EVENTOS DEL PARTIDO (árbitro o federación)
// ============================================================================

export async function registrarEvento(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role } = await obtenerContexto();

  const matchId = formData.get("matchId") as string;
  const teamId = formData.get("teamId") as string;
  const playerId = formData.get("playerId") as string;
  const tipo = formData.get("tipo") as string;
  const minutoRaw = (formData.get("minuto") as string)?.trim();
  const relacionadoId = (formData.get("relacionadoId") as string) || null;

  const TIPOS = ["gol", "gol_en_contra", "amarilla", "roja", "cambio"];
  if (!matchId || !teamId || !playerId || !TIPOS.includes(tipo)) {
    return { error: "Datos del evento incompletos o inválidos." };
  }

  const { data: match } = await supabase
    .from("matches")
    .select("referee_id, home_team_id, away_team_id, competition_id")
    .eq("id", matchId)
    .single();
  const esAdmin = role === "admin";
  if (!esAdmin && match?.referee_id !== user.id) {
    return { error: "Solo el árbitro designado puede cargar eventos." };
  }
  if (teamId !== match?.home_team_id && teamId !== match?.away_team_id) {
    return { error: "Ese equipo no juega este partido." };
  }

  let minuto: number | null = null;
  if (minutoRaw !== "") {
    minuto = parseInt(minutoRaw, 10);
    if (isNaN(minuto) || minuto < 0 || minuto > 60) {
      return { error: "El minuto debe ser un número entre 0 y 60." };
    }
  }

  if (tipo === "cambio" && !relacionadoId) {
    return { error: "En un cambio tenés que indicar qué jugador sale." };
  }

  // los jugadores del evento deben estar en la planilla del partido
  const { data: sheet } = await supabase
    .from("match_sheets")
    .select("id")
    .eq("match_id", matchId)
    .maybeSingle();
  if (!sheet) return { error: "Todavía no hay planilla para este partido." };

  const jugadoresAValidar = relacionadoId ? [playerId, relacionadoId] : [playerId];
  const { data: enPlanilla } = await supabase
    .from("match_sheet_players")
    .select("player_id")
    .eq("sheet_id", sheet.id)
    .in("player_id", jugadoresAValidar);
  const presentes = new Set((enPlanilla ?? []).map((p) => p.player_id));
  for (const pid of jugadoresAValidar) {
    if (!presentes.has(pid)) {
      return { error: "El jugador debe estar convocado en la planilla del partido." };
    }
  }

  const { data: eventoInsertado, error } = await supabase
    .from("match_events")
    .insert({
      match_id: matchId,
      team_id: teamId,
      player_id: playerId,
      jugador_relacionado_id: tipo === "cambio" ? relacionadoId : null,
      tipo,
      minuto,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { error: "No se pudo registrar el evento." };

  // en un cambio, el que entra pasa a titular y el que sale deja de serlo
  if (tipo === "cambio" && relacionadoId) {
    await supabase
      .from("match_sheet_players")
      .update({ es_titular: true })
      .eq("sheet_id", sheet.id)
      .eq("player_id", playerId);
    await supabase
      .from("match_sheet_players")
      .update({ es_titular: false })
      .eq("sheet_id", sheet.id)
      .eq("player_id", relacionadoId);
  }

  // ---------------------------------------------------------------
  // DISCIPLINA AUTOMÁTICA (Paso 7B)
  // roja directa → 1 fecha; N amarillas en el torneo → 1 fecha
  // ---------------------------------------------------------------
  if (match?.competition_id && (tipo === "roja" || tipo === "amarilla")) {
    let generaSuspension = false;
    let motivo: "roja" | "acumulacion_amarillas" = "roja";

    if (tipo === "roja") {
      generaSuspension = true;
    } else {
      const { data: torneo } = await supabase
        .from("competitions")
        .select("yellow_cards_suspension")
        .eq("id", match.competition_id)
        .single();
      const limite = Math.max(1, torneo?.yellow_cards_suspension ?? 5);

      const { data: amarillas } = await supabase
        .from("match_events")
        .select("id, matches!inner(competition_id)")
        .eq("player_id", playerId)
        .eq("tipo", "amarilla")
        .eq("matches.competition_id", match.competition_id);
      const total = (amarillas ?? []).length;
      if (total > 0 && total % limite === 0) {
        generaSuspension = true;
        motivo = "acumulacion_amarillas";
      }
    }

    if (generaSuspension && eventoInsertado) {
      // si falla el alta de la suspensión no frenamos el evento:
      // el índice único por evento evita duplicados en reintentos
      await supabase.from("player_suspensions").insert({
        player_id: playerId,
        competition_id: match.competition_id,
        team_id: teamId,
        motivo,
        partidos_pendientes: 1,
        evento_origen_id: eventoInsertado.id,
      });

      // ---------------------------------------------------------------
      // MULTA ECONÓMICA AUTOMÁTICA (Paso 8A - Tesorería)
      // roja directa y acumulación de amarillas multan al CLUB.
      // El monto sale del panel de configuración de tesorería.
      // ---------------------------------------------------------------
      const { data: equipoMultado } = await supabase
        .from("teams")
        .select("club_id, name")
        .eq("id", teamId)
        .single();

      if (equipoMultado?.club_id) {
        const { data: jugadorMultado } = await supabase
          .from("players")
          .select("first_name, last_name")
          .eq("id", playerId)
          .single();
        const nombreJugador = jugadorMultado
          ? `${jugadorMultado.last_name}, ${jugadorMultado.first_name}`
          : "Jugador";

        await crearMultaAutomatica({
          clubId: equipoMultado.club_id,
          competitionId: match.competition_id,
          tipo: motivo === "roja" ? "multa_roja" : "multa_acumulacion_amarillas",
          descripcion: `${equipoMultado.name} — ${motivo === "roja" ? "tarjeta roja" : "acumulación de amarillas"} de ${nombreJugador}`,
          eventoOrigenId: eventoInsertado.id,
        });
      }
    }
  }

  revalidarPlanillas(matchId);
  if (match?.competition_id) {
    revalidatePath(`/admin/competencias/${match.competition_id}`);
  }
  return { ok: true };
}

export async function eliminarEvento(
  eventoId: string
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, role } = await obtenerContexto();

  const { data: evento } = await supabase
    .from("match_events")
    .select("id, match_id")
    .eq("id", eventoId)
    .single();
  if (!evento) return { error: "Evento no encontrado." };

  const { data: match } = await supabase
    .from("matches")
    .select("referee_id")
    .eq("id", evento.match_id)
    .single();
  const esAdmin = role === "admin";
  if (!esAdmin && match?.referee_id !== user.id) {
    return { error: "Solo el árbitro designado puede borrar eventos." };
  }

  const { error } = await supabase.from("match_events").delete().eq("id", eventoId);
  if (error) return { error: "No se pudo borrar el evento." };

  // si el evento había generado una suspensión automática, se limpia también
  await supabase
    .from("player_suspensions")
    .delete()
    .eq("evento_origen_id", eventoId);

  // si el evento había generado una multa automática, se anula (queda registro)
  await anularMultaDeEvento(eventoId);

  revalidarPlanillas(evento.match_id);
  return { ok: true };
}
