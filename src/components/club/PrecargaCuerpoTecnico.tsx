"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardEdit, Loader2 } from "lucide-react";
import { precargarCuerpoTecnico } from "@/lib/actions/planilla-en-vivo.actions";

/**
 * PRECARGA DEL CUERPO TÉCNICO (club) — Paso 17C
 * El club deja cargados su DT y ayudante antes del partido; el árbitro
 * después los confirma o corrige en cancha, y esos nombres salen
 * impresos en la planilla debajo de la firma.
 */
export function PrecargaCuerpoTecnico({
  matchId,
  dtInicial,
  ayudanteInicial,
}: {
  matchId: string;
  dtInicial: string;
  ayudanteInicial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dt, setDt] = useState(dtInicial);
  const [ayudante, setAyudante] = useState(ayudanteInicial);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const guardar = () => {
    startTransition(async () => {
      const res = await precargarCuerpoTecnico(matchId, { dt, ayudante });
      if (res.error) {
        alert(res.error);
        return;
      }
      setMensaje("¡Listo! El árbitro lo confirma antes de empezar el partido.");
      setTimeout(() => setMensaje(null), 4000);
      router.refresh();
    });
  };

  const inputClase =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316] outline-none";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
      <h4 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
        <ClipboardEdit className="w-4 h-4 text-[#F97316]" />
        Cuerpo técnico para la planilla
      </h4>
      <p className="text-xs text-slate-500">
        Cargá quién dirige hoy: estos nombres van impresos en la planilla oficial debajo de la
        firma.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
          DT (firma la planilla)
          <input
            value={dt}
            onChange={(e) => setDt(e.target.value)}
            disabled={pending}
            placeholder="Nombre y apellido"
            className={inputClase}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
          Ayudante de campo
          <input
            value={ayudante}
            onChange={(e) => setAyudante(e.target.value)}
            disabled={pending}
            placeholder="Opcional"
            className={inputClase}
          />
        </label>
      </div>
      {mensaje && <p className="text-xs font-bold text-green-700">{mensaje}</p>}
      <button
        type="button"
        disabled={pending || !dt.trim()}
        onClick={guardar}
        className="self-start inline-flex items-center gap-2 text-xs font-bold bg-[#1A2A44] text-white rounded-xl px-4 py-2 hover:bg-[#24355a] disabled:bg-slate-300 transition-colors"
      >
        {pending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Guardar cuerpo técnico
      </button>
    </div>
  );
}
