"use client";

import { useState, useTransition } from "react";
import { BellRing, Check, Loader2, MapPin, X } from "lucide-react";
import { responderDesignacionOficial } from "@/lib/actions/planilla-en-vivo.actions";

/** Propuesta pendiente del oficial (2do árbitro o planillero), Paso 17C. */
export type PropuestaOficialUI = {
  id: string;
  rol: "segundo_arbitro" | "planillero";
  matchId: string;
  local: string;
  visitante: string;
  fecha: string | null;
  cancha: string | null;
};

const ETIQUETA_ROL: Record<PropuestaOficialUI["rol"], string> = {
  segundo_arbitro: "2do Árbitro",
  planillero: "Planillero",
};

/**
 * PROPUESTAS DE OFICIAL (Paso 17C) — cuando la liga te propone como
 * 2do árbitro o planillero de un partido, respondés acá: aceptar o rechazar.
 * Si aceptás, ya podés cargar eventos en la planilla en vivo.
 */
export function PropuestasOficiales({ propuestas }: { propuestas: PropuestaOficialUI[] }) {
  if (propuestas.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
        <BellRing className="w-4 h-4 text-[#F97316]" />
        Te propusieron como oficial ({propuestas.length})
      </h2>
      {propuestas.map((p) => (
        <TarjetaPropuestaOficial key={p.id} p={p} />
      ))}
    </section>
  );
}

function TarjetaPropuestaOficial({ p }: { p: PropuestaOficialUI }) {
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [resuelto, setResuelto] = useState<"aceptada" | "rechazada" | null>(null);

  const fechaTxt = p.fecha
    ? new Date(p.fecha).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Ushuaia",
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Fecha a confirmar";

  const responder = (aceptar: boolean) => {
    setAviso(null);
    startTransition(async () => {
      const r = await responderDesignacionOficial(p.id, aceptar);
      if (r.error) {
        setAviso(r.error);
        return;
      }
      setResuelto(aceptar ? "aceptada" : "rechazada");
    });
  };

  if (resuelto) {
    return (
      <div
        className={`rounded-2xl border p-4 text-sm font-semibold ${
          resuelto === "aceptada"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-50 text-slate-500"
        }`}
      >
        {resuelto === "aceptada"
          ? `✅ Aceptaste ser ${ETIQUETA_ROL[p.rol]} de ${p.local} vs ${p.visitante}. ¡Nos vemos en la cancha!`
          : `Rechazaste la propuesta de ${p.local} vs ${p.visitante}. La liga ya lo sabe.`}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="font-bold text-[#1A2A44] text-sm">
            {p.local} <span className="text-slate-400 font-normal">vs</span> {p.visitante}
          </p>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{fechaTxt} hs</span>
            {p.cancha && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {p.cancha}
              </span>
            )}
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">
          {ETIQUETA_ROL[p.rol]}
        </span>
      </div>

      {aviso && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {aviso}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => responder(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 transition disabled:opacity-50"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Aceptar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => responder(false)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-sm font-bold px-4 py-2.5 transition disabled:opacity-50"
        >
          <X className="w-4 h-4" />
          Rechazar
        </button>
      </div>
    </div>
  );
}
