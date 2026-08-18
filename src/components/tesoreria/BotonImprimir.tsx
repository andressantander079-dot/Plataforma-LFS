"use client";

import { Printer } from "lucide-react";

/** Imprime el recibo (desde el navegador se puede guardar como PDF). */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5 print:hidden"
    >
      <Printer className="w-4 h-4" /> Imprimir / Guardar PDF
    </button>
  );
}
