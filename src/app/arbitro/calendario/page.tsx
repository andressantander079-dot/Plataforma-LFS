"use client";

import { Calendar } from "lucide-react";

export default function ArbitroCalendario() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Calendario Mensual
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Fechas oficiales, congresos arbitrales y capacitaciones obligatorias.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Agosto 2026</h3>
        <div className="p-4 border rounded-xl bg-slate-50/50 flex flex-col gap-1">
          <span className="text-[10px] text-[#F97316] font-bold">14 AGOSTO</span>
          <h4 className="font-bold text-sm text-[#1A2A44]">Clínica de Capacitación Futsal AFA</h4>
          <p className="text-xs text-slate-500">Obligatoria para árbitros de categorías Nacional A y B.</p>
        </div>
      </div>
    </div>
  );
}
