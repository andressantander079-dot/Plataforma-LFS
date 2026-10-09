"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Loader2,
  Volleyball,
} from "lucide-react";
import { obtenerMiCalendario, type DiaCalendarioUI } from "@/lib/actions/arbitros.actions";

/**
 * CALENDARIO DEL ÁRBITRO — mes a mes con TRES cosas reales vinculadas:
 * sus partidos designados, los eventos que carga la liga (capacitaciones,
 * congresos) y sus propios bloques de no disponibilidad.
 */
export function CalendarioArbitro({
  mesInicial,
  diasIniciales,
}: {
  mesInicial: string;
  diasIniciales: DiaCalendarioUI[];
}) {
  const [mes, setMes] = useState(mesInicial);
  const [dias, setDias] = useState(diasIniciales);
  const [pendiente, startTransition] = useTransition();

  const mover = (delta: number) => {
    const [anio, m] = mes.split("-").map(Number);
    const nuevo = new Date(anio, m - 1 + delta, 1);
    const nuevoMes = `${nuevo.getFullYear()}-${String(nuevo.getMonth() + 1).padStart(2, "0")}`;
    setMes(nuevoMes);
    startTransition(async () => {
      setDias(await obtenerMiCalendario(nuevoMes));
    });
  };

  const nombreMes = new Date(`${mes}-15T12:00:00`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => mover(-1)}
          disabled={pendiente}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="font-serif font-black text-[#1A2A44] capitalize flex items-center gap-2">
          {pendiente && <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />}
          {nombreMes}
        </p>
        <button
          onClick={() => mover(1)}
          disabled={pendiente}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {dias.length === 0 && !pendiente && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <Calendar className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="font-serif text-lg font-bold text-[#1A2A44]">Mes sin actividad</p>
          <p className="text-xs text-slate-500 mt-1">
            No tenés partidos, eventos ni bloques cargados este mes.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {dias.map((d) => {
          const fecha = new Date(`${d.fecha}T12:00:00`);
          return (
            <div
              key={d.fecha}
              className={`bg-white border rounded-2xl p-4 shadow-sm flex gap-3.5 ${
                d.bloqueado ? "border-red-200 bg-red-50/40" : "border-slate-200"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  d.bloqueado ? "bg-red-100 text-red-600" : "bg-orange-50 text-[#F97316]"
                }`}
              >
                <span className="text-base font-black leading-none">{fecha.getDate()}</span>
                <span className="text-[8px] font-bold uppercase">
                  {fecha.toLocaleDateString("es-AR", { weekday: "short" })}
                </span>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {d.bloqueado && (
                  <p className="text-[11px] font-bold text-red-700 flex items-center gap-1.5">
                    <CalendarX className="w-3.5 h-3.5" /> No disponible: {d.bloqueado}
                  </p>
                )}
                {d.partidos.map((p) => (
                  <Link
                    key={p.id}
                    href={`/arbitro/planillas/${p.id}`}
                    className="flex items-center gap-2 text-xs hover:text-[#F97316] transition group"
                  >
                    <Volleyball className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                    <span className="font-bold text-[#1A2A44] group-hover:text-[#F97316]">
                      {p.hora ? `${p.hora} · ` : ""}
                      {p.descripcion}
                    </span>
                    <span className="text-slate-400 truncate">· {p.torneo}</span>
                  </Link>
                ))}
                {d.eventos.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 text-xs">
                    <GraduationCap className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#1A2A44] flex items-center gap-1.5 flex-wrap">
                        {e.hora ? `${e.hora} · ` : ""}
                        {e.titulo}
                        {e.obligatorio && (
                          <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 flex items-center gap-0.5">
                            <AlertTriangle className="w-2 h-2" /> OBLIGATORIO
                          </span>
                        )}
                      </p>
                      {e.descripcion && <p className="text-slate-500">{e.descripcion}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
