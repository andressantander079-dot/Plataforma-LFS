import Link from "next/link";
import { Calendar, MapPin, Trophy } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * FIXTURE PÚBLICO
 * Abierto a todo el mundo (sin login). Selector de torneo y
 * partidos agrupados por fecha, con resultados confirmados.
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

export default async function FixturePublico({
  searchParams,
}: {
  searchParams: Promise<{ torneo?: string }>;
}) {
  const { torneo: torneoParam } = await searchParams;
  const supabase = await createLfsServerClient();

  const { data: torneos } = await supabase
    .from("competitions")
    .select("id, name, season, status, categories(name)")
    .order("created_at", { ascending: false });

  const seleccionado =
    (torneos ?? []).find((t) => t.id === torneoParam) ??
    (torneos ?? []).find((t) => t.status === "en_curso") ??
    (torneos ?? [])[0];

  interface PartidoPublico {
    id: string;
    matchday: number | null;
    homeNombre: string;
    awayNombre: string;
    home_score: number | null;
    away_score: number | null;
    scheduled_at: string | null;
    status: string;
    venueNombre: string | null;
  }

  let grupos: [string, PartidoPublico[]][] = [];

  if (seleccionado) {

    const { data: insc } = await supabase
      .from("competition_teams")
      .select("team_id, teams(name)")
      .eq("competition_id", seleccionado.id);
    const nombreEquipo = new Map(
      (insc ?? []).map((i) => [
        i.team_id,
        (i.teams as unknown as { name: string } | null)?.name ?? "—",
      ])
    );

    const { data: matches } = await supabase
      .from("matches")
      .select("*, venues(name)")
      .eq("competition_id", seleccionado.id)
      .order("matchday", { ascending: true, nullsFirst: false })
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    const partidos: PartidoPublico[] = (matches ?? []).map((p) => ({
      id: p.id,
      matchday: p.matchday,
      homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
      awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
      home_score: p.home_score,
      away_score: p.away_score,
      scheduled_at: p.scheduled_at,
      status: p.status,
      venueNombre: (p.venues as unknown as { name: string } | null)?.name ?? null,
    }));

    const mapa = new Map<string, PartidoPublico[]>();
    for (const p of partidos) {
      const clave = p.matchday !== null ? `Fecha ${p.matchday}` : "Sin fecha asignada";
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(p);
    }
    grupos = Array.from(mapa.entries()).sort((a, b) => {
      const n = (s: string) => (s.startsWith("Fecha") ? Number(s.split(" ")[1]) : 9999);
      return n(a[0]) - n(b[0]);
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="text-center flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center justify-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Fixture
        </h1>
        <p className="text-slate-500 text-sm">
          Calendario oficial de partidos — Liga de Fútsal de Ushuaia
        </p>
      </div>

      {/* Selector de torneo */}
      <div className="flex flex-wrap justify-center gap-2">
        {(torneos ?? []).map((t) => {
          const activo = seleccionado?.id === t.id;
          const categoria = (t.categories as unknown as { name: string } | null)?.name;
          return (
            <Link
              key={t.id}
              href={`/fixture?torneo=${t.id}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                activo
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#F97316]"
              }`}
            >
              {t.name} {categoria ? `· ${categoria}` : ""}
            </Link>
          );
        })}
      </div>

      {(torneos ?? []).length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <Trophy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-serif text-lg font-bold text-[#1A2A44]">
            La temporada todavía no comenzó
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cuando la federación publique el primer torneo, el fixture aparece acá.
          </p>
        </div>
      )}

      {seleccionado && grupos.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-8">
          Este torneo todavía no tiene fixture generado.
        </p>
      )}

      {grupos.map(([fecha, lista]) => (
        <section key={fecha} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <p className="px-4 py-2.5 bg-[#1A2A44] text-white font-bold text-xs uppercase tracking-wider">
            {fecha}
          </p>
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => (
              <li key={p.id} className="px-4 py-3 flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex-1 text-right font-bold text-[#1A2A44] truncate">
                    {p.homeNombre}
                  </span>
                  {p.home_score !== null && p.away_score !== null ? (
                    <span className="shrink-0 font-black bg-slate-100 rounded-lg px-3 py-0.5 text-[#1A2A44]">
                      {p.home_score} - {p.away_score}
                    </span>
                  ) : (
                    <span className="shrink-0 text-slate-400 font-bold text-xs px-2">VS</span>
                  )}
                  <span className="flex-1 font-bold text-[#1A2A44] truncate">{p.awayNombre}</span>
                  {p.status === "suspendido" && (
                    <span className="shrink-0 text-[9px] font-bold uppercase bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                      Suspendido
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 flex flex-wrap justify-center gap-x-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {fechaLinda(p.scheduled_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {p.venueNombre ?? "A definir"}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
