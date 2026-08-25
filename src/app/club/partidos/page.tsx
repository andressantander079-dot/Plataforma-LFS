import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, Calendar, MapPin, ShieldCheck, AlertCircle, Shield, FileDown } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import { calcularTabla, vallaMenosVencida } from "@/lib/core/competencias/tabla";
import { TablaPosiciones } from "@/components/competencias/TablaPosiciones";
import { GestionPlantelClub } from "@/components/planilla/GestionPlantelClub";
import { obtenerEstadosPlanilla } from "@/lib/actions/planilla.actions";

/**
 * PARTIDOS DEL CLUB
 * Por cada torneo en que participa: métricas (PJ, GF, GC, DIF),
 * próximos partidos, resultados y tabla de posiciones.
 * Paso 7A: botón "Gestionar Plantel" para convocar jugadores y
 * descarga de la planilla oficial una vez aprobada por la federación.
 */

function fechaLinda(iso: string | null): string {
  if (!iso) return "A definir";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default async function ClubPartidos() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id) redirect("/club/dashboard");

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", profile.club_id)
    .single();
  if (!club) redirect("/login");

  // Mis equipos (puedo tener varios por categoría)
  const { data: misEquipos } = await supabase
    .from("teams")
    .select("id, name, category_id")
    .eq("club_id", club.id);
  const misTeamIds = (misEquipos ?? []).map((t) => t.id);

  // Torneos en los que participo
  const { data: inscripciones } = misTeamIds.length
    ? await supabase
        .from("competition_teams")
        .select("competition_id, team_id")
        .in("team_id", misTeamIds)
    : { data: [] };

  const competitionIds = [...new Set((inscripciones ?? []).map((i) => i.competition_id))];

  const { data: torneos } = competitionIds.length
    ? await supabase
        .from("competitions")
        .select("*, categories(name)")
        .in("id", competitionIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const iniciales = club.name
    .split(" ")
    .filter((p: string) => p.length > 2)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Trophy className="w-7 h-7 text-[#F97316]" />
          Partidos y Competencias
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Cronogramas, resultados, plantillas oficiales y tablas de posiciones de tus equipos.
        </p>
      </div>
        {(torneos ?? []).length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm flex flex-col items-center gap-2">
            <Trophy className="w-8 h-8 text-slate-300" />
            <p className="font-serif text-lg font-bold text-[#1A2A44]">
              Tu club todavía no participa de ningún torneo
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              Cuando la federación cree un torneo y tu club esté habilitado, los partidos
              y la tabla aparecen acá automáticamente.
            </p>
          </div>
        )}

        {await Promise.all(
          (torneos ?? []).map(async (torneo) => {
            const { data: partidos } = await supabase
              .from("matches")
              .select("*")
              .eq("competition_id", torneo.id)
              .order("matchday", { ascending: true, nullsFirst: false });

            // Todos los equipos del torneo para la tabla y los nombres
            const { data: insc } = await supabase
              .from("competition_teams")
              .select("team_id, teams(name)")
              .eq("competition_id", torneo.id);
            const nombreEquipo = new Map(
              (insc ?? []).map((i) => [
                i.team_id,
                (i.teams as unknown as { name: string } | null)?.name ?? "—",
              ])
            );
            const { data: canchas } = await supabase.from("venues").select("id, name");
            const nombreCancha = new Map((canchas ?? []).map((c) => [c.id, c.name]));

            const confirmados = (partidos ?? []).filter(
              (p) => p.result_confirmed && p.home_score !== null && p.away_score !== null
            );
            const tabla = calcularTabla(
              (insc ?? []).map((i) => i.team_id),
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

            const misEquiposTorneo = (inscripciones ?? [])
              .filter((i) => i.competition_id === torneo.id)
              .map((i) => i.team_id);

            const mios = (partidos ?? []).filter(
              (p) => misEquiposTorneo.includes(p.home_team_id) || misEquiposTorneo.includes(p.away_team_id)
            );
            const proximos = mios.filter((p) => p.status === "programado").slice(0, 6);
            const jugadosMios = mios
              .filter((p) => p.status === "jugado" || p.status === "wo")
              .slice(-6)
              .reverse();

            // Estado de planilla de cada partido (botón Gestionar Plantel / descarga)
            const estadosPlanilla = await obtenerEstadosPlanilla(mios.map((p) => p.id));

            const categoria = (torneo.categories as unknown as { name: string } | null)?.name ?? "";

            return (
              <section key={torneo.id} className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#F97316]" />
                  <h2 className="font-serif text-lg font-black text-[#1A2A44]">{torneo.name}</h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {categoria} · {torneo.season}
                  </span>
                </div>

                {/* Métricas de mis equipos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {misEquiposTorneo.map((teamId) => {
                    const fila = tabla.find((f) => f.teamId === teamId);
                    const posicion = tabla.findIndex((f) => f.teamId === teamId) + 1;
                    const soyValla = valla?.teamId === teamId;
                    return (
                      <div
                        key={teamId}
                        className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm text-[#1A2A44]">
                            {nombreEquipo.get(teamId)}
                          </p>
                          <span className="text-[10px] font-black text-[#F97316]">
                            {posicion > 0 ? `${posicion}° puesto` : "—"}
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-center">
                          {[
                            { label: "PJ", valor: fila?.pj ?? 0 },
                            { label: "GF", valor: fila?.gf ?? 0 },
                            { label: "GC", valor: fila?.gc ?? 0 },
                            {
                              label: "DIF",
                              valor: fila ? (fila.dif > 0 ? `+${fila.dif}` : fila.dif) : 0,
                            },
                          ].map((m) => (
                            <div key={m.label} className="bg-slate-50 rounded-xl py-2">
                              <p className="text-lg font-black text-[#1A2A44]">{m.valor}</p>
                              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                {m.label}
                              </p>
                            </div>
                          ))}
                        </div>
                        {soyValla && (
                          <p className="text-[10px] font-bold text-green-700 bg-green-50 rounded-lg px-2 py-1 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Valla menos vencida del torneo
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Próximos partidos */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <p className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#1A2A44] uppercase tracking-wider">
                    Próximos partidos
                  </p>
                  {proximos.length === 0 && (
                    <p className="text-xs text-slate-400 px-4 py-4">No hay partidos programados.</p>
                  )}
                  <ul className="divide-y divide-slate-100">
                    {proximos.map((p) => {
                      const miTeamId = misEquiposTorneo.includes(p.home_team_id)
                        ? p.home_team_id
                        : p.away_team_id;
                      const rivalId = miTeamId === p.home_team_id ? p.away_team_id : p.home_team_id;
                      return (
                        <li key={p.id} className="px-4 py-3 flex flex-col gap-1.5">
                          <p className="text-sm font-bold text-[#1A2A44]">
                            {nombreEquipo.get(p.home_team_id)} vs {nombreEquipo.get(p.away_team_id)}
                            {p.matchday !== null && (
                              <span className="text-[10px] font-bold text-slate-400"> · Fecha {p.matchday}</span>
                            )}
                          </p>
                          <p className="text-[11px] text-slate-500 flex flex-wrap gap-x-3">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" /> {fechaLinda(p.scheduled_at)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />{" "}
                              {p.venue_id ? (nombreCancha.get(p.venue_id) ?? "A definir") : "A definir"}
                            </span>
                          </p>
                          <div>
                            <GestionPlantelClub
                              matchId={p.id}
                              teamId={miTeamId}
                              equipoNombre={nombreEquipo.get(miTeamId) ?? "Mi equipo"}
                              rivalNombre={nombreEquipo.get(rivalId) ?? "Rival"}
                              estado={estadosPlanilla[p.id]}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* Resultados recientes */}
                {jugadosMios.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <p className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#1A2A44] uppercase tracking-wider">
                      Resultados
                    </p>
                    <ul className="divide-y divide-slate-100">
                      {jugadosMios.map((p) => (
                        <li key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                          <span className="flex-1 text-right font-bold text-[#1A2A44] truncate">
                            {nombreEquipo.get(p.home_team_id)}
                          </span>
                          <span className="shrink-0 font-black bg-slate-100 rounded-lg px-2.5 py-0.5 text-[#1A2A44]">
                            {p.home_score} - {p.away_score}
                          </span>
                          <span className="flex-1 font-bold text-[#1A2A44] truncate">
                            {nombreEquipo.get(p.away_team_id)}
                          </span>
                          {!p.result_confirmed && (
                            <span className="text-[9px] font-bold text-orange-600 flex items-center gap-0.5 shrink-0">
                              <AlertCircle className="w-3 h-3" /> A confirmar
                            </span>
                          )}
                          {estadosPlanilla[p.id]?.status === "aprobada" && (
                            <Link
                              href={`/club/partidos/${p.id}`}
                              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg px-2 py-1 transition-colors"
                            >
                              <FileDown className="w-3 h-3" /> Planilla
                            </Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Tabla de posiciones */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                  <p className="font-bold text-xs text-[#1A2A44] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#F97316]" /> Tabla de posiciones
                  </p>
                  <TablaPosiciones filas={filasConNombre} vallaId={valla?.teamId ?? null} />
                </div>
              </section>
            );
          })
        )}
    </div>
  );
}
