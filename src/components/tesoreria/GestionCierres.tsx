"use client";

import { useState, useTransition } from "react";
import { Lock, LockOpen, Loader2, AlertCircle } from "lucide-react";
import { cerrarMes, reabrirMes } from "@/lib/actions/tesoreria.actions";

/**
 * Cierre de caja mensual:
 *  · El tesorero (o admin) cierra el mes → queda bloqueado para movimientos nuevos.
 *  · Solo el ADMIN puede reabrirlo, y tiene que dejar el motivo registrado.
 */
export interface MesCierre {
  anio: number;
  mes: number;
  etiqueta: string;
  cerrado: boolean;
  detalle: string | null;
}

export function GestionCierres({
  meses,
  esAdmin,
}: {
  meses: MesCierre[];
  esAdmin: boolean;
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

  return (
    <div className="flex flex-col gap-2">
      {meses.map((m) => (
        <div
          key={`${m.anio}-${m.mes}`}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
            m.cerrado ? "border-slate-200 bg-slate-50" : "border-green-200 bg-green-50/40"
          }`}
        >
          {m.cerrado ? (
            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <LockOpen className="w-4 h-4 text-green-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1A2A44]">{m.etiqueta}</p>
            <p className="text-[11px] text-slate-500">
              {m.cerrado ? m.detalle : "Mes abierto: se pueden cargar movimientos."}
            </p>
          </div>

          {m.cerrado ? (
            esAdmin && (
              <button
                type="button"
                disabled={pendiente}
                onClick={() => {
                  const motivo = window.prompt(
                    `¿Reabrir ${m.etiqueta}?\nQueda registrado con tu nombre. Motivo (obligatorio):`
                  );
                  if (!motivo) return;
                  ejecutar(() => reabrirMes(m.anio, m.mes, motivo));
                }}
                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 transition disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                {pendiente ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <LockOpen className="w-3 h-3" />
                )}
                Reabrir
              </button>
            )
          ) : (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => {
                if (
                  !window.confirm(
                    `¿Cerrar ${m.etiqueta}?\nDespués de cerrado no se podrán cargar cargos, pagos ni gastos de ese mes.`
                  )
                )
                  return;
                ejecutar(() => cerrarMes(m.anio, m.mes));
              }}
              className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 flex items-center gap-1 shrink-0"
            >
              {pendiente ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Lock className="w-3 h-3" />
              )}
              Cerrar mes
            </button>
          )}
        </div>
      ))}

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
