"use client";

import Link from "next/link";
import { BellRing, CalendarClock, ClipboardList, SquareChartGantt } from "lucide-react";
import type { PanelArbitroUI } from "@/lib/actions/arbitros.actions";
import { TarjetasDesignacion } from "./TarjetasDesignacion";

/**
 * PANEL DEL ÁRBITRO (dashboard premium) — KPIs, alerta de propuestas sin
 * responder (con botones aceptar/rechazar en el momento) y próximos partidos.
 */
export function PanelArbitro({ panel }: { panel: PanelArbitroUI }) {
  const kpis = [
    {
      icono: <CalendarClock className="w-4 h-4" />,
      valor: panel.kpis.partidosEsteMes,
      label: "Partidos este mes",
      color: "text-[#1A2A44]",
      href: "/arbitro/designaciones",
    },
    {
      icono: <BellRing className="w-4 h-4" />,
      valor: panel.kpis.pendientesRespuesta,
      label: "Propuestas sin responder",
      color: panel.kpis.pendientesRespuesta > 0 ? "text-[#F97316]" : "text-slate-400",
      href: "/arbitro/designaciones",
    },
    {
      icono: <ClipboardList className="w-4 h-4" />,
      valor: panel.kpis.planillasPorConfirmar,
      label: "Resultados sin confirmar",
      color: panel.kpis.planillasPorConfirmar > 0 ? "text-amber-500" : "text-slate-400",
      href: "/arbitro/planillas",
    },
    {
      icono: <SquareChartGantt className="w-4 h-4" />,
      valor: panel.kpis.dirigidosTotal,
      label: "Partidos dirigidos",
      color: "text-emerald-600",
      href: "/arbitro/estadisticas",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-1.5 hover:border-[#F97316]/40 hover:shadow-md transition"
          >
            <span className={`${k.color} opacity-70`}>{k.icono}</span>
            <p className={`font-serif text-2xl font-black ${k.color}`}>{k.valor}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{k.label}</p>
          </Link>
        ))}
      </div>

      <TarjetasDesignacion
        designaciones={[...panel.pendientes, ...panel.proximos]}
      />
    </div>
  );
}
