"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback } from "react";
import {
  Flag,
  Printer,
  Radio,
  ShieldCheck,
  Trophy,
  UserX,
} from "lucide-react";
import type { PlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import { finalizarPartido } from "@/lib/actions/planilla-en-vivo.actions";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import { RelojEnVivo } from "@/components/planilla-vivo/RelojEnVivo";
import { ConfiguracionInicial } from "@/components/planilla-vivo/ConfiguracionInicial";
import {
  AccionesRapidas,
  PanelFaltas,
  TimelineEventos,
} from "@/components/planilla-vivo/AccionesRapidas";
import { ModalCambio } from "@/components/planilla-vivo/ModalCambio";
import { ModalAusenciaSuspension } from "@/components/planilla-vivo/ModalAusenciaSuspension";
import { WizardCierre } from "@/components/planilla-vivo/WizardCierre";
import { formatearMinuto, marcadorDesdeEventos } from "@/lib/core/rules/planillaPremiumRules";
import { sonarBeep } from "@/components/transmision/sonidos";
import { segundosRestantes, type EstadoReloj } from "@/lib/core/rules/relojRules";

/**
 * PANEL PRINCIPAL DE LA PLANILLA EN VIVO — Paso 17C
 * Orquesta todo: configuración previa, reloj, acciones rápidas,
 * entretiempo con bloqueo, cierre premium y estados finales.
 * Multi-oficial: los cambios del otro oficial llegan por realtime.
 */
export function PlanillaEnVivoPanel({ planilla }: { planilla: PlanillaEnVivo }) {
  const router = useRouter();
  const [modalCambio, setModalCambio] = useState(false);
  const [modalAusencia, setModalAusencia] = useState(false);
  const [wizardAbierto, setWizardAbierto] = useState(false);
  const [confirmarFin, setConfirmarFin] = useState(false);

  // ---- Realtime multi-oficial: si otro oficial toca algo, refresco ----
  useEffect(() => {
    const supabase = createLfsClient();
    const canal = supabase
      .channel(`planilla-vivo-${planilla.matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events", filter: `match_id=eq.${planilla.matchId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${planilla.matchId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_sheets", filter: `match_id=eq.${planilla.matchId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [planilla.matchId, router]);

  const estadoReloj: EstadoReloj = {
    fase: planilla.liveStatus,
    corriendo: planilla.relojCorriendo,
    iniciadoAt: planilla.relojIniciadoAt,
    segundosBase: planilla.relojSegundosBase,
    duracionTiempoMin: planilla.duracionTiempoMin,
    duracionEntretiempoMin: planilla.duracionEntretiempoMin,
  };

  const marcador = marcadorDesdeEventos(
    planilla.eventos.map((e) => ({ tipo: e.tipo, teamId: e.teamId, playerId: e.playerId })),
    planilla.homeTeamId,
    planilla.awayTeamId
  );
  const golesLocal = planilla.liveStatus === "sin_iniciar" ? 0 : marcador.local;
  const golesVisitante = planilla.liveStatus === "sin_iniciar" ? 0 : marcador.visitante;

  const enPreparacion =
    planilla.liveStatus === "sin_iniciar" || planilla.liveStatus === "pre_partido";
  const enJuego =
    planilla.liveStatus === "primer_tiempo" ||
    planilla.liveStatus === "segundo_tiempo" ||
    planilla.liveStatus === "entretiempo";
  const finalizado = planilla.liveStatus === "finalizado";

  const finalizar = async () => {
    const res = await finalizarPartido(planilla.matchId);
    if (res.error) alert(res.error);
    else {
      setConfirmarFin(false);
      setWizardAbierto(true);
    }
    router.refresh();
  };

  // Entretiempo: aviso sonoro cuando quedan 30 segundos
  useEffect(() => {
    if (planilla.liveStatus !== "entretiempo") return;
    const id = setInterval(() => {
      const restantes = segundosRestantes(estadoReloj, Date.now());
      if (restantes === 30) sonarBeep();
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planilla.liveStatus, planilla.relojCorriendo, planilla.relojIniciadoAt]);

  return (
    <div className="flex flex-col gap-4">
      {/* MARCADOR */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-3 items-center px-4 py-4">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="w-10 h-10 rounded-2xl shadow-inner"
              style={{ backgroundColor: planilla.colorLocal ?? "#1A2A44" }}
            />
            <span className="font-bold text-xs text-center text-slate-700 leading-tight">
              {planilla.local}
            </span>
          </div>
          <div className="text-center">
            <span className="font-mono text-5xl font-black text-[#1A2A44] tabular-nums">
              {finalizado ? (planilla.homeScore ?? 0) : golesLocal} -{" "}
              {finalizado ? (planilla.awayScore ?? 0) : golesVisitante}
            </span>
            {finalizado && (
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                Final
              </p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="w-10 h-10 rounded-2xl shadow-inner"
              style={{ backgroundColor: planilla.colorVisitante ?? "#F97316" }}
            />
            <span className="font-bold text-xs text-center text-slate-700 leading-tight">
              {planilla.visitante}
            </span>
          </div>
        </div>
        {(planilla.statusPartido === "wo" || planilla.statusPartido === "suspendido") && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2.5 text-center text-xs font-bold text-red-700">
            {planilla.statusPartido === "wo"
              ? `Ausencia (gana el rival): ${planilla.ausenteTeamId === planilla.homeTeamId ? planilla.local : planilla.visitante} no se presentó`
              : "Partido suspendido"}
            {planilla.motivoEstado ? ` — ${planilla.motivoEstado}` : ""}
          </div>
        )}
      </div>

      {/* CONTENIDO SEGÚN FASE */}
      {enPreparacion && <ConfiguracionInicial planilla={planilla} />}

      {enJuego && (
        <>
          <RelojEnVivo
            matchId={planilla.matchId}
            estado={estadoReloj}
            puedeControlar={planilla.puedeCargar}
          />

          {planilla.liveStatus === "entretiempo" ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center flex flex-col items-center gap-2">
              <span className="text-3xl">☕</span>
              <p className="font-black text-amber-800">ENTRETIEMPO</p>
              <p className="text-xs text-amber-700">
                La carga de eventos está pausada. Cuando suene la alarma, arrancá el segundo
                tiempo desde el reloj.
              </p>
            </div>
          ) : (
            <AccionesRapidas planilla={planilla} onCambio={() => setModalCambio(true)} />
          )}

          <PanelFaltas planilla={planilla} />
          <TimelineEventos planilla={planilla} />

          {planilla.puedeCerrar && (
            <div className="flex flex-col gap-2">
              {!confirmarFin ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmarFin(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-[#1A2A44] hover:bg-[#24355a] text-white font-bold text-sm rounded-xl py-3.5 transition-colors"
                  >
                    <Flag className="w-4 h-4" /> Finalizar partido
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalAusencia(true)}
                    className="inline-flex items-center justify-center gap-2 border-2 border-red-300 text-red-600 hover:bg-red-50 font-bold text-sm rounded-xl px-4 py-3.5 transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    <span className="hidden sm:inline">Ausencia / Suspensión</span>
                  </button>
                </div>
              ) : (
                <div className="bg-[#1A2A44] rounded-2xl p-4 flex flex-col gap-3">
                  <p className="text-white font-bold text-sm text-center">
                    ¿Finalizar el partido con {golesLocal} - {golesVisitante}? Después vas a
                    cerrar la planilla con las firmas.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmarFin(false)}
                      className="flex-1 rounded-xl bg-white/10 text-white font-bold text-sm py-2.5 hover:bg-white/20 transition-colors"
                    >
                      Seguir jugando
                    </button>
                    <button
                      type="button"
                      onClick={finalizar}
                      className="flex-1 rounded-xl bg-[#F97316] text-white font-black text-sm py-2.5 hover:bg-[#ea6a0a] transition-colors"
                    >
                      Sí, finalizar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {finalizado && (
        <div className="flex flex-col gap-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
            <Trophy className="w-8 h-8 text-green-600" />
            <p className="font-black text-green-800">Partido finalizado</p>
            {planilla.figuraNombre && (
              <p className="text-sm font-bold text-amber-700">
                ⭐ Figura del partido: {planilla.figuraNombre}
              </p>
            )}
            {!planilla.cerradaAt && planilla.puedeCerrar && planilla.statusPartido === "jugado" && (
              <button
                type="button"
                onClick={() => setWizardAbierto(true)}
                className="mt-2 inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#ea6a0a] text-white font-black text-sm rounded-xl px-6 py-3 transition-colors"
              >
                <ShieldCheck className="w-4 h-4" /> Cerrar la planilla (firmas)
              </button>
            )}
            {planilla.cerradaAt && (
              <p className="text-xs text-green-700">
                Planilla cerrada y enviada a la federación.{" "}
                <Link href={`/planilla-oficial/${planilla.matchId}`} className="underline font-bold">
                  Ver / imprimir la planilla oficial
                </Link>
              </p>
            )}
          </div>

          <Link
            href={`/en-vivo/${planilla.matchId}`}
            target="_blank"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 text-slate-600 font-bold text-sm py-3 hover:bg-slate-50 transition-colors"
          >
            <Radio className="w-4 h-4 text-red-500" /> Ver cómo la vive el público
          </Link>

          <TimelineEventos planilla={planilla} />

          {planilla.observaciones && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">
                Observaciones
              </p>
              <p className="text-sm text-yellow-900 italic">{planilla.observaciones}</p>
            </div>
          )}

          <Link
            href={`/planilla-oficial/${planilla.matchId}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1A2A44] text-white font-bold text-sm py-3 hover:bg-[#24355a] transition-colors"
          >
            <Printer className="w-4 h-4" /> Planilla oficial imprimible
          </Link>
        </div>
      )}

      {/* MODALES */}
      {modalCambio && <ModalCambio planilla={planilla} onCerrar={() => setModalCambio(false)} />}
      {modalAusencia && (
        <ModalAusenciaSuspension planilla={planilla} onCerrar={() => setModalAusencia(false)} />
      )}
      {wizardAbierto && (
        <WizardCierre planilla={planilla} onCerrar={() => setWizardAbierto(false)} />
      )}

      {/* Minuto de referencia para el árbitro */}
      {enJuego && planilla.liveStatus !== "entretiempo" && (
        <p className="text-center text-[11px] text-slate-400">
          Los eventos se guardan con el minuto del reloj ({formatearMinuto(
            Math.min(
              planilla.duracionTiempoMin,
              Math.floor(
                (planilla.duracionTiempoMin * 60 -
                  segundosRestantes(estadoReloj, Date.now())) /
                  60
              ) + 1
            ),
            planilla.liveStatus === "segundo_tiempo" ? "ST" : "PT"
          )})
        </p>
      )}
    </div>
  );
}
