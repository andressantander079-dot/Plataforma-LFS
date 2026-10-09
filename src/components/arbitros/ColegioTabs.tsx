"use client";

import { useState } from "react";
import { Award, Banknote, CalendarPlus, Users } from "lucide-react";
import { ColegioArbitros } from "./ColegioArbitros";
import { GestionNiveles } from "./GestionNiveles";
import { EventosArbitrales } from "./EventosArbitrales";
import { LiquidacionesArbitros } from "./LiquidacionesArbitros";
import type {
  EventoArbitralUI,
  LiquidacionUI,
  NivelArbitroUI,
  PadronArbitroUI,
} from "@/lib/actions/arbitros.actions";

type Tab = "padron" | "niveles" | "eventos" | "liquidaciones";

const TABS: Array<{ id: Tab; label: string; icono: React.ReactNode }> = [
  { id: "padron", label: "Padrón", icono: <Users className="w-3.5 h-3.5" /> },
  { id: "niveles", label: "Niveles y tarifas", icono: <Award className="w-3.5 h-3.5" /> },
  { id: "eventos", label: "Eventos", icono: <CalendarPlus className="w-3.5 h-3.5" /> },
  { id: "liquidaciones", label: "Honorarios", icono: <Banknote className="w-3.5 h-3.5" /> },
];

/**
 * COLEGIO DE ÁRBITROS con pestañas (admin):
 * Padrón · Niveles y tarifas · Eventos arbitrales · Honorarios (liquidaciones).
 */
export function ColegioTabs({
  padron,
  niveles,
  eventos,
  periodo,
  liquidaciones,
}: {
  padron: PadronArbitroUI[];
  niveles: NivelArbitroUI[];
  eventos: EventoArbitralUI[];
  periodo: string;
  liquidaciones: LiquidacionUI[];
}) {
  const [tab, setTab] = useState<Tab>("padron");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[110px] px-3 py-2.5 rounded-xl text-[11px] font-black transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
              tab === t.id
                ? "bg-white text-[#1A2A44] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.icono}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "padron" && <ColegioArbitros padron={padron} niveles={niveles} />}
      {tab === "niveles" && <GestionNiveles niveles={niveles} />}
      {tab === "eventos" && <EventosArbitrales eventos={eventos} />}
      {tab === "liquidaciones" && (
        <LiquidacionesArbitros periodoInicial={periodo} filasIniciales={liquidaciones} />
      )}
    </div>
  );
}
