"use client";

import { Download, FileText } from "lucide-react";

export default function ClubDescargas() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Download className="w-7 h-7 text-[#F97316]" />
          Descargas del Club
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Planillas en blanco para partidos, reglamentos, actas y boletines oficiales.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between hover:shadow transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 border rounded-xl flex items-center justify-center text-[#1A2A44]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-[#1A2A44] text-xs">Planilla de Firma de Jugadores (Ficha LFS)</h4>
              <span className="text-[9px] text-slate-400 font-bold block">PDF • 1.2 MB</span>
            </div>
          </div>
          <button className="p-2 hover:bg-slate-100 rounded-lg text-[#F97316] transition">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
