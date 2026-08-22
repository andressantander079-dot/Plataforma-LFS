"use client";

import { useState, useTransition } from "react";
import { FileImage, Loader2 } from "lucide-react";
import { obtenerUrlComprobante } from "@/lib/actions/tesoreria.actions";

/** Botón que abre el comprobante (URL firmada de 10 minutos) en otra pestaña. */
export function VerComprobante({ path }: { path: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await obtenerUrlComprobante(path);
            if (res.url) window.open(res.url, "_blank");
            else if (res.error) setError(res.error);
          });
        }}
        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 text-[#1A2A44] hover:border-[#F97316] hover:text-[#F97316] transition disabled:opacity-50 flex items-center gap-1"
      >
        {pendiente ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileImage className="w-3.5 h-3.5" />
        )}
        Ver
      </button>
      {error && <span className="text-[10px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
