"use client";

import { History } from "lucide-react";
import type { EventoTimelinePase } from "@/lib/core/rules/tramitesRules";

/**
 * TIMELINE del pase: cada evento con fecha y hora exacta.
 */
export function TimelinePase({ eventos }: { eventos: EventoTimelinePase[] }) {
  if (eventos.length === 0) return null;

  const formato = (iso: string) =>
    new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <h3 className="font-serif text-base font-bold text-[#1A2A44] flex items-center gap-2 border-b border-slate-100 pb-3">
        <History className="w-5 h-5 text-[#F97316]" />
        Línea de tiempo
      </h3>
      <div className="flex flex-col">
        {eventos.map((e, i) => (
          <div key={`${e.clave}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                  e.clave === "rechazado" || e.clave === "cancelado" ? "bg-red-500" : "bg-emerald-500"
                }`}
              />
              {i < eventos.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 min-w-0">
              <p className="text-xs font-bold text-[#1A2A44]">{e.label}</p>
              <p className="text-[11px] text-slate-400">{e.at ? formato(e.at) : "—"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
