import { GitBranch, Trophy } from "lucide-react";
import { NOMBRE_ETAPA, ORDEN_ETAPA, type Etapa } from "@/lib/core/competencias/playoff";

/**
 * LLAVES DE PLAYOFF (solo lectura)
 * Muestra las rondas de playoff ordenadas (cuartos → semis → final),
 * con el marcador y el ganador resaltado. La usa el admin y la web pública.
 */

export interface PartidoLlave {
  id: string;
  stage: Etapa;
  stage_order: number | null;
  homeNombre: string;
  awayNombre: string;
  home_score: number | null;
  away_score: number | null;
  result_confirmed: boolean;
}

function ganadorDel(p: PartidoLlave): "home" | "away" | null {
  if (!p.result_confirmed || p.home_score === null || p.away_score === null) return null;
  if (p.home_score > p.away_score) return "home";
  if (p.away_score > p.home_score) return "away";
  return null;
}

export function LlavesPlayoff({ partidos }: { partidos: PartidoLlave[] }) {
  if (partidos.length === 0) return null;

  const porEtapa = new Map<Etapa, PartidoLlave[]>();
  for (const p of partidos) {
    if (!porEtapa.has(p.stage)) porEtapa.set(p.stage, []);
    porEtapa.get(p.stage)!.push(p);
  }
  const etapas: [Etapa, PartidoLlave[]][] = Array.from(porEtapa.entries())
    .sort((a, b) => ORDEN_ETAPA[a[0]] - ORDEN_ETAPA[b[0]])
    .map(([etapa, lista]) => [
      etapa,
      [...lista].sort((a, b) => (a.stage_order ?? 0) - (b.stage_order ?? 0)),
    ]);

  return (
    <div className="flex flex-col gap-4">
      {etapas.map(([etapa, lista]) => (
        <section
          key={etapa}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
        >
          <p className="px-4 py-2.5 bg-[#1A2A44] text-white font-bold text-xs uppercase tracking-wider flex items-center gap-2">
            {etapa === "final" ? (
              <Trophy className="w-3.5 h-3.5 text-[#F97316]" />
            ) : (
              <GitBranch className="w-3.5 h-3.5 text-[#F97316]" />
            )}
            {NOMBRE_ETAPA[etapa]}
          </p>
          <ul className="divide-y divide-slate-100">
            {lista.map((p) => {
              const ganador = ganadorDel(p);
              return (
                <li key={p.id} className="px-4 py-3 flex items-center gap-2 text-sm">
                  <span
                    className={`flex-1 text-right truncate ${
                      ganador === "home"
                        ? "font-black text-[#1A2A44]"
                        : ganador === "away"
                          ? "text-slate-400"
                          : "font-bold text-[#1A2A44]"
                    }`}
                  >
                    {p.homeNombre}
                    {ganador === "home" && (
                      <Trophy className="inline w-3.5 h-3.5 ml-1 text-[#F97316]" />
                    )}
                  </span>
                  {p.home_score !== null && p.away_score !== null ? (
                    <span className="shrink-0 font-black bg-slate-100 rounded-lg px-3 py-0.5 text-[#1A2A44]">
                      {p.home_score} - {p.away_score}
                    </span>
                  ) : (
                    <span className="shrink-0 text-slate-400 font-bold text-xs px-2">VS</span>
                  )}
                  <span
                    className={`flex-1 truncate ${
                      ganador === "away"
                        ? "font-black text-[#1A2A44]"
                        : ganador === "home"
                          ? "text-slate-400"
                          : "font-bold text-[#1A2A44]"
                    }`}
                  >
                    {ganador === "away" && (
                      <Trophy className="inline w-3.5 h-3.5 mr-1 text-[#F97316]" />
                    )}
                    {p.awayNombre}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
