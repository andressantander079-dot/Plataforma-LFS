"use client";

import { User, PenTool, Save } from "lucide-react";

export default function ArbitroPerfil() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <User className="w-7 h-7 text-[#F97316]" />
          Mi Perfil y Firma Digital
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Administra tus datos personales y registra tu firma digital táctil para actas.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre Completo</label>
            <input type="text" defaultValue="Esteban Ortiz" disabled className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-500" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Categoría LFS</label>
            <input type="text" defaultValue="Nacional A" disabled className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-slate-500" />
          </div>
        </div>

        <div className="border-t pt-4 flex flex-col gap-3">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">Firma Digital Registrada</h3>
          <div className="p-8 border border-dashed rounded-xl bg-slate-50 flex flex-col items-center gap-3">
            <PenTool className="w-8 h-8 text-slate-400" />
            <p className="text-xs text-slate-400">Firma táctil registrada de forma segura encriptada con hash.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
