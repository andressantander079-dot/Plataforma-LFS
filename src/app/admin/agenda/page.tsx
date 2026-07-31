"use client";

import { Calendar, Plus } from "lucide-react";

export default function AgendaAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Calendar className="w-7 h-7 text-[#F97316]" />
            Agenda y Eventos
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Calendario de reuniones de delegados, congresos y cierres de inscripción.</p>
        </div>
        <button className="px-4 py-2 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuevo Evento
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Eventos Próximos</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-4 p-4 border rounded-xl hover:bg-slate-50/50 transition">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex flex-col items-center justify-center border text-[#1A2A44]">
              <span className="text-[10px] font-black uppercase">AGO</span>
              <span className="text-sm font-black">04</span>
            </div>
            <div>
              <h4 className="font-bold text-[#1A2A44] text-sm">Reunión de Delegados (Fixture Fecha 6)</h4>
              <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Ubicación: Sede LFS Ushuaia • Hora: 20:00 hs</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
