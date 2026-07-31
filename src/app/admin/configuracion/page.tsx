"use client";

import { Settings, Save } from "lucide-react";

export default function ConfiguracionAdmin() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#F97316]" />
          Configuración General
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Parámetros del sistema de puntos, tarjetas y seguridad.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); alert("Configuración guardada."); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Nombre de la Asociación</label>
          <input type="text" defaultValue="Liga de Fútsal de Ushuaia" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Acumulación Amarillas (Suspensión)</label>
            <input type="number" defaultValue={5} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Multa por Tarjeta Roja Directa (ARS)</label>
            <input type="number" defaultValue={8500} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>
        </div>

        <button type="submit" className="w-full mt-2 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5">
          <Save className="w-4 h-4" /> Guardar Cambios
        </button>
      </form>
    </div>
  );
}
