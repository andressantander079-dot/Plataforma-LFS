"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BellRing,
  Calendar,
  Check,
  ChevronRight,
  CircleAlert,
  Loader2,
  MapPin,
  X,
} from "lucide-react";
import { responderDesignacion, type MiDesignacionUI } from "@/lib/actions/arbitros.actions";
import { debeResponder } from "@/lib/core/rules/arbitrosRules";

/**
 * DESIGNACIONES DEL ÁRBITRO — tres bandejas:
 *  1. Pendientes de respuesta (propuestas de la liga: ACEPTAR / RECHAZAR).
 *  2. Próximos partidos confirmados.
 *  3. Historial (jugados con resultado).
 */
export function TarjetasDesignacion({ designaciones }: { designaciones: MiDesignacionUI[] }) {
  const pendientes = designaciones.filter((d) =>
    debeResponder(d.designacion_modo, d.designacion_estado)
  );
  const proximos = designaciones.filter(
    (d) => d.status === "programado" && !pendientes.includes(d)
  );
  const historial = designaciones.filter((d) => d.status === "jugado" || d.status === "wo");

  return (
    <div className="flex flex-col gap-6">
      {pendientes.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
            <BellRing className="w-4 h-4 text-[#F97316]" />
            Esperan tu respuesta ({pendientes.length})
          </h2>
          {pendientes.map((d) => (
            <TarjetaPropuesta key={d.id} d={d} />
          ))}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44]">
          Próximos partidos ({proximos.length})
        </h2>
        {proximos.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white border border-slate-200 rounded-2xl p-6 text-center">
            No tenés partidos confirmados por delante.
          </p>
        ) : (
          proximos.map((d) => <FilaPartido key={d.id} d={d} />)
        )}
      </section>

      {historial.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold text-sm text-[#1A2A44]">Historial</h2>
          {historial.map((d) => (
            <FilaPartido key={d.id} d={d} conResultado />
          ))}
        </section>
      )}
    </div>
  );
}

function TarjetaPropuesta({ d }: { d: MiDesignacionUI }) {
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const responder = (aceptar: boolean) => {
    setAviso(null);
    startTransition(async () => {
      const res = await responderDesignacion(d.id, aceptar, motivo);
      if (res?.error) setAviso(res.error);
    });
  };

  return (
    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-[#F97316]/40 rounded-2xl p-5 flex flex-col gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-[#F97316]">
          {d.torneoNombre}
          {d.matchday ? ` · Fecha ${d.matchday}` : ""}
        </p>
        <p className="font-serif text-lg font-black text-[#1A2A44]">
          {d.homeNombre} <span className="text-slate-400 font-normal text-sm">vs</span> {d.awayNombre}
        </p>
        <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {d.scheduled_at
              ? new Date(d.scheduled_at).toLocaleString("es-AR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Fecha a confirmar"}
          </span>
          {d.venueNombre && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {d.venueNombre}
            </span>
          )}
        </p>
      </div>

      {rechazando && (
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          placeholder="Contanos el motivo del rechazo (obligatorio)…"
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60 bg-white"
        />
      )}

      {aviso && (
        <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
          <CircleAlert className="w-3.5 h-3.5" /> {aviso}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => responder(true)}
          disabled={pendiente}
          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm transition flex items-center justify-center gap-2"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Aceptar
        </button>
        {rechazando ? (
          <button
            onClick={() => responder(false)}
            disabled={pendiente || motivo.trim().length < 3}
            className="py-3 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black text-sm transition flex items-center justify-center gap-2"
          >
            {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Confirmar rechazo
          </button>
        ) : (
          <button
            onClick={() => setRechazando(true)}
            disabled={pendiente}
            className="py-3 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-black text-sm transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" /> Rechazar
          </button>
        )}
      </div>
    </div>
  );
}

function FilaPartido({ d, conResultado = false }: { d: MiDesignacionUI; conResultado?: boolean }) {
  const badge =
    d.designacion_modo === "propuesta" && d.designacion_estado === "aceptada" ? (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        Aceptada
      </span>
    ) : null;

  return (
    <Link
      href={`/arbitro/planillas/${d.id}`}
      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3 hover:border-[#F97316]/40 hover:shadow-md transition group"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {d.torneoNombre}
          {d.matchday ? ` · Fecha ${d.matchday}` : ""}
        </p>
        <p className="font-serif font-black text-[#1A2A44] text-sm truncate">
          {d.homeNombre} <span className="text-slate-400 font-normal">vs</span> {d.awayNombre}
          {conResultado && d.home_score != null && (
            <span className="ml-2 text-[#F97316]">
              {d.home_score} - {d.away_score}
            </span>
          )}
          {conResultado && d.status === "wo" && (
            <span className="ml-2 text-red-500 text-xs font-bold">W.O.</span>
          )}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">
          {d.scheduled_at
            ? new Date(d.scheduled_at).toLocaleString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "A programar"}
          {d.venueNombre ? ` · ${d.venueNombre}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
      </div>
    </Link>
  );
}
