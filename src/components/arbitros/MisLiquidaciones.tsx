"use client";

import { Banknote } from "lucide-react";
import type { MiPagoUI } from "@/lib/actions/arbitros.actions";

/**
 * MIS LIQUIDACIONES (árbitro) — el historial de honorarios que la liga le
 * generó mes a mes, con su estado (pendiente / pagado).
 */
export function MisLiquidaciones({ pagos }: { pagos: MiPagoUI[] }) {
  const fmtPesos = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
        <Banknote className="w-4 h-4 text-[#F97316]" /> Mis honorarios
      </h3>
      {pagos.length === 0 ? (
        <p className="text-xs text-slate-400">
          Todavía no hay liquidaciones. Cuando la liga liquide un mes, aparece acá y te llega un aviso.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pagos.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 border border-slate-100 rounded-xl px-4 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#1A2A44] capitalize">{p.periodoLindo}</p>
                <p className="text-[10px] text-slate-500">
                  {p.partidos} partidos × {fmtPesos(p.tarifa)}
                </p>
              </div>
              <p className="font-black text-sm text-[#1A2A44]">{fmtPesos(p.monto)}</p>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  p.status === "pagado"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-amber-50 text-amber-700 border border-amber-200"
                }`}
              >
                {p.status === "pagado" ? "Pagado" : "Pendiente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
