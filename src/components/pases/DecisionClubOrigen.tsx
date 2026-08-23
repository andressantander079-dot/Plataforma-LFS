"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { decidirPaseOrigen } from "@/lib/actions/pases.actions";
import type { DeudaDeclarada } from "@/lib/actions/pases.actions";

/**
 * Panel del club de ORIGEN: aprueba o rechaza el pase. Al aprobar puede
 * declarar una deuda pendiente del jugador (se cobra junto al pase o bloquea).
 */
export function DecisionClubOrigen({ transferId }: { transferId: string }) {
  const [motivo, setMotivo] = useState("");
  const [hayDeuda, setHayDeuda] = useState(false);
  const [deudaMonto, setDeudaMonto] = useState("");
  const [deudaModo, setDeudaModo] = useState<"cobrar" | "bloqueante">("cobrar");
  const [deudaDescripcion, setDeudaDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";

  function datosDeuda(): DeudaDeclarada | undefined {
    if (!hayDeuda) return undefined;
    const monto = Number(deudaMonto.replace(",", "."));
    return {
      monto,
      modo: deudaModo,
      descripcion: deudaDescripcion.trim() || undefined,
    };
  }

  function aprobar() {
    setError(null);
    if (hayDeuda) {
      const monto = Number(deudaMonto.replace(",", "."));
      if (!deudaMonto.trim() || Number.isNaN(monto) || monto <= 0) {
        setError("Ingresá el monto de la deuda (mayor a 0).");
        return;
      }
    }
    let textoConfirm = "¿Aprobar el pase? El jugador recibirá el link para firmar.";
    if (hayDeuda) {
      const monto = Number(deudaMonto.replace(",", "."));
      const fmt = monto.toLocaleString("es-AR");
      textoConfirm +=
        deudaModo === "cobrar"
          ? `\n\n💰 Declaraste una deuda de $${fmt}: el club destino la pagará al completar el pase.`
          : `\n\n🔒 Declaraste una deuda de $${fmt}: el pase quedará BLOQUEADO hasta que la liga la marque como saldada.`;
    }
    if (!window.confirm(textoConfirm)) return;
    startTransition(async () => {
      const res = await decidirPaseOrigen(transferId, true, undefined, datosDeuda());
      if (res.error) setError(res.error);
    });
  }

  function rechazar() {
    if (!motivo.trim()) {
      setError("Escribí el motivo del rechazo.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await decidirPaseOrigen(transferId, false, motivo.trim());
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5 flex flex-col gap-3">
      <p className="text-[11px] font-black text-blue-900 uppercase tracking-wider">
        Tu club es el origen — decidí
      </p>

      {/* Declaración de deuda */}
      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={hayDeuda}
          onChange={(e) => setHayDeuda(e.target.checked)}
          className="w-4 h-4 accent-amber-500"
        />
        El jugador tiene una deuda pendiente con el club
      </label>

      {hayDeuda && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col gap-2.5">
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="100"
              value={deudaMonto}
              onChange={(e) => setDeudaMonto(e.target.value)}
              placeholder="Monto de la deuda ($)"
              className={`${CLASE_INPUT} flex-1`}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={`modo-${transferId}`}
                checked={deudaModo === "cobrar"}
                onChange={() => setDeudaModo("cobrar")}
                className="mt-0.5 accent-green-600"
              />
              <span>
                <span className="font-bold">💰 Cobrar con el pase</span> — el club destino paga la
                deuda a tu club al completar el trámite.
              </span>
            </label>
            <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
              <input
                type="radio"
                name={`modo-${transferId}`}
                checked={deudaModo === "bloqueante"}
                onChange={() => setDeudaModo("bloqueante")}
                className="mt-0.5 accent-red-600"
              />
              <span>
                <span className="font-bold">🔒 Bloquear el pase</span> — el pase no se completa
                hasta que la deuda se salde (el jugador puede pagarla por fuera del sistema).
              </span>
            </label>
          </div>
          <input
            value={deudaDescripcion}
            onChange={(e) => setDeudaDescripcion(e.target.value)}
            placeholder="¿Por qué es la deuda? (ej.: cuotas impagas 2025)"
            maxLength={200}
            className={CLASE_INPUT}
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={aprobar}
          className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pendiente ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Aprobar
        </button>
      </div>
      <div className="flex gap-2">
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo del rechazo…"
          className={`${CLASE_INPUT} flex-1`}
        />
        <button
          type="button"
          disabled={pendiente}
          onClick={rechazar}
          className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          <XCircle className="w-4 h-4" /> Rechazar
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
