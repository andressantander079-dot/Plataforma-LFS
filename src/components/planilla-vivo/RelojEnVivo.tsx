"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Coffee, FlagTriangleRight, Timer } from "lucide-react";
import {
  etiquetaFase,
  formatoReloj,
  llegoACero,
  segundosRestantes,
  type EstadoReloj,
} from "@/lib/core/rules/relojRules";
import {
  iniciarSegundoTiempo,
  pausarReloj,
  reanudarReloj,
  terminarPrimerTiempo,
} from "@/lib/actions/planilla-en-vivo.actions";
import { sonarSilbato } from "@/components/transmision/sonidos";

/**
 * RELOJ EN VIVO — Paso 17C
 * Cuenta regresiva descendente con pausa manual. Al llegar a cero suena
 * el silbato; el cambio de tiempo lo confirma el árbitro (nada se carga
 * automáticamente, el banco manda).
 */
export function RelojEnVivo({
  matchId,
  estado,
  puedeControlar,
}: {
  matchId: string;
  estado: EstadoReloj;
  puedeControlar: boolean;
}) {
  const router = useRouter();
  const [ahora, setAhora] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const sonoRef = useRef(false);

  const estadoKey = useMemo(
    () =>
      `${estado.fase}|${estado.corriendo}|${estado.iniciadoAt}|${estado.segundosBase}|${estado.duracionTiempoMin}|${estado.duracionEntretiempoMin}`,
    [estado]
  );

  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    sonoRef.current = false;
  }, [estadoKey]);

  const restantes = segundosRestantes(estado, ahora);
  const enCero = llegoACero(estado, ahora);

  useEffect(() => {
    if (enCero && estado.corriendo && !sonoRef.current) {
      sonoRef.current = true;
      sonarSilbato();
    }
  }, [enCero, estado.corriendo]);

  const accion = (fn: (id: string) => Promise<{ ok?: boolean; error?: string }>) => {
    startTransition(async () => {
      const res = await fn(matchId);
      if (res.error) alert(res.error);
      router.refresh();
    });
  };

  const enJuego = estado.fase === "primer_tiempo" || estado.fase === "segundo_tiempo";
  const esEntretiempo = estado.fase === "entretiempo";

  return (
    <div className="bg-[#1A2A44] text-white rounded-3xl shadow-xl overflow-hidden">
      <div className="px-5 py-4 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
              esEntretiempo
                ? "bg-amber-400/20 text-amber-300 border border-amber-400/40"
                : enJuego
                  ? "bg-green-400/15 text-green-300 border border-green-400/40"
                  : "bg-slate-500/20 text-slate-300 border border-slate-400/30"
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            {etiquetaFase(estado.fase)}
          </span>
          {estado.corriendo && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Reloj corriendo" />
          )}
        </div>

        <div
          className={`font-mono text-6xl md:text-7xl font-black tracking-tight tabular-nums ${
            enCero ? "text-red-400 animate-pulse" : "text-white"
          }`}
        >
          {formatoReloj(restantes)}
        </div>

        {enCero && enJuego && (
          <p className="text-red-300 text-xs font-bold uppercase tracking-widest animate-pulse">
            ¡Tiempo cumplido! Confirmá el cambio
          </p>
        )}

        {puedeControlar && (
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {enJuego && (
              <button
                type="button"
                disabled={pending}
                onClick={() => accion(estado.corriendo ? pausarReloj : reanudarReloj)}
                className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
              >
                {estado.corriendo ? (
                  <>
                    <Pause className="w-4 h-4" /> Pausar
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" /> Reanudar
                  </>
                )}
              </button>
            )}
            {estado.fase === "primer_tiempo" && (
              <button
                type="button"
                disabled={pending}
                onClick={() => accion(terminarPrimerTiempo)}
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
              >
                <Coffee className="w-4 h-4" /> Terminar 1er tiempo
              </button>
            )}
            {esEntretiempo && (
              <button
                type="button"
                disabled={pending}
                onClick={() => accion(iniciarSegundoTiempo)}
                className="inline-flex items-center gap-1.5 bg-[#F97316] hover:bg-[#ea6a0a] text-white font-bold text-xs rounded-xl px-4 py-2.5 transition-colors disabled:opacity-50"
              >
                <FlagTriangleRight className="w-4 h-4" /> Arrancar 2do tiempo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
