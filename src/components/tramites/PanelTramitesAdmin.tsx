"use client";

import { useState } from "react";
import { UserCheck, ArrowRightLeft, Clock } from "lucide-react";
import type { Bandeja, BandejaInscripcionesData } from "@/lib/actions/tramites.actions";
import { BandejaInscripciones } from "@/components/tramites/BandejaInscripciones";
import { BandejaTramites } from "@/components/tramites/BandejaTramites";

interface Props {
  bandejaPases: Bandeja;
  bandejaInscripciones: BandejaInscripcionesData;
  panelMercado?: React.ReactNode;
}

export function PanelTramitesAdmin({
  bandejaPases,
  bandejaInscripciones,
  panelMercado,
}: Props) {
  // Si hay inscripciones pendientes, arrancar en Inscripciones
  const [seccion, setSeccion] = useState<"inscripciones" | "pases">(
    bandejaInscripciones.kpis.pendientes > 0 ? "inscripciones" : "inscripciones"
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Selector de módulo de Trámites */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setSeccion("inscripciones")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            seccion === "inscripciones"
              ? "bg-[#1A2A44] text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <UserCheck className="w-4 h-4 text-[#F97316]" />
          <span>Inscripciones de Jugadores</span>
          {bandejaInscripciones.kpis.pendientes > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {bandejaInscripciones.kpis.pendientes} pendientes
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSeccion("pases")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition ${
            seccion === "pases"
              ? "bg-[#1A2A44] text-white shadow"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 text-[#F97316]" />
          <span>Pases y Transferencias</span>
          {bandejaPases.kpis.pendientesLiga > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-[#F97316] text-white text-[10px] font-black">
              {bandejaPases.kpis.pendientesLiga}
            </span>
          )}
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      {seccion === "inscripciones" && (
        <BandejaInscripciones data={bandejaInscripciones} />
      )}

      {seccion === "pases" && (
        <div className="flex flex-col gap-8">
          <BandejaTramites bandeja={bandejaPases} />
          {panelMercado}
        </div>
      )}
    </div>
  );
}

