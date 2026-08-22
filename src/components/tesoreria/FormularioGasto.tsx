"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { registrarGasto } from "@/lib/actions/tesoreria.actions";
import { CATEGORIA_GASTO_UI, CATEGORIAS_GASTO } from "@/lib/core/tesoreria/money";

/**
 * Formulario para que la tesorería registre un gasto de la liga.
 * Si la categoría es "devoluciones", obliga a elegir el club que recibió
 * la devolución (queda trazado para el contador).
 */
export function FormularioGasto({
  clubes,
}: {
  clubes: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [esDevolucion, setEsDevolucion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";
  const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

  const hoy = new Date().toISOString().slice(0, 10);

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            setOk(false);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Registrar gasto
        </button>
        {ok && (
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Gasto registrado correctamente.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await registrarGasto(formData);
          if (res.error) setError(res.error);
          else {
            setOk(true);
            setAbierto(false);
            setEsDevolucion(false);
          }
        });
      }}
      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <label className={CLASE_LABEL}>
        Categoría
        <select
          name="categoria"
          required
          className={CLASE_INPUT}
          onChange={(e) => setEsDevolucion(e.target.value === "devoluciones")}
        >
          {CATEGORIAS_GASTO.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA_GASTO_UI[c]}
            </option>
          ))}
        </select>
      </label>

      <label className={CLASE_LABEL}>
        Fecha del gasto
        <input name="fecha" type="date" defaultValue={hoy} required className={CLASE_INPUT} />
      </label>

      <label className={`${CLASE_LABEL} sm:col-span-2`}>
        Concepto
        <input
          name="concepto"
          required
          placeholder="Ej: Alquiler cancha UOM — fecha 6 del Apertura"
          className={CLASE_INPUT}
        />
      </label>

      <label className={CLASE_LABEL}>
        Monto ($)
        <input name="monto" type="number" min={1} step="0.01" required className={CLASE_INPUT} />
      </label>

      {esDevolucion && (
        <label className={CLASE_LABEL}>
          Club que recibió la devolución
          <select name="club_id" required className={CLASE_INPUT}>
            <option value="">Elegí el club…</option>
            {clubes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className={`${CLASE_LABEL} sm:col-span-2`}>
        Comprobante (foto o PDF, opcional — máx. 5 MB)
        <input
          name="comprobante"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1A2A44] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-[#1A2A44]/90"
        />
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
          Guardar gasto
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
