"use client";

import { ClipboardList, Plus, ArrowRight } from "lucide-react";

export default function ClubTramites() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#F97316]" />
            Trámites y Transferencias (Pases)
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Inicia solicitudes de pases y realiza seguimiento de la máquina de estados.</p>
        </div>
        <button className="px-4 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl flex items-center gap-1 hover:bg-[#F97316]/95 transition shadow-md">
          <Plus className="w-4 h-4" /> Solicitar Pase
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">ID</th>
              <th className="py-2 px-2">Jugador</th>
              <th className="py-2 px-2">Sentido del Pase</th>
              <th className="py-2 px-2">Estado del Trámite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            <tr className="hover:bg-slate-50/50 transition">
              <td className="py-3 px-2 font-mono text-[#F97316] font-bold">t-100</td>
              <td className="py-3 px-2 font-bold text-[#1A2A44]">Lucas Aravena</td>
              <td className="py-3 px-2 font-semibold text-slate-550 flex items-center gap-1.5">
                <span>HAF Ushuaia</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#F97316]" />
                <span className="text-[#1A2A44]">Camioneros</span>
              </td>
              <td className="py-3 px-2">
                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-orange-50 text-orange-700 rounded border border-orange-150">
                  Esperando Dictamen Club B
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
