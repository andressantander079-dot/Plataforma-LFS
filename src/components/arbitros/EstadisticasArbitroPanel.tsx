"use client";

import { Award, Flag, SquareChartGantt, TriangleAlert } from "lucide-react";
import type { EstadisticasArbitro } from "@/lib/core/rules/arbitrosRules";
import type { StatsPorTorneoUI } from "@/lib/actions/arbitros.actions";

/**
 * ESTADÍSTICAS DEL ÁRBITRO — calculadas de sus partidos y planillas reales:
 * totales arriba, desglose por torneo abajo.
 */
export function EstadisticasArbitroPanel({
  total,
  porTorneo,
}: {
  total: EstadisticasArbitro;
  porTorneo: StatsPorTorneoUI[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Totales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi
          icono={<SquareChartGantt className="w-4 h-4" />}
          valor={String(total.dirigidos)}
          label="Partidos dirigidos"
          color="text-[#1A2A44]"
        />
        <Kpi
          icono={<Award className="w-4 h-4" />}
          valor={String(total.golesPromedio)}
          label="Goles por partido"
          color="text-emerald-600"
        />
        <Kpi
          icono={<Flag className="w-4 h-4" />}
          valor={String(total.amarillasPromedio)}
          label="Amarillas por partido"
          color="text-amber-500"
        />
        <Kpi
          icono={<TriangleAlert className="w-4 h-4" />}
          valor={String(total.rojasTotal)}
          label="Rojas totales"
          color="text-red-600"
        />
      </div>

      {total.dirigidos === 0 && (
        <p className="text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 text-center">
          Todavía no dirigiste partidos finalizados. Cuando cargues planillas, tus números aparecen acá.
        </p>
      )}

      {/* Por torneo */}
      {porTorneo.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Torneo</th>
                <th className="px-4 py-3 text-center">Partidos</th>
                <th className="px-4 py-3 text-center">Goles/p</th>
                <th className="px-4 py-3 text-center">Amarillas/p</th>
                <th className="px-4 py-3 text-center">Rojas</th>
                <th className="px-4 py-3 text-center">W.O.</th>
              </tr>
            </thead>
            <tbody>
              {porTorneo.map((t) => (
                <tr key={t.torneoId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-bold text-xs text-[#1A2A44]">{t.torneoNombre}</td>
                  <td className="px-4 py-3 text-center font-black text-xs">{t.stats.dirigidos}</td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-emerald-700">
                    {t.stats.golesPromedio}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-amber-600">
                    {t.stats.amarillasPromedio}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-semibold text-red-600">
                    {t.stats.rojasTotal}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">{t.stats.wo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400 px-1">
        Los promedios se calculan sobre partidos <strong>jugados</strong>; los W.O. cuentan como
        partido dirigido pero sin goles.
      </p>
    </div>
  );
}

function Kpi({
  icono,
  valor,
  label,
  color,
}: {
  icono: React.ReactNode;
  valor: string;
  label: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5">
      <span className={`${color} opacity-70`}>{icono}</span>
      <p className={`font-serif text-2xl font-black ${color}`}>{valor}</p>
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
    </div>
  );
}
