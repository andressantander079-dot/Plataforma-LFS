"use client";

import { useState, useTransition } from "react";
import { Play, Flag, Trash2, Loader2 } from "lucide-react";
import { cambiarEstadoTorneo, eliminarTorneo } from "@/lib/actions/competencias.actions";
import { useRouter } from "next/navigation";

/** Acciones del torneo: activar, finalizar o eliminar (admin). */
export function AccionesTorneo({
  competitionId,
  estado,
}: {
  competitionId: string;
  estado: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cambiarEstado(nuevo: string) {
    setError(null);
    startTransition(async () => {
      const res = await cambiarEstadoTorneo(competitionId, nuevo);
      if (res.error) setError(res.error);
    });
  }

  function eliminar() {
    if (
      !window.confirm(
        "¿Eliminar el torneo completo? Se borran equipos inscriptos, fixture y resultados. No se puede deshacer."
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarTorneo(competitionId);
      if (res.error) setError(res.error);
      else router.push("/admin/competencias");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {estado === "borrador" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => cambiarEstado("en_curso")}
          className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Activar torneo
        </button>
      )}
      {estado === "en_curso" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => cambiarEstado("finalizado")}
          className="px-4 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Flag className="w-3.5 h-3.5" />}
          Finalizar torneo
        </button>
      )}
      <button
        type="button"
        disabled={pendiente}
        onClick={eliminar}
        className="px-4 py-2 rounded-xl border border-red-300 text-red-600 text-xs font-bold hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1.5"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Eliminar
      </button>
      {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
    </div>
  );
}
