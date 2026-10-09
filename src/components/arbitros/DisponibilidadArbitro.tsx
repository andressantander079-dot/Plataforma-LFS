"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarX, CircleAlert, Loader2, Plus, Trash2 } from "lucide-react";
import {
  eliminarBloqueDisponibilidad,
  guardarBloqueDisponibilidad,
  type MiBloqueUI,
} from "@/lib/actions/arbitros.actions";

/**
 * DISPONIBILIDAD DEL ÁRBITRO — marca los días que NO puede dirigir.
 * La liga los ve en rojo en la pantalla de designaciones.
 */
export function DisponibilidadArbitro({ bloques }: { bloques: MiBloqueUI[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const crear = (formData: FormData) => {
    setAviso(null);
    startTransition(async () => {
      const res = await guardarBloqueDisponibilidad(formData);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({ tipo: "ok", texto: "Bloque guardado: la liga ya lo ve al designar." });
        formRef.current?.reset();
      }
    });
  };

  const eliminar = (id: string) => {
    if (!window.confirm("¿Eliminar este bloque de no disponibilidad?")) return;
    startTransition(async () => {
      const res = await eliminarBloqueDisponibilidad(id);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Bloque eliminado." });
    });
  };

  const fmt = (fecha: string) =>
    new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      <div>
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <CalendarX className="w-4 h-4 text-[#F97316]" /> Días que NO podés dirigir
        </h3>
        <p className="text-[11px] text-slate-400 mt-0.5">
          La liga ve estos bloques en la pantalla de designaciones antes de asignarte un partido.
        </p>
      </div>

      {aviso && (
        <p
          className={`text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 ${
            aviso.tipo === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <CircleAlert className="w-4 h-4 shrink-0" /> {aviso.texto}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {bloques.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded-xl">
            No cargaste bloques: la liga entiende que estás siempre disponible.
          </p>
        )}
        {bloques.map((b) => (
          <div
            key={b.id}
            className="flex items-center gap-3 bg-red-50/60 border border-red-200 rounded-xl px-4 py-2.5"
          >
            <CalendarX className="w-4 h-4 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-red-800">
                {fmt(b.desde)} → {fmt(b.hasta)}
              </p>
              {b.motivo && <p className="text-[10px] text-red-600 truncate">{b.motivo}</p>}
            </div>
            <button
              onClick={() => eliminar(b.id)}
              disabled={pendiente}
              className="p-1.5 rounded-lg text-red-300 hover:text-red-700 hover:bg-red-100 transition shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form ref={formRef} action={crear} className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Desde
            </label>
            <input
              name="desde"
              type="date"
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Hasta
            </label>
            <input
              name="hasta"
              type="date"
              required
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
            />
          </div>
        </div>
        <input
          name="motivo"
          placeholder="Motivo (opcional): viaje, trabajo, lesión…"
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="w-full sm:w-56 py-2.5 rounded-xl bg-[#1A2A44] hover:bg-[#25375a] text-white font-black text-xs transition flex items-center justify-center gap-2"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Agregar bloque
        </button>
      </form>
    </div>
  );
}
