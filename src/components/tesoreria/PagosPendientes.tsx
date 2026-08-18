"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2, FileImage, AlertCircle } from "lucide-react";
import {
  aprobarPago,
  obtenerUrlComprobante,
  rechazarPago,
} from "@/lib/actions/tesoreria.actions";
import { formatoPesos, METODO_PAGO_UI } from "@/lib/core/tesoreria/money";

/** Pagos que subieron los clubes y esperan aprobación de la tesorería. */
export interface PagoPendienteUI {
  id: string;
  clubNombre: string;
  descripcionCargo: string;
  monto: number;
  metodo: string;
  comprobante_path: string | null;
  created_at: string;
}

export function PagosPendientes({ pagos }: { pagos: PagoPendienteUI[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await accion;
      if (res.error) setError(res.error);
    });
  }

  async function verComprobante(path: string) {
    const res = await obtenerUrlComprobante(path);
    if (res.url) window.open(res.url, "_blank");
    else if (res.error) setError(res.error);
  }

  if (pagos.length === 0) {
    return (
      <p className="text-xs text-slate-400 py-3">
        No hay comprobantes esperando aprobación. Cuando un club suba uno, aparece acá.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {pagos.map((p) => (
        <div
          key={p.id}
          className="border border-orange-200 bg-orange-50/50 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
        >
          <div className="flex-1 min-w-[200px]">
            <p className="font-bold text-[#1A2A44] text-sm">{p.clubNombre}</p>
            <p className="text-[11px] text-slate-500">
              {p.descripcionCargo} · {METODO_PAGO_UI[p.metodo] ?? p.metodo} ·{" "}
              {new Date(p.created_at).toLocaleDateString("es-AR")}
            </p>
          </div>
          <span className="font-black text-[#1A2A44] text-sm">{formatoPesos(p.monto)}</span>

          {p.comprobante_path && (
            <button
              type="button"
              onClick={() => verComprobante(p.comprobante_path!)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-[#1A2A44] hover:border-[#F97316] hover:text-[#F97316] transition flex items-center gap-1"
            >
              <FileImage className="w-3.5 h-3.5" /> Ver comprobante
            </button>
          )}

          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(aprobarPago(p.id))}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1"
          >
            {pendiente ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Aprobar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              const motivo = window.prompt("Motivo del rechazo (el club lo ve):");
              if (motivo) ejecutar(rechazarPago(p.id, motivo));
            }}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1"
          >
            <XCircle className="w-3.5 h-3.5" /> Rechazar
          </button>
        </div>
      ))}
    </div>
  );
}
