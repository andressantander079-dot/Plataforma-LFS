"use client";

import { useState, useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { anularCargo, anularPago } from "@/lib/actions/tesoreria.actions";

/**
 * Anulación con motivo (solo admin): queda el registro, nada se borra.
 * Sirve para cargos y para pagos aprobados cargados por error.
 */
export function BotonAnular({
  tipo,
  id,
  descripcion,
}: {
  tipo: "cargo" | "pago";
  id: string;
  descripcion: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          const motivo = window.prompt(
            `¿Anular ${tipo === "cargo" ? "el cargo" : "el pago"} "${descripcion}"?\nQueda registrado con tu nombre. Motivo (obligatorio):`
          );
          if (!motivo) return;
          setError(null);
          startTransition(async () => {
            const res =
              tipo === "cargo" ? await anularCargo(id, motivo) : await anularPago(id, motivo);
            if (res.error) setError(res.error);
          });
        }}
        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1"
      >
        {pendiente ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
        Anular
      </button>
      {error && <span className="text-[10px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
