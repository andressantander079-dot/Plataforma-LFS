"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, CheckCircle2, XCircle, Link2, Banknote } from "lucide-react";
import {
  aprobarRevisionPase,
  rechazarPaseAdmin,
  regenerarLinkFirma,
  completarPase,
  marcarDeudaSaldada,
} from "@/lib/actions/pases.actions";
import type { EstadoPase } from "@/lib/core/rules/pasesRules";

/**
 * Botones de la liga según el paso del pase:
 *  - 2_FVF_REVIEW (revisión): aprobar / rechazar con motivo
 *  - 6_FINAL_AUDIT (jugador firmó): completar (mueve al jugador + derecho de pase)
 *  - deuda bloqueante pendiente: marcar saldada (desbloquea)
 *  - siempre: regenerar link de firma
 */
export function AccionesPaseAdmin({
  transferId,
  estado,
  deudaBloqueantePendiente = false,
}: {
  transferId: string;
  estado: EstadoPase;
  deudaBloqueantePendiente?: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<{ ok?: boolean; error?: string }>, confirmar?: string) {
    setError(null);
    setAviso(null);
    if (confirmar && !window.confirm(confirmar)) return;
    startTransition(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {estado === "2_FVF_REVIEW" && (
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex flex-col gap-3">
          <p className="text-[11px] font-black text-blue-900 uppercase tracking-wider">
            Revisión de la liga
          </p>
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              ejecutar(
                () => aprobarRevisionPase(transferId),
                "¿Aprobar la revisión? El club de origen recibirá el aviso para decidir."
              )
            }
            className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {pendiente ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Aprobar revisión
          </button>
          <div className="flex gap-2">
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo del rechazo…"
              className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (!motivo.trim()) {
                  setError("Escribí el motivo del rechazo.");
                  return;
                }
                ejecutar(() => rechazarPaseAdmin(transferId, motivo.trim()));
              }}
              className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" /> Rechazar
            </button>
          </div>
        </div>
      )}

      {deudaBloqueantePendiente && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex flex-col gap-2.5">
          <p className="text-[11px] font-black text-amber-900 uppercase tracking-wider">
            🔒 Deuda bloqueante pendiente
          </p>
          <p className="text-[11px] text-amber-800">
            Este pase está frenado hasta que la deuda del jugador se salde. Cuando se pague (puede
            ser por fuera del sistema), marcala acá para desbloquear el pase.
          </p>
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              ejecutar(
                () => marcarDeudaSaldada(transferId),
                "¿Confirmás que la deuda está saldada? El pase quedará desbloqueado."
              )
            }
            className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {pendiente ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Banknote className="w-4 h-4" />
            )}
            💰 Deuda saldada (desbloquear)
          </button>
        </div>
      )}

      {estado === "6_FINAL_AUDIT" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            ejecutar(
              () => completarPase(transferId),
              "¿COMPLETAR el pase? El jugador se mueve al club destino, se le asigna su número de pase LFS y se cargan los importes correspondientes."
            )
          }
          className="px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pendiente ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          ✅ Completar pase (oficializar)
        </button>
      )}

      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          ejecutar(async () => {
            const res = await regenerarLinkFirma(transferId);
            if (res.ok) setAviso("Link nuevo generado. Copialo del recuadro de firma.");
            return res;
          })
        }
        className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:border-slate-400 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Link2 className="w-4 h-4" /> Regenerar link de firma
      </button>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {aviso && <p className="text-xs font-semibold text-green-700">{aviso}</p>}
    </div>
  );
}
