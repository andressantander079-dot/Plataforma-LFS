"use client";

import { useState } from "react";
import { ListOrdered, Trophy, Calendar, ChevronRight, TrendingUp } from "lucide-react";
import { calculatePoints } from "../../../lib/core/calculators/pointsCalculator";

// Mock de Equipos con sus Estadísticas acumuladas por Fecha
interface HistoricalData {
  [matchday: number]: Array<{
    team: string;
    won: number;
    drawn: number;
    lost: number;
    gf: number;
    gc: number;
  }>;
}

const HISTORICAL_POSITIONS: HistoricalData = {
  5: [
    { team: "Club Camioneros", won: 4, drawn: 1, lost: 0, gf: 18, gc: 8 },
    { team: "HAF Ushuaia", won: 4, drawn: 0, lost: 1, gf: 15, gc: 7 },
    { team: "Mercantil Ushuaia", won: 3, drawn: 1, lost: 1, gf: 14, gc: 10 },
    { team: "Ushuaia FC", won: 2, drawn: 1, lost: 2, gf: 11, gc: 12 },
    { team: "AEP Ushuaia", won: 2, drawn: 0, lost: 3, gf: 10, gc: 14 },
    { team: "Los Andes", won: 1, drawn: 1, lost: 3, gf: 9, gc: 13 },
    { team: "Arturo Pratt", won: 1, drawn: 0, lost: 4, gf: 7, gc: 15 },
    { team: "Galicia", won: 0, drawn: 2, lost: 3, gf: 5, gc: 11 },
  ],
  4: [
    { team: "Club Camioneros", won: 3, drawn: 1, lost: 0, gf: 14, gc: 6 },
    { team: "HAF Ushuaia", won: 3, drawn: 0, lost: 1, gf: 11, gc: 6 },
    { team: "Mercantil Ushuaia", won: 2, drawn: 1, lost: 1, gf: 10, gc: 8 },
    { team: "Ushuaia FC", won: 2, drawn: 0, lost: 2, gf: 9, gc: 10 },
    { team: "AEP Ushuaia", won: 2, drawn: 0, lost: 2, gf: 9, gc: 10 },
    { team: "Los Andes", won: 1, drawn: 1, lost: 2, gf: 8, gc: 10 },
    { team: "Arturo Pratt", won: 1, drawn: 0, lost: 3, gf: 6, gc: 12 },
    { team: "Galicia", won: 0, drawn: 1, lost: 3, gf: 4, gc: 10 },
  ],
  3: [
    { team: "HAF Ushuaia", won: 3, drawn: 0, lost: 0, gf: 9, gc: 4 },
    { team: "Club Camioneros", won: 2, drawn: 1, lost: 0, gf: 10, gc: 4 },
    { team: "Mercantil Ushuaia", won: 1, drawn: 1, lost: 1, gf: 7, gc: 6 },
    { team: "AEP Ushuaia", won: 1, drawn: 0, lost: 2, gf: 6, gc: 8 },
    { team: "Ushuaia FC", won: 1, drawn: 0, lost: 2, gf: 5, gc: 8 },
    { team: "Los Andes", won: 0, drawn: 1, lost: 2, gf: 5, gc: 8 },
    { team: "Arturo Pratt", won: 1, drawn: 0, lost: 2, gf: 4, gc: 8 },
    { team: "Galicia", won: 0, drawn: 1, lost: 2, gf: 3, gc: 7 },
  ],
  2: [
    { team: "HAF Ushuaia", won: 2, drawn: 0, lost: 0, gf: 6, gc: 2 },
    { team: "Club Camioneros", won: 1, drawn: 1, lost: 0, gf: 6, gc: 3 },
    { team: "Mercantil Ushuaia", won: 1, drawn: 1, lost: 0, gf: 5, gc: 3 },
    { team: "AEP Ushuaia", won: 1, drawn: 0, lost: 1, gf: 4, gc: 4 },
    { team: "Ushuaia FC", won: 1, drawn: 0, lost: 1, gf: 4, gc: 4 },
    { team: "Arturo Pratt", won: 1, drawn: 0, lost: 1, gf: 3, gc: 4 },
    { team: "Los Andes", won: 0, drawn: 1, lost: 1, gf: 3, gc: 5 },
    { team: "Galicia", won: 0, drawn: 1, lost: 1, gf: 2, gc: 4 },
  ],
  1: [
    { team: "HAF Ushuaia", won: 1, drawn: 0, lost: 0, gf: 3, gc: 1 },
    { team: "Club Camioneros", won: 1, drawn: 0, lost: 0, gf: 3, gc: 1 },
    { team: "Mercantil Ushuaia", won: 1, drawn: 0, lost: 0, gf: 2, gc: 1 },
    { team: "Arturo Pratt", won: 1, drawn: 0, lost: 0, gf: 2, gc: 1 },
    { team: "Galicia", won: 0, drawn: 1, lost: 0, gf: 1, gc: 1 },
    { team: "Los Andes", won: 0, drawn: 1, lost: 0, gf: 1, gc: 1 },
    { team: "AEP Ushuaia", won: 0, drawn: 0, lost: 1, gf: 1, gc: 2 },
    { team: "Ushuaia FC", won: 0, drawn: 0, lost: 1, gf: 1, gc: 3 },
  ],
};

export default function PosicionesPage() {
  const [selectedMatchday, setSelectedMatchday] = useState<number>(5);
  const [activeCategory, setActiveCategory] = useState<string>("Primera");

  const matchdays = [5, 4, 3, 2, 1];

  // Obtener y mapear los datos calculando los puntos dinámicamente con la función pura
  const rawData = HISTORICAL_POSITIONS[selectedMatchday] || [];
  const processedTable = rawData
    .map((teamData) => {
      const pts = calculatePoints({ won: teamData.won, drawn: teamData.drawn, lost: teamData.lost });
      const pj = teamData.won + teamData.drawn + teamData.lost;
      const dif = teamData.gf - teamData.gc;
      return {
        ...teamData,
        pts,
        pj,
        dif,
      };
    })
    // Criterios de Desempate: 1. Puntos (desc) -> 2. Diferencia de Goles (desc) -> 3. Goles a Favor (desc)
    .sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.dif !== a.dif) return b.dif - a.dif;
      return b.gf - a.gf;
    });

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Encabezado */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <ListOrdered className="w-8 h-8 text-[#F97316]" />
            Tabla de Posiciones
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Estadísticas de la fase regular y clasificaciones oficiales de la liga LFS.
          </p>
        </div>

        {/* Filtro rápido de categoría */}
        <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-2">
          {["Primera", "Sub-18", "Sub-16"].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-1.5 rounded-lg font-bold text-xs transition ${
                activeCategory === cat
                  ? "bg-[#1A2A44] text-white shadow"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Línea de Tiempo Histórica (Timeline Slider) */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h4 className="font-sans text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#F97316]" />
          Ver Histórico por Fecha:
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          {matchdays.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedMatchday(day)}
              className={`px-4 py-2 rounded-xl font-bold text-xs border transition ${
                selectedMatchday === day
                  ? "bg-[#F97316] text-white border-[#F97316] shadow-md shadow-[#F97316]/15"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              Fecha {day}
              {day === 5 && <span className="ml-1 text-[8px] bg-white/25 px-1 py-0.5 rounded text-white">Actual</span>}
            </button>
          ))}
        </div>
      </section>

      {/* Tabla Principal */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-150 text-left">
              <th className="py-3 px-3 text-center">Pos</th>
              <th className="py-3 px-3">Club</th>
              <th className="py-3 px-3 text-center">PJ</th>
              <th className="py-3 px-3 text-center">PG</th>
              <th className="py-3 px-3 text-center">PE</th>
              <th className="py-3 px-3 text-center">PP</th>
              <th className="py-3 px-3 text-center">GF</th>
              <th className="py-3 px-3 text-center">GC</th>
              <th className="py-3 px-3 text-center">DIF</th>
              <th className="py-3 px-3 text-center text-[#1A2A44] font-black bg-slate-50/50">PTS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {processedTable.map((row, index) => {
              const pos = index + 1;
              // Primeros 4 clasifican a Playoffs
              const isPlayoffZone = pos <= 4;
              return (
                <tr key={row.team} className="hover:bg-slate-50/45 transition">
                  <td className="py-3.5 px-3 text-center font-mono font-bold">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs ${
                      isPlayoffZone
                        ? "bg-green-50 text-green-700 border border-green-150"
                        : "text-slate-400"
                    }`}>
                      {pos}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 font-bold text-[#1A2A44] text-base">
                    {row.team}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-500 font-medium">{row.pj}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-500">{row.won}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-500">{row.drawn}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-500">{row.lost}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-400">{row.gf}</td>
                  <td className="py-3.5 px-3 text-center font-mono text-slate-400">{row.gc}</td>
                  <td className={`py-3.5 px-3 text-center font-mono font-bold ${
                    row.dif > 0 ? "text-green-600" : row.dif < 0 ? "text-red-500" : "text-slate-450"
                  }`}>
                    {row.dif > 0 ? `+${row.dif}` : row.dif}
                  </td>
                  <td className="py-3.5 px-3 text-center font-mono font-black text-lg text-[#1A2A44] bg-slate-50/45">
                    {row.pts}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Leyenda aclaratoria */}
        <div className="flex items-center gap-4 mt-6 pt-4 border-t border-slate-100 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-green-50 border border-green-150 inline-block" />
            <span>Zona de Clasificación a Playoffs (Top 4)</span>
          </div>
          <div>•</div>
          <p>Sistema de puntuación: Victoria (3 pts), Empate (1 pt), Derrota (0 pts).</p>
        </div>
      </section>

    </div>
  );
}
