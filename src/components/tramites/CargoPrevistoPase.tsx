"use client";

import { Banknote, Info } from "lucide-react";
import type { CargoRealUI } from "@/lib/actions/tramites.actions";

/**
 * CARGO DE TESORERÍA del pase: el "cargo previsto" (según las tarifas
 * configuradas, visible desde el inicio) y, una vez completado, el cargo
 * real generado con su estado de pago.
 */
export function CargoPrevistoPase({
  previsto,
  cargosReales,
  completado,
}: {
  previsto: { monto: number; origen: "torneo" | "general" | null };
  cargosReales: CargoRealUI[];
  completado: boolean;
}) {
  const STATUS_UI: Record<string, { label: string; clases: string }> = {
    pendiente: { label: "Pendiente de pago", clases: "bg-amber-50 text-amber-700 border-amber-200" },
    parcial: { label: "Pago parcial", clases: "bg-sky-50 text-sky-700 border-sky-200" },
    pagado: { label: "Pagado", clases: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    anulado: { label: "Anulado", clases: "bg-slate-100 text-slate-500 border-slate-200" },
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <h3 className="font-serif text-base font-bold text-[#1A2A44] flex items-center gap-2 border-b border-slate-100 pb-3">
        <Banknote className="w-5 h-5 text-[#F97316]" />
        Cargo a tesorería
      </h3>

      {cargosReales.length === 0 ? (
        <div className="flex items-start gap-3">
          <div className="flex-1">
            {previsto.monto > 0 ? (
              <>
                <p className="text-lg font-black text-amber-600">
                  ${previsto.monto.toLocaleString("es-AR")}
                  <span className="text-[10px] font-bold text-slate-400 ml-2">CARGO PREVISTO</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Derecho de pase según tarifa {previsto.origen === "torneo" ? "del torneo" : "general"}.
                  {completado
                    ? " No se generó el cargo: revisá las tarifas o cargalo a mano en tesorería."
                    : " Se genera automáticamente al completar el pase (lo paga el club destino; si no paga, queda como deuda)."}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Sin cargo: no hay tarifa de derecho de pase configurada para esta categoría/tipo.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {cargosReales.map((c) => {
            const ui = STATUS_UI[c.status] ?? STATUS_UI.pendiente;
            return (
              <div key={c.id} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs font-bold text-[#1A2A44]">{c.descripcion}</p>
                </div>
                <span className="text-sm font-black text-amber-600">${c.monto.toLocaleString("es-AR")}</span>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ui.clases}`}>{ui.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
