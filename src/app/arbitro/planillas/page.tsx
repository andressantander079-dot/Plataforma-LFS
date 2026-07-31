"use client";

import Link from "next/link";
import { Award, PenTool } from "lucide-react";

export default function ArbitroPlanillas() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Award className="w-7 h-7 text-[#F97316]" />
          Carga de Planillas de Partido
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Listado de planillas habilitadas para registrar eventos en vivo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:shadow transition">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-250">Primera División</span>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-150">Pendiente de Carga</span>
            </div>
            <h4 className="font-serif text-base font-bold text-[#1A2A44]">Camioneros vs HAF Ushuaia</h4>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">Estadio: Cochocho Vargas • Sábado 1 de Agosto - 16:00 hs</p>
          </div>
          <Link href="/arbitro/planillas/p1" className="mt-4 px-3 py-2 bg-[#F97316] text-white rounded-lg font-bold text-[10px] transition flex items-center justify-center gap-1.5 hover:bg-[#F97316]/95 w-full shadow-sm">
            <PenTool className="w-3.5 h-3.5" /> Abrir Planilla en Vivo
          </Link>
        </div>
      </div>
    </div>
  );
}
