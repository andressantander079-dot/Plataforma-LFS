"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { crearVentana, eliminarVentana } from "@/lib/actions/pases.actions";

export interface VentanaUI {
  id: string;
  nombre: string;
  fecha_desde: string;
  fecha_hasta: string;
}

/** Mercado de pases: el admin abre ventanas (desde/hasta) y las puede borrar. */
export function FormularioVentana({ ventanas }: { ventanas: VentanaUI[] }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";
  const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {ventanas.map((v) => {
          const abiertaHoy = v.fecha_desde <= hoy && hoy <= v.fecha_hasta;
          return (
            <div
              key={v.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                abiertaHoy ? "border-green-200 bg-green-50/50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[#1A2A44]">{v.nombre}</p>
                <p className="text-[11px] text-slate-500">
                  {new Date(v.fecha_desde + "T12:00:00").toLocaleDateString("es-AR")} →{" "}
                  {new Date(v.fecha_hasta + "T12:00:00").toLocaleDateString("es-AR")}
                  {abiertaHoy && (
                    <span className="ml-2 text-[10px] font-black text-green-700 uppercase">
                      ● Abierta ahora
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={pendiente}
                onClick={() => {
                  if (!window.confirm(`¿Eliminar la ventana "${v.nombre}"?`)) return;
                  setError(null);
                  startTransition(async () => {
                    const res = await eliminarVentana(v.id);
                    if (res.error) setError(res.error);
                  });
                }}
                className="text-slate-300 hover:text-red-500 transition shrink-0"
                title="Eliminar ventana"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {ventanas.length === 0 && (
          <p className="text-xs text-slate-400">
            No hay ventanas cargadas. Sin ventana abierta, los clubes no pueden iniciar pases.
          </p>
        )}
      </div>

      {!abierto ? (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="self-start px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Nueva ventana
        </button>
      ) : (
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const res = await crearVentana(formData);
              if (res.error) setError(res.error);
              else setAbierto(false);
            });
          }}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          <label className={CLASE_LABEL}>
            Nombre
            <input name="nombre" required placeholder="Mercado de Verano 2026" className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Desde
            <input name="fecha_desde" type="date" required className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Hasta
            <input name="fecha_hasta" type="date" required className={CLASE_INPUT} />
          </label>
          {error && (
            <p className="sm:col-span-3 text-xs font-semibold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          <div className="sm:col-span-3 flex gap-2">
            <button
              type="submit"
              disabled={pendiente}
              className="px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Crear ventana
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
      )}

      {error && !abierto && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
