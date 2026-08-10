"use client";

import { Printer } from "lucide-react";

/** Imprime la planilla (desde el diálogo de impresión se puede guardar como PDF). */
export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#ea6a0a] text-white font-bold text-sm rounded-2xl px-5 py-2.5 transition-colors shadow-sm print:hidden"
    >
      <Printer className="w-4 h-4" /> Descargar / Imprimir
    </button>
  );
}
