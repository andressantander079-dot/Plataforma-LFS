"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Trash2,
  UserPlus,
  Star,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
} from "lucide-react";
import {
  obtenerConvocables,
  arbitroAgregarJugador,
  quitarConvocado,
  alternarTitular,
  registrarEvento,
  eliminarEvento,
  type PlanillaCompleta,
  type Convocable,
  type EventoPlanilla,
} from "@/lib/actions/planilla.actions";
import { descripcionEvento } from "@/components/planilla/VistaPlanilla";

/**
 * PLANILLA DEL ÁRBITRO — Paso 7A
 * Con la planilla confirmada por ambos clubes, el árbitro puede:
 *  · Editar jugadores (bajas / altas de último momento, con la misma
 *    regla de categorías: los más chicos pueden subir, nunca bajar).
 *  · Cargar los eventos del partido: goles, tarjetas y cambios.
 */

const TIPOS_EVENTO: { valor: EventoPlanilla["tipo"]; etiqueta: string }[] = [
  { valor: "gol", etiqueta: "Gol" },
  { valor: "gol_en_contra", etiqueta: "Gol en contra" },
  { valor: "amarilla", etiqueta: "Tarjeta amarilla" },
  { valor: "roja", etiqueta: "Tarjeta roja" },
  { valor: "cambio", etiqueta: "Cambio (entra / sale)" },
];

export function PlanillaArbitro({ planilla }: { planilla: PlanillaCompleta }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // ---- agregar jugador ----
  const [buscando, setBuscando] = useState<string | null>(null); // teamId abierto
  const [opciones, setOpciones] = useState<Convocable[]>([]);
  const [filtro, setFiltro] = useState("");

  // ---- evento nuevo ----
  const [tipoEvento, setTipoEvento] = useState<EventoPlanilla["tipo"]>("gol");
  const [equipoEvento, setEquipoEvento] = useState(planilla.homeTeamId);
  const [jugadorEvento, setJugadorEvento] = useState("");
  const [saleEvento, setSaleEvento] = useState("");
  const [minutoEvento, setMinutoEvento] = useState("");

  const confirmada = planilla.sheet?.status === "confirmada" || planilla.sheet?.status === "aprobada";

  function ejecutar(accion: () => Promise<{ ok?: boolean; error?: string }>, mensajeOk: string) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
      else {
        setAviso(mensajeOk);
        router.refresh();
      }
    });
  }

  async function abrirBuscador(teamId: string) {
    setBuscando(teamId);
    setFiltro("");
    const res = await obtenerConvocables(planilla.matchId, teamId);
    if (res.error) setError(res.error);
    else setOpciones(res.convocables ?? []);
  }

  const idsEnPlanilla = new Set(planilla.convocados.map((c) => c.playerId));
  const opcionesFiltradas = opciones.filter(
    (o) =>
      !idsEnPlanilla.has(o.playerId) &&
      (filtro.trim() === "" ||
        o.nombre.toLowerCase().includes(filtro.toLowerCase()) ||
        o.dni.includes(filtro.trim()))
  );

  const convocadosDelEquipoEvento = planilla.convocados.filter((c) => c.teamId === equipoEvento);

  function enviarEvento() {
    if (!jugadorEvento) {
      setError("Elegí el jugador del evento.");
      return;
    }
    const fd = new FormData();
    fd.set("matchId", planilla.matchId);
    fd.set("teamId", equipoEvento);
    fd.set("playerId", jugadorEvento);
    fd.set("tipo", tipoEvento);
    fd.set("minuto", minutoEvento);
    if (tipoEvento === "cambio") fd.set("relacionadoId", saleEvento);
    ejecutar(() => registrarEvento(fd), "Evento registrado.");
    setJugadorEvento("");
    setSaleEvento("");
    setMinutoEvento("");
  }

  function SeccionEquipo({ teamId, nombre }: { teamId: string; nombre: string }) {
    const mios = planilla.convocados.filter((c) => c.teamId === teamId);
    return (
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <p className="font-bold text-xs text-[#1A2A44] uppercase tracking-wider">
            {nombre} ({mios.length})
          </p>
          {confirmada && (
            <button
              type="button"
              onClick={() => abrirBuscador(teamId)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F97316] hover:bg-orange-50 rounded-lg px-2 py-1 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" /> Agregar jugador
            </button>
          )}
        </div>
        {mios.length === 0 && (
          <p className="text-xs text-slate-400 px-4 py-3">Sin jugadores en la planilla.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {mios.map((c) => (
            <li key={c.id} className="px-4 py-2 flex items-center gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1A2A44] truncate">{c.nombre}</p>
                <p className="text-[10px] text-slate-400">DNI {c.dni}</p>
              </div>
              <button
                type="button"
                disabled={pendiente || !confirmada}
                onClick={() => ejecutar(() => alternarTitular(c.id), "Titularidad actualizada.")}
                title={c.esTitular ? "Titular" : "Suplente"}
                className={`p-1.5 rounded-lg transition-colors ${
                  c.esTitular ? "text-[#F97316] bg-orange-50" : "text-slate-300 hover:bg-orange-50"
                }`}
              >
                <Star className="w-4 h-4" fill={c.esTitular ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                disabled={pendiente || !confirmada}
                onClick={() => {
                  if (window.confirm(`¿Dar de baja a ${c.nombre} de la planilla?`)) {
                    ejecutar(() => quitarConvocado(c.id), "Jugador dado de baja.");
                  }
                }}
                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                title="Dar de baja"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>

        {/* Buscador de jugadores para agregar */}
        {buscando === teamId && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Jugadores del club (regla de categorías aplicada)
              </p>
              <button
                type="button"
                onClick={() => setBuscando(null)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
              >
                Cerrar
              </button>
            </div>
            <input
              type="text"
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="Buscar por nombre o DNI…"
              className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            />
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {opcionesFiltradas.map((o) => (
                <li
                  key={o.playerId}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1A2A44] truncate">{o.nombre}</p>
                    <p className="text-[10px] text-slate-400">
                      {o.categoria} · DNI {o.dni}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pendiente}
                    onClick={() =>
                      ejecutar(
                        () => arbitroAgregarJugador(planilla.matchId, teamId, o.playerId),
                        "Jugador agregado a la planilla."
                      )
                    }
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F97316] hover:bg-orange-50 rounded-lg px-2 py-1 transition-colors"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Agregar
                  </button>
                </li>
              ))}
              {opcionesFiltradas.length === 0 && (
                <p className="text-xs text-slate-400 px-1 py-1">Sin resultados.</p>
              )}
            </ul>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!confirmada && (
        <p className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          La planilla todavía no está confirmada por ambos clubes — cuando lo esté, vas a poder
          editar jugadores y cargar eventos.
        </p>
      )}
      {error && (
        <p className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
      {aviso && (
        <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4" /> {aviso}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SeccionEquipo teamId={planilla.homeTeamId} nombre={planilla.local} />
        <SeccionEquipo teamId={planilla.awayTeamId} nombre={planilla.visitante} />
      </div>

      {/* Carga de eventos */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <p className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#1A2A44] uppercase tracking-wider">
          Cargar evento del partido
        </p>
        <div className="p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
          <select
            value={tipoEvento}
            onChange={(e) => setTipoEvento(e.target.value as EventoPlanilla["tipo"])}
            className="text-sm border border-slate-200 rounded-xl px-2 py-2 bg-white"
          >
            {TIPOS_EVENTO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
          <select
            value={equipoEvento}
            onChange={(e) => {
              setEquipoEvento(e.target.value);
              setJugadorEvento("");
              setSaleEvento("");
            }}
            className="text-sm border border-slate-200 rounded-xl px-2 py-2 bg-white"
          >
            <option value={planilla.homeTeamId}>{planilla.local}</option>
            <option value={planilla.awayTeamId}>{planilla.visitante}</option>
          </select>
          <select
            value={jugadorEvento}
            onChange={(e) => setJugadorEvento(e.target.value)}
            className="text-sm border border-slate-200 rounded-xl px-2 py-2 bg-white md:col-span-2"
          >
            <option value="">
              {tipoEvento === "cambio" ? "Jugador que ENTRA…" : "Jugador…"}
            </option>
            {convocadosDelEquipoEvento.map((c) => (
              <option key={c.playerId} value={c.playerId}>
                {c.nombre}
              </option>
            ))}
          </select>
          {tipoEvento === "cambio" ? (
            <select
              value={saleEvento}
              onChange={(e) => setSaleEvento(e.target.value)}
              className="text-sm border border-slate-200 rounded-xl px-2 py-2 bg-white"
            >
              <option value="">Jugador que SALE…</option>
              {convocadosDelEquipoEvento
                .filter((c) => c.playerId !== jugadorEvento)
                .map((c) => (
                  <option key={c.playerId} value={c.playerId}>
                    {c.nombre}
                  </option>
                ))}
            </select>
          ) : (
            <span className="hidden md:block" />
          )}
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={60}
              value={minutoEvento}
              onChange={(e) => setMinutoEvento(e.target.value)}
              placeholder="Min"
              className="w-16 text-sm border border-slate-200 rounded-xl px-2 py-2"
            />
            <button
              type="button"
              disabled={pendiente || !confirmada}
              onClick={enviarEvento}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-[#F97316] hover:bg-[#ea6a0a] disabled:opacity-50 text-white font-bold text-sm rounded-xl px-3 py-2 transition-colors"
            >
              {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Cargar
            </button>
          </div>
        </div>

        {planilla.eventos.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {planilla.eventos.map((e) => (
              <li key={e.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                <span className="w-10 text-center shrink-0 text-[11px] font-black text-[#F97316]">
                  {e.minuto !== null ? `${e.minuto}'` : "—"}
                </span>
                <span className="font-bold text-[#1A2A44] flex-1">{descripcionEvento(e)}</span>
                <span className="text-[10px] font-bold text-slate-400">
                  {e.teamId === planilla.homeTeamId ? planilla.local : planilla.visitante}
                </span>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => ejecutar(() => eliminarEvento(e.id), "Evento eliminado.")}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Borrar evento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
