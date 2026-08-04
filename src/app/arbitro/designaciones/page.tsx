import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { DesignacionArbitro, type DesignacionUI } from "@/components/competencias/DesignacionArbitro";

/**
 * DESIGNACIONES DEL ÁRBITRO
 * Sus partidos asignados por la federación, con carga de resultado.
 * El resultado queda pendiente hasta la confirmación de la federación.
 */
export default async function Designaciones() {
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

  const designaciones: DesignacionUI[] = (partidos ?? []).map((p) => ({
    id: p.id,
    torneoNombre: (p.competitions as unknown as { name: string } | null)?.name ?? "Torneo",
    homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
    awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
    scheduled_at: p.scheduled_at,
    venueNombre: (p.venues as unknown as { name: string } | null)?.name ?? null,
    matchday: p.matchday,
    status: p.status,
    home_score: p.home_score,
    away_score: p.away_score,
    result_confirmed: p.result_confirmed,
  }));

  const pendientes = designaciones.filter((d) => d.status === "programado");
  const cargados = designaciones.filter(
    (d) => (d.status === "jugado" || d.status === "wo") && !d.result_confirmed
  );
  const confirmados = designaciones.filter((d) => d.result_confirmed);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-[#F97316]" />
          Mis Designaciones
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Partidos que te asignó la federación. Cargá el resultado al finalizar.
        </p>
      </div>

      {designaciones.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <p className="font-serif text-lg font-bold text-[#1A2A44]">Sin designaciones</p>
          <p className="text-xs text-slate-500 mt-1">
            Cuando la federación te asigne un partido, va a aparecer acá.
          </p>
        </div>
      )}

      {pendientes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-sm font-black text-[#1A2A44] uppercase tracking-wider">
            Por dirigir ({pendientes.length})
          </h2>
          {pendientes.map((d) => (
            <DesignacionArbitro key={d.id} partido={d} />
          ))}
        </section>
      )}

      {cargados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-sm font-black text-[#1A2A44] uppercase tracking-wider">
            Esperando confirmación ({cargados.length})
          </h2>
          {cargados.map((d) => (
            <DesignacionArbitro key={d.id} partido={d} />
          ))}
        </section>
      )}

      {confirmados.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-serif text-sm font-black text-[#1A2A44] uppercase tracking-wider">
            Confirmados ({confirmados.length})
          </h2>
          {confirmados.map((d) => (
            <DesignacionArbitro key={d.id} partido={d} />
          ))}
        </section>
      )}
    </div>
  );
}
