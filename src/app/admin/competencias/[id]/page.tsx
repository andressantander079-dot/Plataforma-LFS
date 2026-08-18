import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Users, CalendarRange, ListOrdered, Ban, GitBranch } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { calcularTabla, vallaMenosVencida } from "@/lib/core/competencias/tabla";
import { cantidadFechas, cantidadPartidos } from "@/lib/core/competencias/fixture";
import { TablaPosiciones } from "@/components/competencias/TablaPosiciones";
import { FixtureEditable, type PartidoUI } from "@/components/competencias/FixtureEditable";
import { GestionEquiposTorneo } from "@/components/competencias/GestionEquiposTorneo";
import { AccionesTorneo } from "@/components/competencias/AccionesTorneo";
import { BotonGenerarFixture } from "@/components/competencias/BotonGenerarFixture";
import { BotonGenerarPlayoffs } from "@/components/competencias/BotonGenerarPlayoffs";
import { LlavesPlayoff } from "@/components/competencias/LlavesPlayoff";
import type { Etapa } from "@/lib/core/competencias/playoff";

/**
 * DETALLE DE TORNEO (admin)
 * Equipos inscriptos · Fixture editable · Tabla de posiciones automática.
 */

const FORMATO_UI: Record<string, string> = {
  liga: "Liga — todos contra todos",
  eliminacion: "Eliminación directa",
  grupos_playoffs: "Grupos + Playoffs",
  liga_playoffs: "Liga + Playoffs",
};

export default async function DetalleTorneo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: torneo } = await supabase
    .from("competitions")
    .select("*, categories(name)")
    .eq("id", id)
    .single();
  if (!torneo) notFound();

  const [
    { data: inscripciones },
    { data: partidos },
    { data: canchas },
    { data: arbitros },
    { data: clubes },
    { data: suspensionesRaw },
  ] = await Promise.all([
    supabase
      .from("competition_teams")
      .select("team_id, teams(id, name, club_id, clubs(name))")
      .eq("competition_id", id)
      .order("created_at"),
    supabase
      .from("matches")
      .select("*")
      .eq("competition_id", id)
      .order("matchday", { ascending: true, nullsFirst: false })
      .order("created_at"),
    supabase.from("venues").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("role", "arbitro").order("full_name"),
    supabase.from("clubs").select("id, name").eq("status", "habilitado").order("name"),
    // Disciplina automática (Paso 7B): suspensiones activas del torneo
    supabase
      .from("player_suspensions")
      .select("id, motivo, partidos_pendientes, players(first_name, last_name), teams(name)")
      .eq("competition_id", id)
      .gt("partidos_pendientes", 0)
      .order("created_at", { ascending: false }),
  ]);

  const equipos = (inscripciones ?? []).map((i) => {
    const team = i.teams as unknown as { id: string; name: string; clubs: { name: string } | null };
    return {
      teamId: team.id,
      nombre: team.name,
      clubNombre: team.clubs?.name ?? "",
    };
  });

  const nombreEquipo = new Map(equipos.map((e) => [e.teamId, e.nombre]));
  const nombreCancha = new Map((canchas ?? []).map((c) => [c.id, c.name]));
  const nombreArbitro = new Map((arbitros ?? []).map((a) => [a.id, a.full_name]));

  const partidosUI: PartidoUI[] = (partidos ?? []).map((p) => ({
    id: p.id,
    matchday: p.matchday,
    round: p.round,
    stage: (p.stage ?? "fase_regular") as Etapa,
    group_name: p.group_name ?? null,
    stage_order: p.stage_order ?? null,
    homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
    awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
    scheduled_at: p.scheduled_at,
    venueNombre: p.venue_id ? (nombreCancha.get(p.venue_id) ?? null) : null,
    referee_id: p.referee_id,
    refereeNombre: p.referee_id ? (nombreArbitro.get(p.referee_id) ?? null) : null,
    status: p.status,
    home_score: p.home_score,
    away_score: p.away_score,
    result_confirmed: p.result_confirmed,
    notes: p.notes,
  }));

  // Tabla: solo resultados CONFIRMADOS de la fase regular (playoffs no suman)
  const confirmados = (partidos ?? []).filter(
    (p) =>
      p.result_confirmed &&
      p.home_score !== null &&
      p.away_score !== null &&
      (p.stage ?? "fase_regular") === "fase_regular"
  );
  const configTabla = {
    pointsWin: torneo.points_win,
    pointsDraw: torneo.points_draw,
    pointsLoss: torneo.points_loss,
    tiebreaker: torneo.tiebreaker,
  };

  const armarTabla = (teamIds: string[], lista: typeof confirmados) => {
    const tabla = calcularTabla(
      teamIds,
      lista.map((p) => ({
        homeTeamId: p.home_team_id,
        awayTeamId: p.away_team_id,
        homeScore: p.home_score,
        awayScore: p.away_score,
      })),
      configTabla
    );
    return {
      filas: tabla.map((f) => ({ ...f, nombre: nombreEquipo.get(f.teamId) ?? "—" })),
      vallaId: vallaMenosVencida(tabla)?.teamId ?? null,
    };
  };

  let seccionesTabla: { titulo: string | null; filas: ReturnType<typeof armarTabla>["filas"]; vallaId: string | null }[];
  if (torneo.format === "grupos_playoffs") {
    const grupos = [...new Set(confirmados.map((p) => p.group_name).filter(Boolean))].sort() as string[];
    seccionesTabla = grupos.map((g) => {
      const delGrupo = confirmados.filter((p) => p.group_name === g);
      const equiposGrupo = [...new Set(delGrupo.flatMap((p) => [p.home_team_id, p.away_team_id]))];
      const t = armarTabla(equiposGrupo, delGrupo);
      return { titulo: `Grupo ${g}`, filas: t.filas, vallaId: t.vallaId };
    });
    if (seccionesTabla.length === 0) {
      const t = armarTabla(equipos.map((e) => e.teamId), []);
      seccionesTabla = [{ titulo: null, filas: t.filas, vallaId: t.vallaId }];
    }
  } else {
    const t = armarTabla(equipos.map((e) => e.teamId), confirmados);
    seccionesTabla = [{ titulo: null, filas: t.filas, vallaId: t.vallaId }];
  }

  const categoria = (torneo.categories as unknown as { name: string } | null)?.name ?? "—";
  const hayFixture = (partidos ?? []).length > 0;

  // Playoffs: llaves generadas, formato con playoff y fase regular completa
  const partidosPlayoff = partidosUI.filter((p) => p.stage !== "fase_regular");
  const partidosRegulares = (partidos ?? []).filter(
    (p) => (p.stage ?? "fase_regular") === "fase_regular"
  );
  const formatoConPlayoff =
    torneo.format === "liga_playoffs" || torneo.format === "grupos_playoffs";
  const faseRegularCompleta =
    partidosRegulares.length > 0 && partidosRegulares.every((p) => p.result_confirmed);

  // Campeón: ganador de la final confirmada
  const final = (partidos ?? []).find(
    (p) => p.stage === "final" && p.result_confirmed && p.home_score !== null && p.away_score !== null
  );
  const campeon = final
    ? nombreEquipo.get(
        final.home_score > final.away_score ? final.home_team_id : final.away_team_id
      )
    : null;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/competencias"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Competencias
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <Trophy className="w-7 h-7 text-[#F97316]" />
              {torneo.name}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {categoria} · Temporada {torneo.season} · {FORMATO_UI[torneo.format]} ·{" "}
              {torneo.rounds === 2 ? "Ida y vuelta" : "Solo ida"} · Puntos {torneo.points_win}/
              {torneo.points_draw}/{torneo.points_loss}
              {torneo.format === "liga_playoffs" &&
                ` · Clasifican ${torneo.playoff_qualifiers} al playoff`}
              {torneo.format === "grupos_playoffs" &&
                ` · ${torneo.groups_count} grupos · Clasifican 2 por grupo`}
            </p>
          </div>
          <AccionesTorneo competitionId={id} estado={torneo.status} />
        </div>
      </div>

      {/* Equipos */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#F97316]" />
          Equipos inscriptos ({equipos.length})
        </h2>
        <GestionEquiposTorneo
          competitionId={id}
          equipos={equipos}
          clubesDisponibles={(clubes ?? []).map((c) => ({ id: c.id, nombre: c.name }))}
        />
      </section>

      {/* Fixture */}
      <section className="flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <CalendarRange className="w-4 h-4 text-[#F97316]" />
          Fixture
        </h2>

        {!hayFixture && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-3 text-center">
            {torneo.format === "eliminacion" ? (
              <p className="text-sm text-slate-500 max-w-md">
                Se sortea la primera ronda de la llave con los {equipos.length} equipos. Los que
                sobran pasan de ronda automáticamente.
              </p>
            ) : torneo.format === "grupos_playoffs" ? (
              <p className="text-sm text-slate-500 max-w-md">
                Se reparten los {equipos.length} equipos en {torneo.groups_count} grupos parejos
                (serpiente) y cada grupo juega todos contra todos.
              </p>
            ) : (
              <p className="text-sm text-slate-500 max-w-md">
                Con {equipos.length} equipos a {torneo.rounds === 2 ? "ida y vuelta" : "una vuelta"}{" "}
                el torneo tendrá <strong>{cantidadPartidos(equipos.length, torneo.rounds)}</strong>{" "}
                partidos en <strong>{cantidadFechas(equipos.length, torneo.rounds)}</strong> fechas.
              </p>
            )}
            <BotonGenerarFixture competitionId={id} cantidadEquipos={equipos.length} />
          </div>
        )}

        {hayFixture && (
          <FixtureEditable
            competitionId={id}
            partidos={partidosUI}
            canchas={(canchas ?? []).map((c) => ({ id: c.id, nombre: c.name }))}
            arbitros={(arbitros ?? []).map((a) => ({ id: a.id, nombre: a.full_name }))}
          />
        )}
      </section>

      {/* Campeón */}
      {campeon && (
        <section className="bg-gradient-to-r from-[#1A2A44] to-[#2A3A5C] rounded-2xl p-6 shadow-md text-center flex flex-col items-center gap-1">
          <Trophy className="w-8 h-8 text-[#F97316]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Campeón del torneo
          </p>
          <p className="font-serif text-2xl font-black text-white">{campeon}</p>
        </section>
      )}

      {/* Llaves de playoff */}
      {(partidosPlayoff.length > 0 || (formatoConPlayoff && hayFixture)) && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#F97316]" />
            Llaves de playoff
          </h2>
          {partidosPlayoff.length > 0 ? (
            <LlavesPlayoff
              partidos={partidosPlayoff.map((p) => ({
                id: p.id,
                stage: p.stage,
                stage_order: p.stage_order,
                homeNombre: p.homeNombre,
                awayNombre: p.awayNombre,
                home_score: p.home_score,
                away_score: p.away_score,
                result_confirmed: p.result_confirmed,
              }))}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center gap-3 text-center">
              <p className="text-sm text-slate-500 max-w-md">
                Cuando termine la fase regular se generan los cruces: los mejores de la tabla se
                enfrentan en llaves hasta la final.
              </p>
              <BotonGenerarPlayoffs competitionId={id} faseRegularCompleta={faseRegularCompleta} />
            </div>
          )}
        </section>
      )}

      {/* Tabla de posiciones */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[#F97316]" />
          Tabla de posiciones
        </h2>
        {seccionesTabla.map((s) => (
          <div key={s.titulo ?? "tabla"} className="flex flex-col gap-2">
            {s.titulo && (
              <p className="text-xs font-black text-[#1A2A44] uppercase tracking-wide">
                {s.titulo}
              </p>
            )}
            <TablaPosiciones filas={s.filas} vallaId={s.vallaId} />
          </div>
        ))}
        <p className="text-[10px] text-slate-400">
          Se actualiza sola con los resultados confirmados · Desempate:{" "}
          {torneo.tiebreaker === "enfrentamiento_directo" ? "enfrentamiento directo" : "diferencia de gol"}
          {(torneo.format === "liga_playoffs" || torneo.format === "grupos_playoffs") &&
            " · Los partidos de playoff no suman puntos"}
        </p>
      </section>

      {/* Disciplina automática: suspensiones activas del torneo */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <Ban className="w-4 h-4 text-red-600" />
          Suspensiones activas ({(suspensionesRaw ?? []).length})
        </h2>
        <p className="text-[10px] text-slate-400 -mt-2">
          Se generan solas: roja directa o {torneo.yellow_cards_suspension} amarillas en el torneo = 1 fecha.
          Se descuentan solas cuando juega el equipo. El jugador no se puede convocar mientras tanto.
        </p>

        {(suspensionesRaw ?? []).length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No hay jugadores suspendidos en este torneo.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(suspensionesRaw ?? []).map((s) => {
              const jugador = s.players as unknown as { first_name: string; last_name: string } | null;
              const equipo = s.teams as unknown as { name: string } | null;
              return (
                <li
                  key={s.id}
                  className="border border-red-100 bg-red-50/50 rounded-xl px-3 py-2 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[#1A2A44] text-sm truncate">
                      {jugador ? `${jugador.last_name}, ${jugador.first_name}` : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {equipo?.name ?? "—"} · {s.motivo === "roja" ? "Tarjeta roja" : "Acumulación de amarillas"}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-black text-red-700 bg-red-100 rounded-full px-2.5 py-1">
                    {s.partidos_pendientes} fecha{s.partidos_pendientes > 1 ? "s" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
