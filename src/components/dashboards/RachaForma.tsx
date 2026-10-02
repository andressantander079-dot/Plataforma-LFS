import type { ResultadoRacha } from "@/lib/core/rules/dashboardRules";

/**
 * RACHA DE FORMA — Círculos W (ganó) / D (empató) / L (perdió)
 * de los últimos 5 partidos, del más viejo (izquierda) al más
 * reciente (derecha). El estándar de las apps deportivas.
 */

const ESTILO: Record<ResultadoRacha, { clase: string; letra: string; titulo: string }> = {
  W: { clase: "bg-green-500 text-white", letra: "G", titulo: "Ganado" },
  D: { clase: "bg-slate-300 text-slate-700", letra: "E", titulo: "Empatado" },
  L: { clase: "bg-red-500 text-white", letra: "P", titulo: "Perdido" },
};

export function RachaForma({ racha, equipo }: { racha: ResultadoRacha[]; equipo: string }) {
  if (racha.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-xs font-bold text-[#1A2A44] truncate flex-1">{equipo}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {racha.map((r, i) => (
          <span
            key={i}
            title={ESTILO[r].titulo}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${ESTILO[r].clase} ${i === racha.length - 1 ? "ring-2 ring-offset-1 ring-[#F97316]/50" : ""}`}
          >
            {ESTILO[r].letra}
          </span>
        ))}
      </div>
    </div>
  );
}
