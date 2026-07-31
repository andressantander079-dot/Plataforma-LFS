"use client";

import { MessageSquare, Plus, Mail } from "lucide-react";

export default function ArbitroMensajeria() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-[#F97316]" />
            Bandeja de Mensajes
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Comunicaciones directas con el Colegio de Árbitros y el Tribunal Disciplinario.</p>
        </div>
        <button className="px-4 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl flex items-center gap-1 hover:bg-[#F97316]/95 transition shadow-md">
          <Plus className="w-4 h-4" /> Nuevo Mensaje
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center gap-2 shadow-sm">
        <Mail className="w-8 h-8 text-slate-350" />
        <span className="text-sm font-semibold text-[#1A2A44]">Bandeja de Entrada Vacía</span>
        <p className="text-xs text-slate-500 max-w-sm">No tienes mensajes sin leer del Colegio de Árbitros.</p>
      </div>
    </div>
  );
}
