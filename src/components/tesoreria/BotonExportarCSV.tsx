"use client";

import { FileDown } from "lucide-react";

/**
 * Exporta una tabla a CSV (separador ";" y BOM para que Excel en español
 * lo abra prolijo). Los montos llegan ya formateados como texto.
 */
export function BotonExportarCSV({
  nombreArchivo,
  encabezados,
  filas,
  etiqueta = "Descargar Excel (CSV)",
}: {
  nombreArchivo: string;
  encabezados: string[];
  filas: (string | number)[][];
  etiqueta?: string;
}) {
  const descargar = () => {
    const escapar = (valor: string | number) => {
      const texto = String(valor ?? "");
      // Si tiene ; " o salto de línea, va entre comillas
      return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };
    const lineas = [
      encabezados.map(escapar).join(";"),
      ...filas.map((f) => f.map(escapar).join(";")),
    ];
    // BOM \uFEFF para que Excel reconozca UTF-8 (acentos)
    const blob = new Blob(["\uFEFF" + lineas.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={descargar}
      className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:border-[#F97316] hover:text-[#F97316] transition flex items-center gap-1.5"
    >
      <FileDown className="w-4 h-4" />
      {etiqueta}
    </button>
  );
}
