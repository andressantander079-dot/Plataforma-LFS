"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Flag,
  Ban,
} from "lucide-react";
import {
  aprobarRevisionPase,
  cancelarPase,
  completarPase,
  rechazarPaseAdmin,
  regenerarLinkFirma,
} from "@/lib/actions/pases.actions";

/**
 * Botones del admin sobre el pase, según el estado del trámite:
 *  · En revisión → aprobar revisión / rechazar
 *  · Esperando firma → regenerar link (si se venció)
 *  · Auditoría final → completar (¡efectiviza el pase!)
 *  · Siempre (mientras no termine) → cancelar con motivo
 */
export function AccionesPaseAdmin({
  transferId,
  estado,
}: {
  transferId: string;
  estado: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const ejecutar = (fn: () => Promise<{ error?: string; ok?: boolean }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
    });
  };

  const CLASE =
    "text-[11px] font-bold px-3 py-2 rounded-xl transition disabled:opacity-50 flex items-center gap-1.5";

  const enRevision = estado === "1_INIT_CLUB_A" || estado === "2_FVF_REVIEW";
  const esperandoFirma = estado === "5_PLAYER_SIGNATURE";
  const auditoriaFinal = estado === "6_FINAL_AUDIT";
  const terminado =
    estado === "7_COMPLETED" || estado === "8_RECHAZADO" || estado === "9_CANCELADO";

  if (terminado) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {enRevision && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(() => aprobarRevisionPase(transferId))}
            className={`${CLASE} bg-green-600 text-white hover:bg-green-700`}
          >
            {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Aprobar revisión
          </button>
        )}
        {enRevision && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              const motivo = window.prompt("Motivo del rechazo (lo ven los clubes):");
              if (motivo) ejecutar(() => rechazarPaseAdmin(transferId, motivo));
            }}
            className={`${CLASE} border border-red-300 text-red-600 hover:bg-red-50`}
          >
            <XCircle className="w-4 h-4" /> Rechazar pase
          </button>
        )}
        {esperandoFirma && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (window.confirm("¿Generar un link nuevo de firma? El anterior deja de funcionar."))
                ejecutar(() => regenerarLinkFirma(transferId));
            }}
            className={`${CLASE} border border-purple-300 text-purple-700 hover:bg-purple-50`}
          >
            <RefreshCw className="w-4 h-4" /> Regenerar link de firma
          </button>
        )}
        {auditoriaFinal && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (
                window.confirm(
                  "¿Completar el pase?\n\nEl jugador pasa al club nuevo AHORA, se emite el comprobante numerado y, si hay derecho de pase configurado, se genera el cargo en Tesorería."
                )
              )
                ejecutar(() => completarPase(transferId));
            }}
            className={`${CLASE} bg-[#F97316] text-white hover:bg-[#F97316]/90 shadow-md`}
          >
            {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-4 h-4" />}
            Completar pase (efectivo)
          </button>
        )}
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            const motivo = window.prompt("¿Cancelar el trámite? Queda registrado. Motivo (obligatorio):");
            if (motivo) ejecutar(() => cancelarPase(transferId, motivo));
          }}
          className={`${CLASE} border border-slate-300 text-slate-500 hover:bg-slate-50`}
        >
          <Ban className="w-4 h-4" /> Cancelar trámite
        </button>
      </div>
      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
