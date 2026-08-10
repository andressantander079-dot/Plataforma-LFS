"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, MapPin, Loader2, AlertCircle, Check, Clock, ClipboardList } from "lucide-react";
import { cargarResultadoArbitro } from "@/lib/actions/competencias.actions";

/**
 * DESIGNACIÓN DEL ÁRBITRO
 * El árbitro ve sus partidos designados y carga el resultado.
 * El resultado queda PENDIENTE hasta que la federación lo confirme.
 */

export interface DesignacionUI {
  id: string;
  torneoNombre: string;
  homeNombre: string;
  awayNombre: string;
  scheduled_at: string | null;
  venueNombre: string | null;
  matchday: number | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result_confirmed: boolean;
}

function fechaLinda(iso: string | null): string {
  if (!iso) return "Sin día ni hora";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function DesignacionArbitro({ partido }: { partido: DesignacionUI }) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const yaJugado = partido.status === "jugado" || partido.status === "wo";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-[#F97316]">
          {partido.torneoNombre}
          {partido.matchday !== null && ` · Fecha ${partido.matchday}`}
        </span>
        {partido.result_confirmed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
            <Check className="w-3 h-3" /> Confirmado
          </span>
        )}
        {yaJugado && !partido.result_confirmed && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Esperando confirmación
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="font-bold text-[#1A2A44] text-right flex-1 truncate">{partido.homeNombre}</span>
        {partido.home_score !== null && partido.away_score !== null ? (
          <span className="shrink-0 font-black text-[#1A2A44] bg-slate-100 rounded-lg px-2.5 py-0.5">
            {partido.home_score} - {partido.away_score}
          </span>
        ) : (
          <span className="shrink-0 text-slate-400 font-bold text-xs">VS</span>
        )}
        <span className="font-bold text-[#1A2A44] flex-1 truncate">{partido.awayNombre}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" /> {fechaLinda(partido.scheduled_at)}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5" /> {partido.venueNombre ?? "Sin cancha"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!yaJugado && (
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#F97316] text-white hover:bg-[#F97316]/90 transition"
          >
            {abierto ? "Cancelar" : "Cargar resultado"}
          </button>
        )}
        <Link
          href={`/arbitro/planillas/${partido.id}`}
          className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg border border-[#1A2A44] text-[#1A2A44] hover:bg-[#1A2A44] hover:text-white transition"
        >
          <ClipboardList className="w-3.5 h-3.5" /> Planilla
        </Link>
      </div>

      {abierto && !yaJugado && (
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const res = await cargarResultadoArbitro(partido.id, formData);
              if (res.error) setError(res.error);
              else setAbierto(false);
            });
          }}
          className="flex flex-wrap items-end gap-2 bg-slate-50 rounded-xl p-3"
        >
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
            {partido.homeNombre}
            <input
              name="home_score"
              type="number"
              min={0}
              max={99}
              required
              className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
          </label>
          <span className="font-black text-slate-400 pb-2">—</span>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
            {partido.awayNombre}
            <input
              name="away_score"
              type="number"
              min={0}
              max={99}
              required
              className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
          </label>
          <button
            type="submit"
            disabled={pendiente}
            className="px-4 py-1.5 rounded-lg bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enviar resultado
          </button>
          <p className="w-full text-[10px] text-slate-400">
            El resultado queda pendiente: entra a la tabla cuando la federación lo confirme.
          </p>
          {error && (
            <p className="w-full text-xs font-semibold text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
