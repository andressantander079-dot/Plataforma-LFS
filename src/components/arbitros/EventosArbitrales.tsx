"use client";

import { useRef, useState, useTransition } from "react";
import { CalendarPlus, CircleAlert, Loader2, Trash2, AlertTriangle } from "lucide-react";
import {
  crearEventoArbitral,
  eliminarEventoArbitral,
  type EventoArbitralUI,
} from "@/lib/actions/arbitros.actions";

/**
 * EVENTOS ARBITRALES (admin) — capacitaciones, congresos y reuniones que la
 * liga carga para que aparezcan en el calendario de TODOS los árbitros.
 */
export function EventosArbitrales({ eventos }: { eventos: EventoArbitralUI[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const crear = (formData: FormData) => {
    setAviso(null);
    startTransition(async () => {
      const res = await crearEventoArbitral(formData);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({ tipo: "ok", texto: "Evento creado: ya aparece en el calendario de los árbitros." });
        formRef.current?.reset();
      }
    });
  };

  const eliminar = (id: string, titulo: string) => {
    if (!window.confirm(`¿Eliminar el evento "${titulo}"?`)) return;
    startTransition(async () => {
      const res = await eliminarEventoArbitral(id);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Evento eliminado." });
    });
  };

  return (
    <div className="flex flex-col gap-4">
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
        {eventos.length === 0 && (
          <p className="text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 text-center">
            No hay eventos cargados. Cuando crees uno, aparece en el calendario de todos los árbitros.
          </p>
        )}
        {eventos.map((e) => (
          <div
            key={e.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-start gap-3"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 text-[#F97316] flex flex-col items-center justify-center shrink-0">
              <span className="text-sm font-black leading-none">{e.fecha.slice(8, 10)}</span>
              <span className="text-[8px] font-bold uppercase">{e.fecha.slice(5, 7)}/{e.fecha.slice(0, 4)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-[#1A2A44] flex items-center gap-2 flex-wrap">
                {e.titulo}
                {e.obligatorio && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                    <AlertTriangle className="w-2.5 h-2.5" /> OBLIGATORIO
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {e.hora ? `${e.hora} hs · ` : ""}
                {e.descripcion ?? ""}
              </p>
            </div>
            <button
              onClick={() => eliminar(e.id, e.titulo)}
              disabled={pendiente}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form
        ref={formRef}
        action={crear}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-3"
      >
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <CalendarPlus className="w-4 h-4 text-[#F97316]" /> Nuevo evento arbitral
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            name="titulo"
            required
            placeholder="Título (ej: Clínica de capacitación)"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="fecha"
              type="date"
              required
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
            />
            <input
              name="hora"
              type="time"
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
            />
          </div>
        </div>
        <textarea
          name="descripcion"
          rows={2}
          placeholder="Descripción (opcional): lugar, qué llevar, a quiénes aplica…"
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
        />
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input type="checkbox" name="obligatorio" className="w-4 h-4 accent-[#F97316]" />
          Es obligatorio para los árbitros
        </label>
        <button
          type="submit"
          disabled={pendiente}
          className="w-full sm:w-56 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-black text-xs transition flex items-center justify-center gap-2"
        >
          {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
          Publicar evento
        </button>
      </form>
    </div>
  );
}
