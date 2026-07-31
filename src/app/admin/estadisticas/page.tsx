"use client";

import { BarChart3, TrendingUp, Users } from "lucide-react";

export default function EstadisticasAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Estadísticas Globales LFS
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Indicadores generales de rendimiento, goles y conducta en el torneo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-[#F97316] rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-450 uppercase block">Goles Anotados</span>
            <span className="text-xl font-bold text-[#1A2A44]">142 Goles</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-slate-450 uppercase block">Jugadores Registrados</span>
            <span className="text-xl font-bold text-[#1A2A44]">280 Fichas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
