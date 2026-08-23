"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { decidirPaseOrigen } from "@/lib/actions/pases.actions";

/** Dictamen del club de origen: aprueba (habilita la firma) o rechaza con motivo. */
export function DecisionClubOrigen({ transferId }: { transferId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const ejecutar = (fn: () => Promise<{ error?: string; ok?: boolean }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (window.confirm("¿Aprobar el pase? El jugador va a recibir el link para firmar."))
              ejecutar(() => decidirPaseOrigen(transferId, true));
          }}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
        >
          {pendiente ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
          Aprobar pase
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            const motivo = window.prompt("Motivo del rechazo (lo ve el club que pidió el pase):");
            if (motivo) ejecutar(() => decidirPaseOrigen(transferId, false, motivo));
          }}
          className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1"
        >
          <XCircle className="w-3.5 h-3.5" /> Rechazar
        </button>
      </span>
      {error && <span className="text-[10px] font-semibold text-red-600">{error}</span>}
    </span>
  );
}
