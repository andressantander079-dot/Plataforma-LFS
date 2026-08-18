"use client";

import { useState, useTransition } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { generarPlayoffs } from "@/lib/actions/competencias.actions";

/**
 * Botón que genera la primera llave de playoff (semifinales/cuartos/final)
 * a partir de la tabla de la fase regular. Solo para formatos con playoff.
 */
export function BotonGenerarPlayoffs({
  competitionId,
  faseRegularCompleta,
}: {
  competitionId: string;
  faseRegularCompleta: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={pendiente || !faseRegularCompleta}
        onClick={() => {
          if (
            window.confirm(
              "¿Generar las llaves de playoff? Se toman los clasificados de la tabla y se sortean los cruces. No se puede deshacer."
            )
          ) {
            setError(null);
            startTransition(async () => {
              const res = await generarPlayoffs(competitionId);
              if (res.error) setError(res.error);
            });
          }
        }}
        className="px-6 py-3 rounded-xl bg-[#1A2A44] text-white text-sm font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-40 shadow-md flex items-center gap-2"
      >
        {pendiente ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <GitBranch className="w-4 h-4" />
        )}
        Generar llaves de playoff
      </button>
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
      {!faseRegularCompleta && (
        <p className="text-xs text-slate-400">
          Se habilita cuando todos los partidos de la fase regular estén confirmados.
        </p>
      )}
    </div>
  );
}
