"use client";

import { CheckCircle2, XCircle, ListChecks } from "lucide-react";
import type { ItemChecklist } from "@/lib/core/rules/tramitesRules";

/**
 * CHECKLIST automática previa a la aprobación: documentos, ventana,
 * deuda bloqueante, firma y cupo del plantel destino.
 */
export function ChecklistPase({ items }: { items: ItemChecklist[] }) {
  const verdes = items.filter((i) => i.ok).length;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-serif text-base font-bold text-[#1A2A44] flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-[#F97316]" />
          Checklist de revisión
        </h3>
        <span
          className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
            verdes === items.length ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}
        >
          {verdes}/{items.length} OK
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3">
            {item.ok ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#1A2A44]">{item.label}</p>
              <p className={`text-[11px] ${item.ok ? "text-slate-500" : "text-red-600 font-semibold"}`}>
                {item.detalle}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
