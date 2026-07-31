"use client";

import { Calendar, CheckCircle } from "lucide-react";

const MOCK_PARTIDOS = [
  { id: "p1", match: "Club Camioneros vs HAF Ushuaia", category: "Primera Division", date: "Sábado 1 de Agosto - 16:00", ref1: "Esteban Ortiz", ref2: "Rogelio Gómez" },
  { id: "p2", match: "Club Galicia vs Los Andes", category: "Sub-18", date: "Sábado 1 de Agosto - 18:00", ref1: "Sin Asignar", ref2: "Sin Asignar" },
];

export default function DesignacionesAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Designaciones Arbitrales
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Asignación oficial de ternas arbitrales para partidos de la fecha.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">Partidos de la Próxima Fecha</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {MOCK_PARTIDOS.map((partido) => (
            <div key={partido.id} className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition">
              <div>
                <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-250">{partido.category}</span>
                <h4 className="font-serif text-base font-bold text-[#1A2A44] mt-2">{partido.match}</h4>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{partido.date}</p>
              </div>
              <div className="border-t pt-2 flex flex-col gap-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Árbitro 1:</span>
                  <span className={`font-bold ${partido.ref1 === "Sin Asignar" ? "text-red-500" : "text-[#1A2A44]"}`}>{partido.ref1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Árbitro 2:</span>
                  <span className={`font-bold ${partido.ref2 === "Sin Asignar" ? "text-red-500" : "text-[#1A2A44]"}`}>{partido.ref2}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
