"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, ArrowRightLeft, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import type { ConvocadoVivo, PlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import {
  deshacerUltimoEvento,
  pedirTiempoMuerto,
  registrarEventoEnVivo,
} from "@/lib/actions/planilla-en-vivo.actions";
import {
  esDobleAmarilla,
  faltasAcumuladas,
  formatearMinuto,
  jugadorExpulsado,
  nivelFaltas,
  puedePedirTiempo,
  tiemposPedidosUsados,
  type EventoBase,
} from "@/lib/core/rules/planillaPremiumRules";
import { sonarBeep, sonarGol } from "@/components/transmision/sonidos";

/**
 * ACCIONES RÁPIDAS DEL PARTIDO — Paso 17C
 * Botones grandes para cargar gol (con asistencia), tarjetas, falta,
 * cambio rápido (sale + entra en un paso) y tiempo pedido. Con alertas
 * en caliente: doble amarilla y 5ta falta acumulada.
 */

type AccionTipo = "gol" | "gol_en_contra" | "amarilla" | "roja" | "falta";

export function AccionesRapidas({
  planilla,
  onCambio,
}: {
  planilla: PlanillaEnVivo;
  onCambio: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modal, setModal] = useState<{ tipo: AccionTipo; teamId: string } | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [asistenteId, setAsistenteId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; grave: boolean } | null>(null);

  const eventosBase: EventoBase[] = useMemo(
    () =>
      planilla.eventos.map((e) => ({
        tipo: e.tipo,
        teamId: e.teamId,
        playerId: e.playerId,
        tiempo: e.tiempo,
      })),
    [planilla.eventos]
  );

  const faltas = useMemo(
    () => faltasAcumuladas(eventosBase, planilla.homeTeamId, planilla.awayTeamId),
    [eventosBase, planilla.homeTeamId, planilla.awayTeamId]
  );
  const tiemposUsados = useMemo(
    () => tiemposPedidosUsados(eventosBase, planilla.homeTeamId, planilla.awayTeamId),
    [eventosBase, planilla.homeTeamId, planilla.awayTeamId]
  );

  const tiempoActual: "PT" | "ST" = planilla.liveStatus === "segundo_tiempo" ? "ST" : "PT";
  const faltasLocal = faltas.local[tiempoActual];
  const faltasVisitante = faltas.visitante[tiempoActual];

  const mostrarAviso = (texto: string, grave: boolean) => {
    setAviso({ texto, grave });
    setTimeout(() => setAviso(null), 4000);
  };

  const confirmarEvento = () => {
    if (!modal || !playerId) return;
    const { tipo, teamId } = modal;
    startTransition(async () => {
      const res = await registrarEventoEnVivo(planilla.matchId, {
        tipo,
        teamId,
        playerId,
        asistenteId: tipo === "gol" ? asistenteId : null,
      });
      if (res.error) {
        alert(res.error);
        return;
      }
      if (tipo === "gol") sonarGol();
      if (res.alertas?.dobleAmarilla) {
        mostrarAviso("⚠️ Segunda amarilla para este jugador: corresponde la ROJA. Cargala ahora.", true);
      } else if (tipo === "falta" && res.alertas && res.alertas.nivelFaltas !== "normal") {
        mostrarAviso(
          res.alertas.nivelFaltas === "limite"
            ? `🚨 ¡${res.alertas.faltasEquipo} faltas acumuladas! Desde acá, tiro libre sin barrera.`
            : `⚠️ ${res.alertas.faltasEquipo} faltas acumuladas: la próxima es sin barrera.`,
          res.alertas.nivelFaltas === "limite"
        );
      }
      setModal(null);
      setPlayerId(null);
      setAsistenteId(null);
      onCambio();
      router.refresh();
    });
  };

  const pedirTiempo = (teamId: string, nombreEquipo: string) => {
    startTransition(async () => {
      const res = await pedirTiempoMuerto(planilla.matchId, teamId);
      if (res.error) {
        alert(res.error);
        return;
      }
      mostrarAviso(`⏱️ Tiempo pedido por ${nombreEquipo}: 60 segundos.`, false);
      sonarBeep();
      onCambio();
      router.refresh();
    });
  };

  const deshacer = () => {
    startTransition(async () => {
      const res = await deshacerUltimoEvento(planilla.matchId);
      if (res.error) alert(res.error);
      else mostrarAviso(`↩️ Se deshizo: ${res.descripcion}`, false);
      onCambio();
      router.refresh();
    });
  };

  const convocadosDel = (teamId: string) =>
    planilla.convocados.filter((c) => c.teamId === teamId);

  const botonEquipo = (teamId: string, nombre: string, color: string | null) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: color ?? "#1A2A44" }}>
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: color ?? "#1A2A44" }} />
          {nombre}
        </h4>
        <span
          className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
            nivelFaltas(teamId === planilla.homeTeamId ? faltasLocal : faltasVisitante) === "limite"
              ? "bg-red-100 text-red-700 animate-pulse"
              : nivelFaltas(teamId === planilla.homeTeamId ? faltasLocal : faltasVisitante) === "aviso"
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-500"
          }`}
        >
          Faltas: {teamId === planilla.homeTeamId ? faltasLocal : faltasVisitante}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={() => setModal({ tipo: "gol", teamId })}
          className="rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          ⚽ GOL
        </button>
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={() => setModal({ tipo: "amarilla", teamId })}
          className="rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-black text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          🟨 Amon.
        </button>
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={() => setModal({ tipo: "roja", teamId })}
          className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          🟥 Roja
        </button>
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={() => setModal({ tipo: "falta", teamId })}
          className="rounded-xl bg-slate-600 hover:bg-slate-700 text-white font-black text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          Falta
        </button>
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={() => setModal({ tipo: "gol_en_contra", teamId })}
          className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          E/C
        </button>
        <button
          type="button"
          disabled={
            pending ||
            !planilla.puedeCargar ||
            !puedePedirTiempo(eventosBase, teamId, tiempoActual)
          }
          onClick={() => pedirTiempo(teamId, nombre)}
          className="rounded-xl bg-[#1A2A44] hover:bg-[#24355a] text-white font-black text-sm py-3 transition-colors disabled:bg-slate-300"
          title={
            puedePedirTiempo(eventosBase, teamId, tiempoActual)
              ? "Pedir tiempo (60 segundos)"
              : "Ya usó su tiempo en este tiempo de juego"
          }
        >
          ⏱️ Tiempo ({tiemposUsados[teamId === planilla.homeTeamId ? "local" : "visitante"][tiempoActual]}/1)
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-bold flex items-center gap-2 ${
            aviso.grave
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-amber-50 border-amber-300 text-amber-800"
          }`}
        >
          {aviso.grave ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          {aviso.texto}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {botonEquipo(planilla.homeTeamId, planilla.local, planilla.colorLocal)}
        {botonEquipo(planilla.awayTeamId, planilla.visitante, planilla.colorVisitante)}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar}
          onClick={onCambio}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1A2A44] hover:bg-[#24355a] text-white font-bold text-sm py-3 transition-colors disabled:bg-slate-300"
        >
          <ArrowRightLeft className="w-4 h-4" /> Cambio rápido
        </button>
        <button
          type="button"
          disabled={pending || !planilla.puedeCargar || planilla.eventos.length === 0}
          onClick={deshacer}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-300 text-slate-600 font-bold text-sm py-3 px-5 hover:bg-slate-50 transition-colors disabled:opacity-40"
        >
          ↩️ Deshacer último
        </button>
      </div>

      {/* MODAL ELEGIR JUGADOR */}
      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl p-5 flex flex-col gap-4 max-h-[85vh]">
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-lg font-black text-[#1A2A44]">
                {modal.tipo === "gol"
                  ? "⚽ ¿Quién hizo el gol?"
                  : modal.tipo === "gol_en_contra"
                    ? "😅 ¿Quién se hizo el gol en contra?"
                    : modal.tipo === "amarilla"
                      ? "🟨 Amarilla para..."
                      : modal.tipo === "roja"
                        ? "🟥 Roja para..."
                        : "Falta de..."}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setModal(null);
                  setPlayerId(null);
                  setAsistenteId(null);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto flex flex-col gap-1.5 pr-1">
              {convocadosDel(modal.teamId).map((c) => {
                const expulsado = jugadorExpulsado(eventosBase, c.playerId);
                const doble = esDobleAmarilla(eventosBase, c.playerId);
                return (
                  <button
                    key={c.sheetPlayerId}
                    type="button"
                    disabled={expulsado}
                    onClick={() => setPlayerId(c.playerId)}
                    className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                      playerId === c.playerId
                        ? "border-[#F97316] bg-orange-50 text-[#1A2A44]"
                        : "border-slate-200 hover:border-slate-300 text-slate-700"
                    } ${expulsado ? "opacity-40 line-through" : ""}`}
                  >
                    <span className="w-8 h-8 rounded-lg bg-[#1A2A44] text-white flex items-center justify-center text-xs font-black shrink-0">
                      {c.numero ?? "—"}
                    </span>
                    <span className="flex-1 truncate">{c.nombre}</span>
                    {modal.tipo === "amarilla" && doble && (
                      <span className="text-[10px] font-black text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                        2da = ROJA
                      </span>
                    )}
                    {expulsado && (
                      <span className="text-[10px] font-black text-red-500">EXPULSADO</span>
                    )}
                  </button>
                );
              })}
            </div>

            {modal.tipo === "gol" && (
              <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
                Asistencia (opcional)
                <select
                  value={asistenteId ?? ""}
                  onChange={(e) => setAsistenteId(e.target.value || null)}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F97316]/60 outline-none"
                >
                  <option value="">Sin asistencia</option>
                  {convocadosDel(modal.teamId)
                    .filter((c) => c.playerId !== playerId && !jugadorExpulsado(eventosBase, c.playerId))
                    .map((c) => (
                      <option key={c.sheetPlayerId} value={c.playerId}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </label>
            )}

            <button
              type="button"
              disabled={!playerId || pending}
              onClick={confirmarEvento}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea6a0a] disabled:bg-slate-300 text-white font-black text-base rounded-xl py-3.5 transition-colors"
            >
              {pending && <Loader2 className="w-5 h-5 animate-spin" />}
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Pequeño resumen de faltas por equipo/tiempo para mostrar arriba. */
export function PanelFaltas({ planilla }: { planilla: PlanillaEnVivo }) {
  const eventosBase: EventoBase[] = planilla.eventos.map((e) => ({
    tipo: e.tipo,
    teamId: e.teamId,
    playerId: e.playerId,
    tiempo: e.tiempo,
  }));
  const faltas = faltasAcumuladas(eventosBase, planilla.homeTeamId, planilla.awayTeamId);

  const celda = (cantidad: number) => (
    <span
      className={`inline-flex items-center justify-center min-w-7 px-1.5 h-7 rounded-lg text-xs font-black ${
        nivelFaltas(cantidad) === "limite"
          ? "bg-red-600 text-white animate-pulse"
          : nivelFaltas(cantidad) === "aviso"
            ? "bg-amber-400 text-white"
            : "bg-slate-200 text-slate-600"
      }`}
    >
      {cantidad}
    </span>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center justify-around text-center">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {planilla.local}
        </span>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-slate-400 font-bold">1T</span> {celda(faltas.local.PT)}
          <span className="text-[10px] text-slate-400 font-bold">2T</span> {celda(faltas.local.ST)}
        </div>
      </div>
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
        Faltas acumuladas
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {planilla.visitante}
        </span>
        <div className="flex gap-2 items-center">
          <span className="text-[10px] text-slate-400 font-bold">1T</span> {celda(faltas.visitante.PT)}
          <span className="text-[10px] text-slate-400 font-bold">2T</span> {celda(faltas.visitante.ST)}
        </div>
      </div>
    </div>
  );
}

/** Timeline de eventos del partido (vista árbitro). */
export function TimelineEventos({ planilla }: { planilla: PlanillaEnVivo }) {
  if (planilla.eventos.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center text-sm text-slate-400 italic">
        Todavía no hay eventos. Cuando cargues goles, tarjetas o faltas aparecen acá.
      </div>
    );
  }

  const icono = (tipo: string) => {
    switch (tipo) {
      case "gol":
        return "⚽";
      case "gol_en_contra":
        return "😅";
      case "amarilla":
        return "🟨";
      case "roja":
        return "🟥";
      case "cambio":
        return "🔁";
      case "falta":
        return "🛑";
      case "tiempo_muerto":
        return "⏱️";
      default:
        return "•";
    }
  };

  const texto = (e: PlanillaEnVivo["eventos"][number]) => {
    switch (e.tipo) {
      case "gol":
        return `Gol de ${e.jugadorNombre}${e.asistenteNombre ? ` (asist. ${e.asistenteNombre})` : ""}`;
      case "gol_en_contra":
        return `Gol en contra de ${e.jugadorNombre}`;
      case "amarilla":
        return `Amarilla a ${e.jugadorNombre}`;
      case "roja":
        return `Roja a ${e.jugadorNombre}`;
      case "cambio":
        return `Entra ${e.jugadorNombre} por ${e.relacionadoNombre ?? "—"}`;
      case "falta":
        return `Falta de ${e.jugadorNombre}`;
      case "tiempo_muerto":
        return "Tiempo pedido";
      default:
        return e.tipo;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-2">
      <h4 className="font-bold text-sm text-[#1A2A44]">Eventos del partido</h4>
      <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
        {[...planilla.eventos].reverse().map((e) => {
          const esLocal = e.teamId === planilla.homeTeamId;
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 text-sm border-b border-slate-100 pb-1.5"
            >
              <span className="text-[10px] font-black text-slate-400 w-14 shrink-0 tabular-nums">
                {formatearMinuto(e.minuto, e.tiempo)}
              </span>
              <span className="shrink-0">{icono(e.tipo)}</span>
              <span className="flex-1 truncate">{texto(e)}</span>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                  esLocal ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"
                }`}
              >
                {esLocal ? planilla.local : planilla.visitante}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
