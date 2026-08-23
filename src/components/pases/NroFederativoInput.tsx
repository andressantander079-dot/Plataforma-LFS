"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, AlertCircle } from "lucide-react";
import { guardarNroFederativo } from "@/lib/actions/pases.actions";

/** Campo opcional: número de pase federativo (Comet/AFA) como referencia. */
export function NroFederativoInput({
  transferId,
  valorActual,
}: {
  transferId: string;
  valorActual: string | null;
}) {
  const [valor, setValor] = useState(valorActual ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setOk(false);
          }}
          placeholder="Ej: AFA-2026-12345 (opcional)"
          className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 flex-1"
        />
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await guardarNroFederativo(transferId, valor);
              if (res.error) setError(res.error);
              else setOk(true);
            });
          }}
          className="px-3.5 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-4 h-4" />}
          {ok ? "¡Guardado!" : "Guardar"}
        </button>
      </div>
      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
