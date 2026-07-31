"use client";

import { Calendar, CheckCircle } from "lucide-react";

export default function ArbitroDesignaciones() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Mis Designaciones Arbitrales
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Consulta y aceptación de partidos asignados para dirigir.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-4 gap-4">
          <div>
            <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-250">Primera División</span>
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] mt-2">Club Camioneros vs HAF Ushuaia</h3>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Estadio: Cochocho Vargas • Sábado 1 de Agosto - 16:00 hs</p>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-150 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Aceptado
          </span>
        </div>
      </div>
    </div>
  );
}
