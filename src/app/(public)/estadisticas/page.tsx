import Link from "next/link";
import { BarChart3, Trophy, Medal, ShieldAlert, Ban } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * ESTADÍSTICAS PÚBLICAS — Paso 7B
 * Abierto a todo el mundo (sin login). Goleadores, disciplina y
 * suspensiones activas por torneo, calculadas en tiempo real desde
 * los eventos que carga el árbitro en la planilla digital.
 * Los datos salen de funciones seguras que exponen SOLO nombre y equipo.
 */

interface FilaGoleador {
  player_id: string;
  jugador: string;
  equipo: string;
  goles: number;
}

interface FilaDisciplina {
  player_id: string;
  jugador: string;
  equipo: string;
  amarillas: number;
  rojas: number;
}

interface FilaSuspension {
  player_id: string;
  jugador: string;
  equipo: string;
  motivo: string;
  partidos_pendientes: number;
}

export default async function EstadisticasPublico({
  searchParams,
}: {
  searchParams: Promise<{ torneo?: string }>;
}) {
  const { torneo: torneoParam } = await searchParams;
  const supabase = await createLfsServerClient();

  const { data: torneos } = await supabase
    .from("competitions")
    .select("id, name, season, status, yellow_cards_suspension, categories(name)")
    .order("created_at", { ascending: false });

  const seleccionado =
    (torneos ?? []).find((t) => t.id === torneoParam) ??
    (torneos ?? []).find((t) => t.status === "en_curso") ??
    (torneos ?? [])[0];

  let goleadores: FilaGoleador[] = [];
  let disciplina: FilaDisciplina[] = [];
  let suspensiones: FilaSuspension[] = [];

  if (seleccionado) {
    const [resGol, resDis, resSus] = await Promise.all([
      supabase.rpc("goleadores_publicos", { p_competition: seleccionado.id }),
      supabase.rpc("disciplina_publica", { p_competition: seleccionado.id }),
      supabase.rpc("suspensiones_publicas", { p_competition: seleccionado.id }),
    ]);
    goleadores = (resGol.data ?? []) as FilaGoleador[];
    disciplina = (resDis.data ?? []) as FilaDisciplina[];
    suspensiones = (resSus.data ?? []) as FilaSuspension[];
  }

  const medalla = (rank: number) =>
    rank === 1
      ? "text-yellow-500"
      : rank === 2
        ? "text-slate-400"
        : rank === 3
          ? "text-amber-700"
          : "text-slate-300";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="text-center flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center justify-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Estadísticas
        </h1>
        <p className="text-slate-500 text-sm">
          Goleadores y disciplina en tiempo real — Liga de Fútsal de Ushuaia
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
              href={`/estadisticas?torneo=${t.id}`}
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
            Cuando la federación publique el primer torneo, las estadísticas aparecen acá.
          </p>
        </div>
      )}

      {seleccionado && (
        <>
          {/* Goleadores */}
          <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
            <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
              <Medal className="w-4 h-4 text-[#F97316]" />
              Tabla de goleadores
            </h2>

            {goleadores.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">
                Todavía no se cargaron goles en este torneo. Aparecen solos cuando el
                árbitro los registra en la planilla.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="text-left py-2 pr-2 w-8">#</th>
                      <th className="text-left py-2">Jugador</th>
                      <th className="text-left py-2">Equipo</th>
                      <th className="text-right py-2 pl-2">Goles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goleadores.map((g, i) => (
                      <tr
                        key={`${g.player_id}-${g.equipo}`}
                        className={`border-b border-slate-50 ${i < 3 ? "bg-orange-50/40" : ""}`}
                      >
                        <td className="py-2 pr-2">
                          <span className={`font-black ${medalla(i + 1)}`}>{i + 1}</span>
                        </td>
                        <td className="py-2 font-bold text-[#1A2A44]">{g.jugador}</td>
                        <td className="py-2 text-slate-500 text-xs">{g.equipo}</td>
                        <td className="py-2 pl-2 text-right">
                          <span className="inline-block min-w-7 text-center font-black text-[#F97316] bg-orange-50 rounded-lg px-2 py-0.5">
                            {g.goles}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Disciplina */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#F97316]" />
                Tarjetas
              </h2>
              <p className="text-[10px] text-slate-400 -mt-2">
                Con {seleccionado.yellow_cards_suspension} amarillas el jugador se
                pierde 1 fecha · la roja directa también suspende.
              </p>

              {disciplina.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  Sin tarjetas cargadas en este torneo.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="text-left py-2">Jugador</th>
                      <th className="text-center py-2 w-12">
                        <span className="inline-block w-3 h-4 bg-yellow-400 rounded-[2px] align-middle" />
                      </th>
                      <th className="text-center py-2 w-12">
                        <span className="inline-block w-3 h-4 bg-red-600 rounded-[2px] align-middle" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {disciplina.map((d) => (
                      <tr key={`${d.player_id}-${d.equipo}`} className="border-b border-slate-50">
                        <td className="py-2">
                          <p className="font-bold text-[#1A2A44] leading-tight">{d.jugador}</p>
                          <p className="text-[10px] text-slate-400">{d.equipo}</p>
                        </td>
                        <td className="py-2 text-center font-black text-yellow-600">
                          {d.amarillas > 0 ? d.amarillas : "—"}
                        </td>
                        <td className="py-2 text-center font-black text-red-700">
                          {d.rojas > 0 ? d.rojas : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            {/* Suspensiones activas */}
            <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-600" />
                Suspensiones activas
              </h2>
              <p className="text-[10px] text-slate-400 -mt-2">
                No pueden ser convocados hasta cumplir las fechas.
              </p>

              {suspensiones.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No hay jugadores suspendidos en este torneo.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {suspensiones.map((s, i) => (
                    <li
                      key={`${s.player_id}-${i}`}
                      className="border border-red-100 bg-red-50/50 rounded-xl px-3 py-2 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#1A2A44] text-sm truncate">{s.jugador}</p>
                        <p className="text-[10px] text-slate-500">
                          {s.equipo} ·{" "}
                          {s.motivo === "roja" ? "Tarjeta roja" : "Acumulación de amarillas"}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] font-black text-red-700 bg-red-100 rounded-full px-2.5 py-1">
                        {s.partidos_pendientes} fecha{s.partidos_pendientes > 1 ? "s" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="text-[10px] text-slate-400 text-center">
            Se actualiza sola con cada evento que el árbitro carga en la planilla digital.
          </p>
        </>
      )}
    </div>
  );
}
