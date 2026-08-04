"use client";

import { useState, useTransition } from "react";
import { CalendarRange, Loader2 } from "lucide-react";
import { generarFixture } from "@/lib/actions/competencias.actions";

/** Botón que sortea y genera el fixture completo del torneo. */
export function BotonGenerarFixture({
  competitionId,
  cantidadEquipos,
}: {
  competitionId: string;
  cantidadEquipos: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pendiente || cantidadEquipos < 2}
        onClick={() => {
          if (
            window.confirm(
              `¿Generar el fixture para ${cantidadEquipos} equipos? Se sortean los cruces y se crean todos los partidos (si había un fixture previo sin resultados, se reemplaza).`
            )
          ) {
            setError(null);
            startTransition(async () => {
              const res = await generarFixture(competitionId);
              if (res.error) setError(res.error);
            });
          }
        }}
        className="px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#F97316]/90 transition disabled:opacity-40 shadow-md flex items-center gap-2"
      >
        {pendiente ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <CalendarRange className="w-4 h-4" />
        )}
        Generar fixture automático
      </button>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {cantidadEquipos < 2 && (
        <p className="text-xs text-slate-400">Necesitás al menos 2 equipos inscriptos.</p>
      )}
    </div>
  );
}
