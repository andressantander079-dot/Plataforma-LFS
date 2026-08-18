import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Users, CalendarRange, ListOrdered, Ban } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { calcularTabla, vallaMenosVencida } from "@/lib/core/competencias/tabla";
import { cantidadFechas, cantidadPartidos } from "@/lib/core/competencias/fixture";
import { TablaPosiciones } from "@/components/competencias/TablaPosiciones";
import { FixtureEditable, type PartidoUI } from "@/components/competencias/FixtureEditable";
import { GestionEquiposTorneo } from "@/components/competencias/GestionEquiposTorneo";
import { AccionesTorneo } from "@/components/competencias/AccionesTorneo";
import { BotonGenerarFixture } from "@/components/competencias/BotonGenerarFixture";

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

  // Tabla: solo resultados confirmados por la federación
  const confirmados = (partidos ?? []).filter(
    (p) => p.result_confirmed && p.home_score !== null && p.away_score !== null
  );
  const tabla = calcularTabla(
    equipos.map((e) => e.teamId),
    confirmados.map((p) => ({
      homeTeamId: p.home_team_id,
      awayTeamId: p.away_team_id,
      homeScore: p.home_score,
      awayScore: p.away_score,
    })),
    {
      pointsWin: torneo.points_win,
      pointsDraw: torneo.points_draw,
      pointsLoss: torneo.points_loss,
      tiebreaker: torneo.tiebreaker,
    }
  );
  const valla = vallaMenosVencida(tabla);
  const filasConNombre = tabla.map((f) => ({
    ...f,
    nombre: nombreEquipo.get(f.teamId) ?? "—",
  }));

  const categoria = (torneo.categories as unknown as { name: string } | null)?.name ?? "—";
  const hayFixture = (partidos ?? []).length > 0;

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
            <p className="text-sm text-slate-500 max-w-md">
              Con {equipos.length} equipos a {torneo.rounds === 2 ? "ida y vuelta" : "una vuelta"}{" "}
              el torneo tendrá <strong>{cantidadPartidos(equipos.length, torneo.rounds)}</strong>{" "}
              partidos en <strong>{cantidadFechas(equipos.length, torneo.rounds)}</strong> fechas.
            </p>
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

      {/* Tabla de posiciones */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-[#F97316]" />
          Tabla de posiciones
        </h2>
        <TablaPosiciones filas={filasConNombre} vallaId={valla?.teamId ?? null} />
        <p className="text-[10px] text-slate-400">
          Se actualiza sola con los resultados confirmados · Desempate:{" "}
          {torneo.tiebreaker === "enfrentamiento_directo" ? "enfrentamiento directo" : "diferencia de gol"}
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
