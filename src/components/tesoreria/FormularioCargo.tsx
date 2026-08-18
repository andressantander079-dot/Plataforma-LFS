"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Loader2, AlertCircle } from "lucide-react";
import { crearCargo } from "@/lib/actions/tesoreria.actions";
import { TIPO_CARGO_UI, TIPOS_CARGO_MANUALES } from "@/lib/core/tesoreria/money";

/** Formulario para que la tesorería cargue un cargo manual a un club. */
export function FormularioCargo({
  clubes,
  torneos,
}: {
  clubes: { id: string; nombre: string }[];
  torneos: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";
  const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5"
      >
        <PlusCircle className="w-4 h-4" /> Nuevo cargo
      </button>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await crearCargo(formData);
          if (res.error) setError(res.error);
          else {
            setOk(true);
            setAbierto(false);
          }
        });
      }}
      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <label className={CLASE_LABEL}>
        Club
        <select name="club_id" required className={CLASE_INPUT}>
          <option value="">Elegí un club…</option>
          {clubes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className={CLASE_LABEL}>
        Tipo de cargo
        <select name="tipo" required className={CLASE_INPUT}>
          {TIPOS_CARGO_MANUALES.map((t) => (
            <option key={t} value={t}>
              {TIPO_CARGO_UI[t]}
            </option>
          ))}
        </select>
      </label>

      <label className={`${CLASE_LABEL} sm:col-span-2`}>
        Descripción
        <input
          name="descripcion"
          required
          placeholder="Ej: Inscripción Torneo Apertura 2026 — Primera"
          className={CLASE_INPUT}
        />
      </label>

      <label className={CLASE_LABEL}>
        Monto ($)
        <input name="monto" type="number" min={1} step="0.01" required className={CLASE_INPUT} />
      </label>

      <label className={CLASE_LABEL}>
        Vencimiento (opcional)
        <input name="fecha_vencimiento" type="date" className={CLASE_INPUT} />
      </label>

      <label className={`${CLASE_LABEL} sm:col-span-2`}>
        Torneo relacionado (opcional)
        <select name="competition_id" className={CLASE_INPUT}>
          <option value="">Ninguno</option>
          {torneos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="sm:col-span-2 text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Cargar cargo
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:border-slate-400 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
