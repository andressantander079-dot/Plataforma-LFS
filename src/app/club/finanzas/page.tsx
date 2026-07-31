"use client";

import { Wallet, FileUp, CheckCircle } from "lucide-react";

export default function ClubFinanzas() {
  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#F97316]" />
            Estado Financiero del Club
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Control de aranceles de inscripción, multas disciplinarias y deudas de pases.</p>
        </div>
        <button className="w-full sm:w-auto px-4 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-[#F97316]/95 transition shadow-md">
          <FileUp className="w-4 h-4" /> Subir Comprobante de Pago
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Estado de Cuenta</span>
          <span className="text-2xl font-serif font-black text-green-600 mt-2 block">AL DÍA</span>
          <p className="text-slate-400 text-[9px] font-medium mt-1">No registras deudas vencidas.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Saldo a Favor</span>
          <span className="text-2xl font-serif font-black text-[#1A2A44] mt-2 block">$15.000 ARS</span>
          <p className="text-slate-400 text-[9px] font-medium mt-1">Crédito disponible para futuros aranceles.</p>
        </div>
      </div>
    </div>
  );
}
