"use client";

import { BarChart3, TrendingUp } from "lucide-react";

export default function ArbitroEstadisticas() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Mis Estadísticas de Desempeño
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Calificaciones promedio de los delegados y estadísticas de partidos dirigidos.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-[#F97316] rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-450 uppercase block">Calificación Promedio</span>
            <span className="text-xl font-bold text-[#1A2A44]">9.2 / 10</span>
          </div>
        </div>
      </div>
    </div>
  );
}
