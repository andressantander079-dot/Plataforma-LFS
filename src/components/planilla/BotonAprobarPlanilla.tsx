"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Undo2 } from "lucide-react";
import { aprobarPlanilla, reabrirPlanilla } from "@/lib/actions/planilla.actions";

/** Acciones de la federación sobre la planilla: aprobar o reabrir. */
export function BotonAprobarPlanilla({
  matchId,
  status,
}: {
  matchId: string;
  status: string | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  function ejecutar(accion: () => Promise<{ ok?: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await accion();
      if (res.error) window.alert(res.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {status !== "aprobada" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (window.confirm("¿Aprobar la planilla? Los clubes podrán verla y descargarla.")) {
              ejecutar(() => aprobarPlanilla(matchId));
            }
          }}
          className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm rounded-2xl px-5 py-2.5 transition-colors shadow-sm"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Aprobar planilla
        </button>
      )}
      {status && status !== "borrador" && (
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            if (
              window.confirm(
                "¿Reabrir la planilla? Vuelve a estado de carga y los clubes podrán modificar sus convocatorias."
              )
            ) {
              ejecutar(() => reabrirPlanilla(matchId));
            }
          }}
          className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-600 font-bold text-sm rounded-2xl px-5 py-2.5 border border-slate-200 transition-colors"
        >
          <Undo2 className="w-4 h-4" /> Reabrir
        </button>
      )}
    </div>
  );
}
