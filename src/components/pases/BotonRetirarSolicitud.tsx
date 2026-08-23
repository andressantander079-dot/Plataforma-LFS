"use client";

import { useState, useTransition } from "react";
import { Undo2, Loader2 } from "lucide-react";
import { retirarSolicitudPase } from "@/lib/actions/pases.actions";

/** El club destino retira su solicitud recién iniciada (antes de la revisión). */
export function BotonRetirarSolicitud({ transferId }: { transferId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          if (!window.confirm("¿Retirar la solicitud de pase? Queda registrada como cancelada."))
            return;
          setError(null);
          startTransition(async () => {
            const res = await retirarSolicitudPase(transferId);
            if (res.error) setError(res.error);
          });
        }}
        className="text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-300 text-slate-500 hover:bg-slate-100 transition disabled:opacity-50 flex items-center gap-1"
      >
        {pendiente ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
        Retirar
      </button>
      {error && <span className="text-[10px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
