"use client";

import { FileText, FileUp, Download } from "lucide-react";

export default function ReglamentoAdmin() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <FileText className="w-7 h-7 text-[#F97316]" />
          Reglamento Oficial LFS
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Control de versiones y publicación de reglamentos del torneo.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h3 className="font-bold text-[#1A2A44] text-sm">Reglamento Oficial Vigente</h3>
            <p className="text-slate-400 text-[10px] font-bold">Ultima actualización: Marzo 2026 • Versión 3.0</p>
          </div>
          <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-[#1A2A44] transition flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Descargar PDF
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-bold text-slate-700">Subir Nueva Versión</h4>
          <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 hover:bg-slate-50 transition cursor-pointer text-slate-500 font-bold text-xs text-center">
            <FileUp className="w-8 h-8 text-slate-400" />
            <span>Seleccionar Archivo PDF (máximo 15 MB)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
