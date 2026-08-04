"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { eliminarCancha } from "@/lib/actions/competencias.actions";

export function BotonEliminarCancha({ canchaId, nombre }: { canchaId: string; nombre: string }) {
  const [pendiente, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => {
        if (window.confirm(`¿Eliminar la cancha "${nombre}"?`)) {
          startTransition(async () => {
            const res = await eliminarCancha(canchaId);
            if (res.error) window.alert(res.error);
          });
        }
      }}
      className="p-1.5 text-slate-400 hover:text-red-500 transition disabled:opacity-40"
      aria-label={`Eliminar ${nombre}`}
    >
      {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
