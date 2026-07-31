"use client";

import { Settings, Save } from "lucide-react";

export default function ClubConfiguracion() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#F97316]" />
          Configuración del Club
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Gestión de contactos del club, colores de camiseta y branding.</p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); alert("Ajustes guardados."); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Nombre Oficial del Club</label>
          <input type="text" defaultValue="Club Social y Deportivo Camioneros Ushuaia" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Teléfono Delegado</label>
            <input type="text" defaultValue="+54 2901 442211" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Color Camiseta Principal</label>
            <input type="text" defaultValue="Verde" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>
        </div>

        <button type="submit" className="w-full mt-2 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5">
          <Save className="w-4 h-4" /> Guardar Ajustes
        </button>
      </form>
    </div>
  );
}
