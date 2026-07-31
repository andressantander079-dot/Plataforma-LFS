"use client";

import { useState } from "react";
import { Trophy, Calendar as CalendarIcon, Filter, Layers, Zap, Clock, MapPin } from "lucide-react";

// Mock de Equipos y Partidos del Fixture
const MOCK_MATCHES = [
  {
    id: "m1",
    date: "2026-08-01T16:00:00Z",
    homeTeam: "Club Camioneros",
    awayTeam: "HAF Ushuaia",
    homeScore: null,
    awayScore: null,
    category: "Primera",
    gender: "Masculino",
    venue: "Gimnasio Cochocho Vargas",
    status: "Programado",
    matchday: 5,
  },
  {
    id: "m2",
    date: "2026-08-01T18:00:00Z",
    homeTeam: "Mercantil Ushuaia",
    awayTeam: "AEP Ushuaia",
    homeScore: null,
    awayScore: null,
    category: "Primera",
    gender: "Masculino",
    venue: "Gimnasio Cochocho Vargas",
    status: "Programado",
    matchday: 5,
  },
  {
    id: "m3",
    date: "2026-08-02T15:00:00Z",
    homeTeam: "Los Andes",
    awayTeam: "Arturo Pratt",
    homeScore: 3,
    awayScore: 2,
    category: "Sub-16",
    gender: "Masculino",
    venue: "Gimnasio CAMPOLTER",
    status: "Finalizado",
    matchday: 5,
  },
  {
    id: "m4",
    date: "2026-08-02T17:00:00Z",
    homeTeam: "Club Camioneros Fem",
    awayTeam: "Mercantil Fem",
    homeScore: 1,
    awayScore: 1,
    category: "Primera",
    gender: "Femenino",
    venue: "Gimnasio Cochocho Vargas",
    status: "Finalizado",
    matchday: 5,
  },
];

// Mock del Bracket de Playoffs
const PLAYOFF_BRACKET = {
  quarterFinals: [
    { id: "q1", home: "Camioneros", away: "Pratt", scoreHome: 5, scoreAway: 2, winner: "Camioneros" },
    { id: "q2", home: "HAF Ushuaia", away: "Los Andes", scoreHome: 4, scoreAway: 3, winner: "HAF Ushuaia" },
    { id: "q3", home: "Mercantil", away: "AEP", scoreHome: 2, scoreAway: 3, winner: "AEP" },
    { id: "q4", home: "Ushuaia FC", away: "Galicia", scoreHome: 6, scoreAway: 5, winner: "Ushuaia FC" },
  ],
  semiFinals: [
    { id: "s1", home: "Camioneros", away: "HAF Ushuaia", scoreHome: null, scoreAway: null, winner: null },
    { id: "s2", home: "AEP", away: "Ushuaia FC", scoreHome: null, scoreAway: null, winner: null },
  ],
  final: { home: "Ganador Semi 1", away: "Ganador Semi 2", scoreHome: null, scoreAway: null },
};

export default function FixturePage() {
  const [activeTab, setActiveTab] = useState<"regular" | "playoffs">("regular");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [genderFilter, setGenderFilter] = useState("Todos");

  const filteredMatches = MOCK_MATCHES.filter((match) => {
    const matchCat = categoryFilter === "Todas" || match.category === categoryFilter;
    const matchGen = genderFilter === "Todos" || match.gender === genderFilter;
    return matchCat && matchGen;
  });

  const categories = ["Todas", "Primera", "Sub-18", "Sub-16", "Sub-14"];
  const genders = ["Todos", "Masculino", "Femenino"];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Encabezado */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <CalendarIcon className="w-8 h-8 text-[#F97316]" />
            Fixture & Calendario
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Cronograma de partidos oficiales y llaves de campeonato de la liga LFS.
          </p>
        </div>

        {/* Tabs de Selección */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("regular")}
            className={`flex-1 md:flex-initial px-5 py-2 rounded-lg font-bold text-sm transition ${
              activeTab === "regular"
                ? "bg-white text-[#1A2A44] shadow"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Fase Regular
          </button>
          <button
            onClick={() => setActiveTab("playoffs")}
            className={`flex-1 md:flex-initial px-5 py-2 rounded-lg font-bold text-sm transition ${
              activeTab === "playoffs"
                ? "bg-white text-[#1A2A44] shadow"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Playoffs (Llaves)
          </button>
        </div>
      </section>

      {activeTab === "regular" ? (
        <>
          {/* Barra de Filtros */}
          <section className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 text-slate-400 self-start sm:self-center">
              <Filter className="w-4 h-4 text-[#F97316]" />
              <span className="text-xs font-bold uppercase tracking-wider">Filtrar:</span>
            </div>

            {/* Selector de Categoría */}
            <div className="w-full sm:w-auto flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Categoría</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Selector de Género */}
            <div className="w-full sm:w-auto flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider">Rama</label>
              <select
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              >
                {genders.map((gen) => (
                  <option key={gen} value={gen}>{gen}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Listado de Partidos */}
          <section className="flex flex-col gap-4">
            <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">
              Fecha 5 - Partidos Programados
            </h3>

            {filteredMatches.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500 text-sm">
                No hay partidos programados que coincidan con los filtros seleccionados.
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredMatches.map((match) => (
                  <div
                    key={match.id}
                    className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-sm hover:shadow transition duration-250"
                  >
                    <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-3 mb-4 text-xs font-semibold text-slate-450">
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                        {new Date(match.date).toLocaleDateString("es-AR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#1A2A44]/5 text-[#1A2A44] text-[10px] font-bold">
                        {match.category} • {match.gender}
                      </span>
                    </div>

                    {/* Fila Equipos y Resultados */}
                    <div className="flex justify-between items-center gap-4 py-2">
                      <div className="flex-1 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#1A2A44] text-base">{match.homeTeam}</span>
                          <span className="font-mono text-xl font-black text-[#1A2A44]">
                            {match.homeScore !== null ? match.homeScore : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#1A2A44] text-base">{match.awayTeam}</span>
                          <span className="font-mono text-xl font-black text-[#1A2A44]">
                            {match.awayScore !== null ? match.awayScore : "-"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ubicación / Cancha */}
                    <div className="flex justify-between items-center border-t border-slate-100 pt-3 mt-4 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-350" />
                        {match.venue}
                      </span>
                      <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        match.status === "Finalizado"
                          ? "bg-green-50 text-green-600 border border-green-100"
                          : "bg-orange-50 text-orange-600 border border-orange-100"
                      }`}>
                        {match.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        /* Playoffs Bracket */
        <section className="bg-white rounded-2xl border border-slate-200/80 p-6 overflow-x-auto shadow-sm">
          <div className="min-w-[800px] flex items-center justify-between gap-8 py-8 px-4">
            
            {/* Cuartos de Final */}
            <div className="flex flex-col gap-8 flex-1">
              <h4 className="font-sans text-xs font-black text-slate-400 uppercase text-center border-b pb-2 mb-2">
                Cuartos de Final
              </h4>
              {PLAYOFF_BRACKET.quarterFinals.map((match) => (
                <div key={match.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-inner flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className={match.winner === match.home ? "font-bold text-[#F97316]" : ""}>{match.home}</span>
                    <span className="font-mono font-bold">{match.scoreHome}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span className={match.winner === match.away ? "font-bold text-[#F97316]" : ""}>{match.away}</span>
                    <span className="font-mono font-bold">{match.scoreAway}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Conectores / Divisores */}
            <div className="text-slate-300 font-bold">➔</div>

            {/* Semifinales */}
            <div className="flex flex-col gap-16 flex-1">
              <h4 className="font-sans text-xs font-black text-slate-400 uppercase text-center border-b pb-2 mb-2">
                Semifinales
              </h4>
              {PLAYOFF_BRACKET.semiFinals.map((match) => (
                <div key={match.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-inner flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-650">
                    <span>{match.home}</span>
                    <span className="font-mono">-</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-650">
                    <span>{match.away}</span>
                    <span className="font-mono">-</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Conectores / Divisores */}
            <div className="text-slate-300 font-bold">➔</div>

            {/* Final */}
            <div className="flex flex-col gap-8 flex-1 justify-center">
              <h4 className="font-sans text-xs font-black text-slate-400 uppercase text-center border-b pb-2 mb-2">
                Gran Final LFS
              </h4>
              <div className="bg-gradient-to-br from-[#1A2A44] to-slate-900 text-white rounded-xl p-4 shadow-xl border border-slate-800 flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-slate-200">
                  <span>{PLAYOFF_BRACKET.final.home}</span>
                  <span>-</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-slate-200">
                  <span>{PLAYOFF_BRACKET.final.away}</span>
                  <span>-</span>
                </div>
                <div className="text-[10px] text-center text-[#F97316] font-bold uppercase tracking-wider border-t border-slate-800 pt-2 mt-1">
                  Copa de Campeones LFS
                </div>
              </div>
            </div>

          </div>
        </section>
      )}

    </div>
  );
}
