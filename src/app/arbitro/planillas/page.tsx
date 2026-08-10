import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Calendar, MapPin, ChevronRight } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerEstadosPlanilla } from "@/lib/actions/planilla.actions";

/**
 * PLANILLAS DEL ÁRBITRO (listado)
 * Sus partidos designados con el estado de la planilla digital.
 * El árbitro solo puede editar planillas en estado "confirmada"
 * (ambos clubes confirmaron su convocatoria).
 */
export default async function PlanillasArbitro() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: partidos } = await supabase
    .from("matches")
    .select("*, competitions(name), venues(name)")
    .eq("referee_id", user.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .order("created_at");

  // Nombres de equipos (mapa aparte para evitar depender de los nombres de FK)
  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["sin-equipos"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  const estados = await obtenerEstadosPlanilla((partidos ?? []).map((p) => p.id));

  const etiquetaEstado = (matchId: string) => {
    const estado = estados[matchId]?.status;
    if (estado === "aprobada")
      return { texto: "Aprobada", clases: "bg-green-50 text-green-700 border-green-200" };
    if (estado === "confirmada")
      return { texto: "Lista para editar", clases: "bg-orange-50 text-[#F97316] border-orange-200" };
    if (estado === "borrador")
      return { texto: "Convocatoria de clubes en curso", clases: "bg-slate-50 text-slate-500 border-slate-200" };
    return { texto: "Sin convocatoria", clases: "bg-slate-50 text-slate-400 border-slate-200" };
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-[#F97316]" />
          Planillas de Partido
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Cuando los dos clubes confirman su convocatoria, la planilla queda habilitada
          para que registres bajas, altas y eventos del partido.
        </p>
      </div>

      {(partidos ?? []).length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <p className="font-serif text-lg font-bold text-[#1A2A44]">Sin partidos designados</p>
          <p className="text-xs text-slate-500 mt-1">
            Cuando la federación te designe un partido, su planilla va a aparecer acá.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {(partidos ?? []).map((p) => {
          const estado = etiquetaEstado(p.id);
          return (
            <li key={p.id}>
              <Link
                href={`/arbitro/planillas/${p.id}`}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 hover:shadow-md hover:border-[#F97316]/40 transition group"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {(p.competitions as unknown as { name: string } | null)?.name ?? "Torneo"}
                    {p.matchday ? ` · Fecha ${p.matchday}` : ""}
                  </p>
                  <p className="font-serif font-black text-[#1A2A44] truncate">
                    {nombreEquipo.get(p.home_team_id) ?? "—"}{" "}
                    <span className="text-slate-400 font-normal">vs</span>{" "}
                    {nombreEquipo.get(p.away_team_id) ?? "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {p.scheduled_at
                        ? new Date(p.scheduled_at).toLocaleString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "A programar"}
                    </span>
                    {(p.venues as unknown as { name: string } | null)?.name && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(p.venues as unknown as { name: string } | null)?.name}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${estado.clases}`}
                  >
                    {estado.texto}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
