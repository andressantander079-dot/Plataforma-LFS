"use client";

import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import type { PlanillaHistorialUI } from "@/lib/actions/arbitros.actions";

/**
 * HISTORIAL DE PLANILLAS (árbitro, read-only) — sus partidos ya dirigidos
 * con el resumen de eventos. Tocar una abre la planilla completa.
 */
export function HistorialPlanillas({ items }: { items: PlanillaHistorialUI[] }) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-[#F97316]" />
        Historial de planillas ({items.length})
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {items.map((p) => (
            <li key={p.matchId}>
              <Link
                href={`/arbitro/planillas/${p.matchId}`}
                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50/60 transition group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {p.torneoNombre}
                    {p.fecha
                      ? ` · ${new Date(p.fecha).toLocaleDateString("es-AR")}`
                      : ""}
                  </p>
                  <p className="font-serif font-black text-[#1A2A44] text-sm truncate">
                    {p.homeNombre} {p.home_score ?? "—"} - {p.away_score ?? "—"} {p.awayNombre}
                    {p.status === "wo" && (
                      <span className="ml-2 text-red-500 text-[10px] font-bold">W.O.</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    ⚽ {p.goles} · 🟨 {p.amarillas} · 🟥 {p.rojas}
                    {!p.result_confirmed && (
                      <span className="ml-2 font-bold text-amber-600">· resultado sin confirmar</span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
