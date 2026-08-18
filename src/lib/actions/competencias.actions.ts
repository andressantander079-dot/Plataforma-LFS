"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { generarCruces } from "@/lib/core/competencias/fixture";
import {
  asignarGrupos,
  crucesEntreGrupos,
  crucesSembrados,
  emparejarSiguienteRonda,
  etapaParaCantidad,
  primeraRondaEliminacion,
  siguienteEtapa,
  type Etapa,
} from "@/lib/core/competencias/playoff";
import { calcularTabla } from "@/lib/core/competencias/tabla";

/**
 * COMPETENCIAS LFS — Acciones de servidor (núcleo)
 * Torneos, canchas, equipos, fixture automático, programación,
 * designación de árbitros y resultados con confirmación.
 */

async function requireAdmin() {
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

function revalidarCompetencias(competitionId?: string) {
  revalidatePath("/admin/competencias");
  if (competitionId) revalidatePath(`/admin/competencias/${competitionId}`);
  revalidatePath("/fixture");
  revalidatePath("/posiciones");
  revalidatePath("/estadisticas");
  revalidatePath("/club/partidos");
  revalidatePath("/arbitro/designaciones");
}

/**
 * DISCIPLINA AUTOMÁTICA (Paso 7B)
 * Cuando un partido queda confirmado (resultado o W.O.), los jugadores
 * suspendidos de esos dos equipos descuentan UNA fecha de su sanción.
 * Solo se descuenta en la transición a confirmado (si el admin corrige
 * el marcador después, no vuelve a descontar).
 */
async function descontarSuspensionesDelPartido(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  partidoId: string
) {
  const { data: partido } = await supabase
    .from("matches")
    .select("competition_id, home_team_id, away_team_id")
    .eq("id", partidoId)
    .single();
  if (!partido) return;

  const { data: activas } = await supabase
    .from("player_suspensions")
    .select("id, partidos_pendientes")
    .eq("competition_id", partido.competition_id)
    .in("team_id", [partido.home_team_id, partido.away_team_id])
    .gt("partidos_pendientes", 0);

  for (const s of activas ?? []) {
    await supabase
      .from("player_suspensions")
      .update({ partidos_pendientes: s.partidos_pendientes - 1 })
      .eq("id", s.id);
  }
}

// ============================================================================
// CANCHAS
// ============================================================================

export async function crearCancha(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const address = (formData.get("address") as string)?.trim() || null;

  if (!name) return { error: "El nombre de la cancha es obligatorio." };

  const { error } = await supabase.from("venues").insert({ name, address });
  if (error) return { error: "No se pudo crear la cancha." };

  revalidatePath("/admin/competencias/canchas");
  return { ok: true };
}

export async function eliminarCancha(canchaId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("venues").delete().eq("id", canchaId);
  if (error) return { error: "No se pudo eliminar (puede estar en uso por algún partido)." };

  revalidatePath("/admin/competencias/canchas");
  return { ok: true };
}

// ============================================================================
// TORNEOS
// ============================================================================

const FORMATOS = ["liga", "eliminacion", "grupos_playoffs", "liga_playoffs"] as const;

export async function crearTorneo(formData: FormData) {
  const { supabase } = await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const season = (formData.get("season") as string)?.trim() || new Date().getFullYear().toString();
  const category_id = formData.get("category_id") as string;
  const format = (formData.get("format") as string) || "liga";
  const rounds = Number(formData.get("rounds") || 1);
  const points_win = Number(formData.get("points_win") ?? 3);
  const points_draw = Number(formData.get("points_draw") ?? 1);
  const points_loss = Number(formData.get("points_loss") ?? 0);
  const tiebreaker = (formData.get("tiebreaker") as string) || "diferencia_gol";
  const wo_home_goals = Number(formData.get("wo_home_goals") ?? 5);
  const wo_away_goals = Number(formData.get("wo_away_goals") ?? 0);
  const yellow_cards_suspension = Number(formData.get("yellow_cards_suspension") ?? 5);
  const playoff_qualifiers = Number(formData.get("playoff_qualifiers") ?? 4);
  const groups_count = Number(formData.get("groups_count") ?? 2);

  if (!name) return { error: "El nombre del torneo es obligatorio." };
  if (!category_id) return { error: "Elegí una categoría." };
  if (!FORMATOS.includes(format as (typeof FORMATOS)[number])) {
    return { error: "Formato inválido." };
  }
  if (![1, 2].includes(rounds)) return { error: "Las vueltas deben ser 1 (ida) o 2 (ida y vuelta)." };
  if (tiebreaker !== "diferencia_gol" && tiebreaker !== "enfrentamiento_directo") {
    return { error: "Criterio de desempate inválido." };
  }
  if (![2, 4, 8].includes(playoff_qualifiers)) {
    return { error: "Los clasificados al playoff deben ser 2, 4 u 8." };
  }
  if (![2, 4].includes(groups_count)) {
    return { error: "La cantidad de grupos debe ser 2 o 4." };
  }

  const { data: torneo, error } = await supabase
    .from("competitions")
    .insert({
      name,
      season,
      category_id,
      format,
      rounds,
      points_win,
      points_draw,
      points_loss,
      tiebreaker,
      wo_home_goals,
      wo_away_goals,
      yellow_cards_suspension,
      playoff_qualifiers,
      groups_count,
    })
    .select("id")
    .single();

  if (error || !torneo) return { error: "No se pudo crear el torneo." };

  // Inscripción automática: un equipo por cada club HABILITADO en esa categoría
  const { data: clubes } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("status", "habilitado")
    .order("name");

  for (const club of clubes ?? []) {
    const { data: equipo } = await supabase
      .from("teams")
      .upsert(
        { club_id: club.id, category_id, name: club.name },
        { onConflict: "club_id,category_id,name", ignoreDuplicates: true }
      )
      .select("id")
      .single();

    let teamId = equipo?.id;
    if (!teamId) {
      const { data: existente } = await supabase
        .from("teams")
        .select("id")
        .eq("club_id", club.id)
        .eq("category_id", category_id)
        .eq("name", club.name)
        .single();
      teamId = existente?.id;
    }

    if (teamId) {
      await supabase
        .from("competition_teams")
        .upsert(
          { competition_id: torneo.id, team_id: teamId },
          { onConflict: "competition_id,team_id", ignoreDuplicates: true }
        );
    }
  }

  revalidarCompetencias(torneo.id);
  return { id: torneo.id };
}

export async function cambiarEstadoTorneo(competitionId: string, estado: string) {
  const { supabase } = await requireAdmin();

  if (!["borrador", "en_curso", "finalizado"].includes(estado)) {
    return { error: "Estado inválido." };
  }

  const { error } = await supabase
    .from("competitions")
    .update({ status: estado })
    .eq("id", competitionId);

  if (error) return { error: "No se pudo cambiar el estado." };

  revalidarCompetencias(competitionId);
  return { ok: true };
}

export async function eliminarTorneo(competitionId: string) {
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("competitions").delete().eq("id", competitionId);
  if (error) return { error: "No se pudo eliminar el torneo." };

  revalidarCompetencias();
  return { ok: true };
}

// ============================================================================
// EQUIPOS (varios por club en la misma categoría)
// ============================================================================

const SUFIJOS = ["B", "C", "D", "E"];

export async function agregarEquipo(competitionId: string, clubId: string) {
  const { supabase } = await requireAdmin();

  const { data: torneo } = await supabase
    .from("competitions")
    .select("category_id")
    .eq("id", competitionId)
    .single();
  if (!torneo) return { error: "El torneo no existe." };

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name, status")
    .eq("id", clubId)
    .single();
  if (!club) return { error: "El club no existe." };

  // ¿Ya tiene equipos en esta categoría? El primero lleva el nombre del club,
  // los siguientes llevan sufijo: "Club B", "Club C"…
  const { data: equiposDelClub } = await supabase
    .from("teams")
    .select("id, name")
    .eq("club_id", clubId)
    .eq("category_id", torneo.category_id)
    .order("created_at");

  let nombreEquipo = club.name;
  if ((equiposDelClub?.length ?? 0) > 0) {
    const sufijo = SUFIJOS[(equiposDelClub?.length ?? 1) - 1] ?? "Z";
    nombreEquipo = `${club.name} ${sufijo}`;
  }

  const { data: equipo, error: errorEquipo } = await supabase
    .from("teams")
    .upsert(
      { club_id: clubId, category_id: torneo.category_id, name: nombreEquipo },
      { onConflict: "club_id,category_id,name", ignoreDuplicates: true }
    )
    .select("id")
    .single();

  let teamId = equipo?.id;
  if (!teamId) {
    const { data: existente } = await supabase
      .from("teams")
      .select("id")
      .eq("club_id", clubId)
      .eq("category_id", torneo.category_id)
      .eq("name", nombreEquipo)
      .single();
    teamId = existente?.id;
  }
  if (!teamId) return { error: errorEquipo?.message ?? "No se pudo crear el equipo." };

  const { error } = await supabase
    .from("competition_teams")
    .upsert(
      { competition_id: competitionId, team_id: teamId },
      { onConflict: "competition_id,team_id", ignoreDuplicates: true }
    );

  if (error) return { error: "El equipo ya estaba inscripto en el torneo." };

  revalidarCompetencias(competitionId);
  return { ok: true };
}

export async function quitarEquipo(competitionId: string, teamId: string) {
  const { supabase } = await requireAdmin();

  // No se puede quitar un equipo que ya jugó partidos confirmados
  const { data: jugados } = await supabase
    .from("matches")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("result_confirmed", true)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .limit(1);

  if ((jugados?.length ?? 0) > 0) {
    return { error: "Ese equipo ya tiene resultados confirmados en este torneo." };
  }

  // Borrar sus partidos sin confirmar y la inscripción
  await supabase
    .from("matches")
    .delete()
    .eq("competition_id", competitionId)
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);

  const { error } = await supabase
    .from("competition_teams")
    .delete()
    .eq("competition_id", competitionId)
    .eq("team_id", teamId);

  if (error) return { error: "No se pudo quitar el equipo." };

  revalidarCompetencias(competitionId);
  return { ok: true };
}

// ============================================================================
// FIXTURE
// ============================================================================

export async function generarFixture(competitionId: string) {
  const { supabase } = await requireAdmin();

  const { data: torneo } = await supabase
    .from("competitions")
    .select("rounds, format, groups_count")
    .eq("id", competitionId)
    .single();
  if (!torneo) return { error: "El torneo no existe." };

  const { data: inscripciones } = await supabase
    .from("competition_teams")
    .select("team_id")
    .eq("competition_id", competitionId)
    .order("created_at");

  const teamIds = (inscripciones ?? []).map((i) => i.team_id);
  if (teamIds.length < 2) {
    return { error: "Se necesitan al menos 2 equipos inscriptos para generar el fixture." };
  }

  // ¿Ya hay resultados cargados? Entonces no se puede regenerar
  const { data: conResultados } = await supabase
    .from("matches")
    .select("id")
    .eq("competition_id", competitionId)
    .not("home_score", "is", null)
    .limit(1);

  if ((conResultados?.length ?? 0) > 0) {
    return { error: "Ya hay partidos con resultados. No se puede regenerar el fixture." };
  }

  // Borrar fixture anterior (si existía) y generar el nuevo
  await supabase.from("matches").delete().eq("competition_id", competitionId);

  // Sorteo: mezclar el orden de los equipos antes de armar los cruces
  const mezclados = [...teamIds];
  for (let i = mezclados.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mezclados[i], mezclados[j]] = [mezclados[j], mezclados[i]];
  }

  let partidos: Record<string, unknown>[] = [];

  if (torneo.format === "eliminacion") {
    // Eliminación directa: se sortea la primera ronda de la llave.
    // Los equipos que sobran (bye) pasan de ronda automáticamente.
    if (mezclados.length < 3) {
      return { error: "La eliminación directa necesita al menos 3 equipos." };
    }
    const ronda = primeraRondaEliminacion(mezclados);
    partidos = ronda.cruces.map((c) => ({
      competition_id: competitionId,
      stage: ronda.etapa,
      stage_order: c.orden,
      home_team_id: c.home,
      away_team_id: c.away,
    }));
  } else if (torneo.format === "grupos_playoffs") {
    // Grupos: reparto serpiente + todos contra todos dentro de cada grupo
    const grupos = asignarGrupos(mezclados, torneo.groups_count);
    for (const grupo of grupos) {
      if (grupo.teamIds.length < 2) {
        return { error: "Hay muy pocos equipos para la cantidad de grupos elegida." };
      }
      const cruces = generarCruces(grupo.teamIds.length, torneo.rounds as 1 | 2);
      partidos.push(
        ...cruces.map((c) => ({
          competition_id: competitionId,
          matchday: c.matchday,
          round: c.round,
          group_name: grupo.nombre,
          home_team_id: grupo.teamIds[c.homeIndex],
          away_team_id: grupo.teamIds[c.awayIndex],
        }))
      );
    }
  } else {
    // Liga y Liga + Playoffs: todos contra todos (el playoff se genera después)
    const cruces = generarCruces(mezclados.length, torneo.rounds as 1 | 2);
    partidos = cruces.map((c) => ({
      competition_id: competitionId,
      matchday: c.matchday,
      round: c.round,
      home_team_id: mezclados[c.homeIndex],
      away_team_id: mezclados[c.awayIndex],
    }));
  }

  const { error } = await supabase.from("matches").insert(partidos);
  if (error) return { error: "No se pudo guardar el fixture generado." };

  revalidarCompetencias(competitionId);
  return { ok: true, partidos: partidos.length };
}

// ============================================================================
// LLAVES DE PLAYOFF (Paso 7C)
// ============================================================================

/**
 * Genera la primera llave de playoff de un torneo con formato
 * "liga_playoffs" o "grupos_playoffs", usando la tabla de posiciones
 * de la fase regular. En "eliminacion" la llave avanza sola.
 */
export async function generarPlayoffs(competitionId: string) {
  const { supabase } = await requireAdmin();

  const { data: torneo } = await supabase
    .from("competitions")
    .select(
      "format, playoff_qualifiers, groups_count, points_win, points_draw, points_loss, tiebreaker"
    )
    .eq("id", competitionId)
    .single();
  if (!torneo) return { error: "El torneo no existe." };
  if (torneo.format !== "liga_playoffs" && torneo.format !== "grupos_playoffs") {
    return { error: "Este formato no tiene llave de playoff aparte." };
  }

  // ¿Ya se generaron?
  const { data: yaHay } = await supabase
    .from("matches")
    .select("id")
    .eq("competition_id", competitionId)
    .neq("stage", "fase_regular")
    .limit(1);
  if ((yaHay?.length ?? 0) > 0) {
    return { error: "Las llaves de playoff ya fueron generadas." };
  }

  // Toda la fase regular tiene que estar confirmada
  const { data: regulares } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score, result_confirmed, group_name")
    .eq("competition_id", competitionId)
    .eq("stage", "fase_regular");

  if (!regulares || regulares.length === 0) {
    return { error: "Primero generá el fixture de la fase regular." };
  }
  const pendientes = regulares.filter((p) => !p.result_confirmed).length;
  if (pendientes > 0) {
    return {
      error: `Todavía hay ${pendientes} partido${pendientes > 1 ? "s" : ""} sin confirmar. Las llaves se generan cuando termina la fase regular.`,
    };
  }

  const config = {
    pointsWin: torneo.points_win,
    pointsDraw: torneo.points_draw,
    pointsLoss: torneo.points_loss,
    tiebreaker: torneo.tiebreaker as "diferencia_gol" | "enfrentamiento_directo",
  };

  let cruces: { home: string; away: string; orden: number }[];
  let etapa: Etapa;

  if (torneo.format === "liga_playoffs") {
    // Tabla única: clasifican los N mejores y se siembran 1° vs último…
    const equipos = [...new Set(regulares.flatMap((p) => [p.home_team_id, p.away_team_id]))];
    if (equipos.length < torneo.playoff_qualifiers) {
      return { error: "Hay menos equipos que clasificados al playoff configurados." };
    }
    const tabla = calcularTabla(
      equipos,
      regulares.map((p) => ({
        homeTeamId: p.home_team_id,
        awayTeamId: p.away_team_id,
        homeScore: p.home_score,
        awayScore: p.away_score,
      })),
      config
    );
    const clasificados = tabla.slice(0, torneo.playoff_qualifiers).map((f) => f.teamId);
    etapa = etapaParaCantidad(clasificados.length);
    cruces = crucesSembrados(clasificados.length).map((c) => ({
      home: clasificados[c.homeIndex],
      away: clasificados[c.awayIndex],
      orden: c.orden,
    }));
  } else {
    // Grupos: tabla por grupo, clasifican los 2 primeros de cada uno
    const nombresGrupos = [...new Set(regulares.map((p) => p.group_name).filter(Boolean))].sort() as string[];
    const clasificados: { grupo: string; posicion: number; teamId: string }[] = [];

    for (const nombre of nombresGrupos) {
      const delGrupo = regulares.filter((p) => p.group_name === nombre);
      const equipos = [...new Set(delGrupo.flatMap((p) => [p.home_team_id, p.away_team_id]))];
      const tabla = calcularTabla(
        equipos,
        delGrupo.map((p) => ({
          homeTeamId: p.home_team_id,
          awayTeamId: p.away_team_id,
          homeScore: p.home_score,
          awayScore: p.away_score,
        })),
        config
      );
      tabla.slice(0, 2).forEach((f, i) => {
        clasificados.push({ grupo: nombre, posicion: i + 1, teamId: f.teamId });
      });
    }

    if (clasificados.length < 4) {
      return { error: "No hay suficientes equipos clasificados desde los grupos." };
    }
    etapa = etapaParaCantidad(clasificados.length);
    cruces = crucesEntreGrupos(clasificados);
  }

  const partidos = cruces.map((c) => ({
    competition_id: competitionId,
    stage: etapa,
    stage_order: c.orden,
    home_team_id: c.home,
    away_team_id: c.away,
  }));

  const { error } = await supabase.from("matches").insert(partidos);
  if (error) return { error: "No se pudieron guardar las llaves." };

  revalidarCompetencias(competitionId);
  return { ok: true, partidos: partidos.length };
}

/**
 * AVANCE AUTOMÁTICO DE LLAVE.
 * Se llama cada vez que un partido de playoff queda confirmado:
 * si era el último pendiente de su etapa, arma la siguiente ronda
 * (ganadores cruzados por stage_order + equipos con bye) o, si era
 * la final, marca el torneo como finalizado.
 */
async function avanzarLlaveSiCorresponde(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  partidoId: string
) {
  const { data: partido } = await supabase
    .from("matches")
    .select("competition_id, stage")
    .eq("id", partidoId)
    .single();
  if (!partido || partido.stage === "fase_regular") return;

  const { data: deLaEtapa } = await supabase
    .from("matches")
    .select(
      "id, home_team_id, away_team_id, home_score, away_score, result_confirmed, stage_order"
    )
    .eq("competition_id", partido.competition_id)
    .eq("stage", partido.stage)
    .order("stage_order");

  if (!deLaEtapa || deLaEtapa.some((p) => !p.result_confirmed)) return; // todavía falta

  // La final confirmada => torneo terminado
  if (partido.stage === "final") {
    await supabase
      .from("competitions")
      .update({ status: "finalizado" })
      .eq("id", partido.competition_id);
    return;
  }

  const ganadores = deLaEtapa.map((p) =>
    p.home_score > p.away_score ? p.home_team_id : p.away_team_id
  );

  // Equipos con bye: inscriptos que NO jugaron esta etapa (solo pasa en la
  // primera ronda de eliminación directa)
  const { data: inscripciones } = await supabase
    .from("competition_teams")
    .select("team_id")
    .eq("competition_id", partido.competition_id);
  const jugaron = new Set(deLaEtapa.flatMap((p) => [p.home_team_id, p.away_team_id]));
  const { data: rondasAnteriores } = await supabase
    .from("matches")
    .select("home_team_id, away_team_id, home_score, away_score")
    .eq("competition_id", partido.competition_id)
    .neq("stage", "fase_regular")
    .neq("stage", partido.stage);
  const eliminados = new Set(
    (rondasAnteriores ?? []).map((p) =>
      p.home_score > p.away_score ? p.away_team_id : p.home_team_id
    )
  );
  const byes = (inscripciones ?? [])
    .map((i) => i.team_id)
    .filter((id) => !jugaron.has(id) && !eliminados.has(id));

  const participantes = [...ganadores, ...byes];
  if (participantes.length < 2) return;

  const proxima = siguienteEtapa(partido.stage as Etapa) ?? etapaParaCantidad(participantes.length);
  const cruces = emparejarSiguienteRonda(participantes);

  const { error } = await supabase.from("matches").insert(
    cruces.map((c) => ({
      competition_id: partido.competition_id,
      stage: proxima,
      stage_order: c.orden,
      home_team_id: c.home,
      away_team_id: c.away,
    }))
  );

  if (!error && proxima === "final" && cruces.length === 0) {
    await supabase
      .from("competitions")
      .update({ status: "finalizado" })
      .eq("id", partido.competition_id);
  }
}

/** En playoff no hay empate: el marcador debe definir un ganador (incluye penales). */
async function validarEmpatePlayoff(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  partidoId: string,
  homeScore: number,
  awayScore: number
): Promise<string | null> {
  if (homeScore !== awayScore) return null;
  const { data: partido } = await supabase
    .from("matches")
    .select("stage")
    .eq("id", partidoId)
    .single();
  if (partido && partido.stage !== "fase_regular") {
    return "En llaves de playoff no puede haber empate: cargá el resultado con los penales incluidos (ej: 6-5).";
  }
  return null;
}

// ============================================================================
// PROGRAMACIÓN DE PARTIDOS (día, hora, cancha, árbitro, suspender)
// ============================================================================

export async function actualizarPartido(partidoId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const competitionId = formData.get("competitionId") as string;
  const matchdayRaw = (formData.get("matchday") as string)?.trim();
  const scheduledRaw = (formData.get("scheduled_at") as string)?.trim();
  const venueId = (formData.get("venue_id") as string) || null;
  const refereeId = (formData.get("referee_id") as string) || null;
  const status = (formData.get("status") as string) || "programado";
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!["programado", "suspendido"].includes(status)) {
    return { error: "Estado inválido." };
  }

  const { error } = await supabase
    .from("matches")
    .update({
      matchday: matchdayRaw ? Number(matchdayRaw) : null,
      scheduled_at: scheduledRaw ? new Date(scheduledRaw).toISOString() : null,
      venue_id: venueId,
      referee_id: refereeId,
      status,
      notes,
    })
    .eq("id", partidoId);

  if (error) return { error: "No se pudo actualizar el partido." };

  revalidarCompetencias(competitionId);
  return { ok: true };
}

// ============================================================================
// RESULTADOS
// ============================================================================

function parsearGoles(valor: FormDataEntryValue | null): number | null {
  const n = Number(valor);
  if (valor === null || valor === "" || !Number.isInteger(n) || n < 0 || n > 99) return null;
  return n;
}

/** El árbitro designado carga el resultado → queda PENDIENTE de confirmación. */
export async function cargarResultadoArbitro(partidoId: string, formData: FormData) {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay una sesión activa." };

  const homeScore = parsearGoles(formData.get("home_score"));
  const awayScore = parsearGoles(formData.get("away_score"));
  if (homeScore === null || awayScore === null) {
    return { error: "Los goles deben ser números enteros entre 0 y 99." };
  }

  // En playoff no hay empate: el árbitro carga el resultado con penales incluidos
  const errorEmpate = await validarEmpatePlayoff(supabase, partidoId, homeScore, awayScore);
  if (errorEmpate) return { error: errorEmpate };

  // RLS garantiza que solo el árbitro designado puede actualizar este partido
  const { data, error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "jugado",
      result_confirmed: false,
    })
    .eq("id", partidoId)
    .eq("status", "programado")
    .select("competition_id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo cargar (¿estás designado en este partido?)." };
  }

  revalidarCompetencias(data[0].competition_id);
  return { ok: true };
}

/** La federación carga el resultado directamente → queda CONFIRMADO. */
export async function cargarResultadoAdmin(partidoId: string, formData: FormData) {
  const { supabase } = await requireAdmin();

  const competitionId = formData.get("competitionId") as string;
  const homeScore = parsearGoles(formData.get("home_score"));
  const awayScore = parsearGoles(formData.get("away_score"));
  if (homeScore === null || awayScore === null) {
    return { error: "Los goles deben ser números enteros entre 0 y 99." };
  }

  const errorEmpate = await validarEmpatePlayoff(supabase, partidoId, homeScore, awayScore);
  if (errorEmpate) return { error: errorEmpate };

  // estado previo: solo se descuentan suspensiones al pasar a confirmado
  const { data: previo } = await supabase
    .from("matches")
    .select("result_confirmed")
    .eq("id", partidoId)
    .single();

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "jugado",
      result_confirmed: true,
    })
    .eq("id", partidoId);

  if (error) return { error: "No se pudo cargar el resultado." };

  if (!previo?.result_confirmed) {
    await descontarSuspensionesDelPartido(supabase, partidoId);
    await avanzarLlaveSiCorresponde(supabase, partidoId);
  }

  revalidarCompetencias(competitionId);
  return { ok: true };
}

/** La federación confirma lo que cargó el árbitro → entra a la tabla. */
export async function confirmarResultado(partidoId: string, competitionId: string) {
  const { supabase } = await requireAdmin();

  const { data: previo } = await supabase
    .from("matches")
    .select("result_confirmed, home_score, away_score, stage")
    .eq("id", partidoId)
    .single();

  if (
    previo &&
    previo.stage !== "fase_regular" &&
    previo.home_score !== null &&
    previo.home_score === previo.away_score
  ) {
    return {
      error: "En llaves de playoff no puede haber empate: corregí el resultado con los penales incluidos.",
    };
  }

  const { error } = await supabase
    .from("matches")
    .update({ result_confirmed: true })
    .eq("id", partidoId);

  if (error) return { error: "No se pudo confirmar el resultado." };

  if (!previo?.result_confirmed) {
    await descontarSuspensionesDelPartido(supabase, partidoId);
    await avanzarLlaveSiCorresponde(supabase, partidoId);
  }

  revalidarCompetencias(competitionId);
  return { ok: true };
}

/** W.O.: la federación define el ganador; el marcador sale de la config del torneo. */
export async function marcarWO(partidoId: string, competitionId: string, ganador: "home" | "away") {
  const { supabase } = await requireAdmin();

  const { data: torneo } = await supabase
    .from("competitions")
    .select("wo_home_goals, wo_away_goals")
    .eq("id", competitionId)
    .single();
  if (!torneo) return { error: "El torneo no existe." };

  const { data: previo } = await supabase
    .from("matches")
    .select("result_confirmed")
    .eq("id", partidoId)
    .single();

  const homeScore = ganador === "home" ? torneo.wo_home_goals : torneo.wo_away_goals;
  const awayScore = ganador === "away" ? torneo.wo_home_goals : torneo.wo_away_goals;

  const { error } = await supabase
    .from("matches")
    .update({
      home_score: homeScore,
      away_score: awayScore,
      status: "wo",
      result_confirmed: true,
    })
    .eq("id", partidoId);

  if (error) return { error: "No se pudo marcar el W.O." };

  if (!previo?.result_confirmed) {
    await descontarSuspensionesDelPartido(supabase, partidoId);
    await avanzarLlaveSiCorresponde(supabase, partidoId);
  }

  revalidarCompetencias(competitionId);
  return { ok: true };
}
