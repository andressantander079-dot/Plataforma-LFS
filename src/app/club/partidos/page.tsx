"use client";

import { Calendar, Eye } from "lucide-react";

const MOCK_PARTIDOS_CLUB = [
  { id: "p1", category: "Primera Division", opponent: "HAF Ushuaia", date: "Sábado 1 de Agosto - 16:00", venue: "Cochocho Vargas", role: "Local" },
  { id: "p3", category: "Sub-18", opponent: "Club Galicia", date: "Sábado 1 de Agosto - 19:30", venue: "Cochocho Vargas", role: "Visitante" },
];

export default function ClubPartidos() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Partidos Programados
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Calendario de encuentros y planillas oficiales de tu club.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_PARTIDOS_CLUB.map((p) => (
          <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md transition">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-250">{p.category}</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                  p.role === "Local" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-650"
                }`}>{p.role}</span>
              </div>
              <h4 className="font-serif text-base font-bold text-[#1A2A44]">vs {p.opponent}</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-1">Estadio: {p.venue} • {p.date} hs</p>
            </div>
            <button className="mt-4 px-3 py-2 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] text-slate-700 transition flex items-center justify-center gap-1.5 w-full">
              <Eye className="w-3.5 h-3.5" /> Ver Planilla Oficial
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
