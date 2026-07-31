"use client";

import { useState } from "react";
import { BarChart3, Medal, Users, ShieldAlert, Award, Star } from "lucide-react";

// Mock de Jugadores Goleadores
const TOP_GOLEADORES = [
  { rank: 1, name: "Lucas 'Pachu' Aravena", team: "Club Camioneros", goals: 14, matches: 8, avg: 1.75 },
  { rank: 2, name: "Maximiliano Toro", team: "HAF Ushuaia", goals: 11, matches: 7, avg: 1.57 },
  { rank: 3, name: "Andrés 'Kiki' Pérez", team: "Mercantil Ushuaia", goals: 9, matches: 8, avg: 1.13 },
  { rank: 4, name: "Federico González", team: "Los Andes", goals: 8, matches: 7, avg: 1.14 },
  { rank: 5, name: "Agustín Vargas", team: "Arturo Pratt", goals: 7, matches: 8, avg: 0.88 },
  { rank: 6, name: "Gabriel Romero", team: "AEP Ushuaia", goals: 6, matches: 6, avg: 1.00 },
  { rank: 7, name: "Matías Silva", team: "Ushuaia FC", goals: 6, matches: 7, avg: 0.86 },
  { rank: 8, name: "Bautista Roldán", team: "Club Camioneros", goals: 5, matches: 8, avg: 0.63 },
];

// Mock de Vallas Menos Vencidas (Equipos Menos Goleados)
const TOP_DEFENSAS = [
  { rank: 1, team: "HAF Ushuaia", keeper: "Mariano Ortiz", goalsConceded: 12, matches: 8, avg: 1.50 },
  { rank: 2, team: "Club Camioneros", keeper: "Ezequiel Vidal", goalsConceded: 15, matches: 8, avg: 1.88 },
  { rank: 3, team: "Mercantil Ushuaia", keeper: "Sebastián Milla", goalsConceded: 18, matches: 8, avg: 2.25 },
  { rank: 4, team: "AEP Ushuaia", keeper: "Nicolás Basso", goalsConceded: 22, matches: 8, avg: 2.75 },
];

// Mock de Tarjetas (3 contadores independientes)
const TOP_DISCIPLINA = [
  { rank: 1, name: "Santiago Rossi", team: "Los Andes", yellow: 5, doubleYellow: 1, directRed: 0 },
  { rank: 2, name: "Cristian Oyarzún", team: "Arturo Pratt", yellow: 4, doubleYellow: 0, directRed: 1 },
  { rank: 3, name: "Franco Valdéz", team: "Ushuaia FC", yellow: 3, doubleYellow: 1, directRed: 0 },
  { rank: 4, name: "Leandro Ledesma", team: "AEP Ushuaia", yellow: 3, doubleYellow: 0, directRed: 1 },
  { rank: 5, name: "Tomás Rivas", team: "Galicia", yellow: 4, doubleYellow: 0, directRed: 0 },
  { rank: 6, name: "Ignacio Pérez", team: "Mercantil Ushuaia", yellow: 3, doubleYellow: 0, directRed: 0 },
];

export default function EstadisticasPage() {
  const [activeCategory, setActiveCategory] = useState("Primera");

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Encabezado */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-[#F97316]" />
            Estadísticas y Rankings
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Tablas de rendimiento individual y disciplina de la liga LFS.
          </p>
        </div>

        {/* Filtro rápido de categoría */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
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

      {/* Grid de Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Top 8 Goleadores */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Award className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Goleadores (Top 8)</h3>
              <p className="text-xs text-slate-400">Ordenado por goles y promedio de efectividad</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 text-left">
                  <th className="py-2 px-3">Pos</th>
                  <th className="py-2 px-3">Jugador</th>
                  <th className="py-2 px-3">Club</th>
                  <th className="py-2 px-3 text-center">PJ</th>
                  <th className="py-2 px-3 text-center">Prom</th>
                  <th className="py-2 px-3 text-center text-[#F97316]">Goles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TOP_GOLEADORES.map((player) => (
                  <tr key={player.rank} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">
                      {player.rank === 1 ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-yellow-100 text-yellow-800 text-[10px]">🥇</span>
                      ) : player.rank === 2 ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-slate-100 text-slate-800 text-[10px]">🥈</span>
                      ) : player.rank === 3 ? (
                        <span className="inline-flex w-5 h-5 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-[10px]">🥉</span>
                      ) : (
                        player.rank
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#1A2A44]">{player.name}</td>
                    <td className="py-3 px-3 text-slate-500 font-medium">{player.team}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{player.matches}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{player.avg.toFixed(2)}</td>
                    <td className="py-3 px-3 text-center font-mono font-black text-lg text-[#F97316]">{player.goals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Valla Menos Vencida (Equipos Menos Goleados) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Users className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Valla Menos Vencida</h3>
              <p className="text-xs text-slate-400">Equipos defensivos y arqueros titulares destacados</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 text-left">
                  <th className="py-2 px-3">Pos</th>
                  <th className="py-2 px-3">Arquero / Club</th>
                  <th className="py-2 px-3 text-center">PJ</th>
                  <th className="py-2 px-3 text-center">G/P</th>
                  <th className="py-2 px-3 text-center text-blue-650">Goles Rec.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TOP_DEFENSAS.map((def) => (
                  <tr key={def.rank} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-3 font-mono font-bold text-slate-400">#{def.rank}</td>
                    <td className="py-3 px-3">
                      <span className="block font-semibold text-[#1A2A44]">{def.keeper}</span>
                      <span className="block text-xs text-slate-400">{def.team}</span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{def.matches}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-500">{def.avg.toFixed(2)}</td>
                    <td className="py-3 px-3 text-center font-mono font-black text-lg text-blue-600">{def.goalsConceded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tabla de Disciplina (Tres Contadores Independientes de Tarjetas) */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col gap-4 lg:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-red-50 text-red-650 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Tabla de Disciplina (Tarjetas)</h3>
              <p className="text-xs text-slate-400">
                Control de amonestaciones y expulsiones. Tres contadores independientes obligatorios según reglamento LFS.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-100 text-left">
                  <th className="py-2 px-3">Rank</th>
                  <th className="py-2 px-3">Jugador / Equipo</th>
                  <th className="py-2 px-3 text-center">
                    <span className="inline-block w-3.5 h-5 bg-yellow-400 rounded-sm border border-yellow-500 shadow-sm" title="Tarjeta Amarilla" />
                    <span className="block text-[8px] mt-1 font-bold">Amarillas</span>
                  </th>
                  <th className="py-2 px-3 text-center">
                    <span className="inline-flex gap-0.5 justify-center items-center" title="Doble Amarilla / Expulsión">
                      <span className="w-2.5 h-4 bg-yellow-400 rounded-sm" />
                      <span className="w-2.5 h-4 bg-yellow-400 rounded-sm" />
                    </span>
                    <span className="block text-[8px] mt-1 font-bold">Doble Am.</span>
                  </th>
                  <th className="py-2 px-3 text-center">
                    <span className="inline-block w-3.5 h-5 bg-red-500 rounded-sm border border-red-650 shadow-sm" title="Roja Directa" />
                    <span className="block text-[8px] mt-1 font-bold">Roja Dir.</span>
                  </th>
                  <th className="py-2 px-3 text-center text-slate-800 font-bold">Puntos Susp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {TOP_DISCIPLINA.map((p) => {
                  // Calcular peso disciplinario acumulado: amarilla = 1pt, doble amarilla = 3pt, roja directa = 5pt
                  const points = p.yellow * 1 + p.doubleYellow * 3 + p.directRed * 5;
                  return (
                    <tr key={p.rank} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 px-3 font-mono font-bold text-slate-400">#{p.rank}</td>
                      <td className="py-3 px-3">
                        <span className="block font-semibold text-[#1A2A44]">{p.name}</span>
                        <span className="block text-xs text-slate-450">{p.team}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-yellow-600 bg-yellow-50/30">{p.yellow}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-orange-600 bg-orange-50/30">{p.doubleYellow}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-red-650 bg-red-50/30">{p.directRed}</td>
                      <td className="py-3 px-3 text-center font-mono font-black text-base text-slate-800">{points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

      </div>

    </div>
  );
}
