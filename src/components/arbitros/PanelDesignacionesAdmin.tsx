"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Loader2,
  UserCheck,
  UserX,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  conflictoHorario,
  estaBloqueado,
  textoDesignacion,
  ESTADO_DESIGNACION_UI,
  type ModoDesignacion,
} from "@/lib/core/rules/arbitrosRules";
import {
  designarArbitro,
  quitarDesignacion,
  type PanelDesignaciones,
  type ArbitroOpcionUI,
} from "@/lib/actions/arbitros.actions";

/**
 * PANEL DE DESIGNACIONES (admin) — asignación manual mejorada:
 * tildás uno o varios partidos, elegís el árbitro (con nivel, disponibilidad
 * y conflictos de horario a la vista) y el modo: directa o con confirmación.
 * El árbitro recibe el aviso por mensajería interna automáticamente.
 */
export function PanelDesignacionesAdmin({ panel }: { panel: PanelDesignaciones }) {
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [arbitroId, setArbitroId] = useState<string>("");
  const [modo, setModo] = useState<ModoDesignacion>("propuesta");
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const arbitro = useMemo(
    () => panel.arbitros.find((a) => a.id === arbitroId) ?? null,
    [panel.arbitros, arbitroId]
  );

  const partidosSeleccionados = useMemo(
    () => panel.partidos.filter((p) => seleccionados.has(p.id)),
    [panel.partidos, seleccionados]
  );

  // Alertas para la selección actual (bloqueos y conflictos del árbitro elegido)
  const alertas = useMemo(() => {
    if (!arbitro) return { bloqueados: 0, conflictos: 0 };
    let bloqueados = 0;
    let conflictos = 0;
    for (const p of partidosSeleccionados) {
      if (estaBloqueado(p.scheduled_at, arbitro.bloques)) bloqueados++;
      if (conflictoHorario(arbitro.partidos, p.scheduled_at, p.id)) conflictos++;
    }
    return { bloqueados, conflictos };
  }, [arbitro, partidosSeleccionados]);

  const toggle = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const asignar = () => {
    setAviso(null);
    if (partidosSeleccionados.length === 0) {
      setAviso({ tipo: "error", texto: "Tildá al menos un partido." });
      return;
    }
    if (!arbitro) {
      setAviso({ tipo: "error", texto: "Elegí un árbitro de la lista." });
      return;
    }
    const advertencia =
      alertas.bloqueados > 0 || alertas.conflictos > 0
        ? `\n\n⚠️ Ojo: ${alertas.bloqueados > 0 ? `en ${alertas.bloqueados} partido(s) el árbitro marcó que NO puede. ` : ""}${alertas.conflictos > 0 ? `en ${alertas.conflictos} tiene otro partido a menos de 2 hs.` : ""}\n¿Designar igual?`
        : "";
    const resumen = `¿Designar a ${arbitro.nombre} en ${partidosSeleccionados.length} partido(s) en modo ${modo === "directa" ? "DIRECTA (queda designado ya)" : "PROPUESTA (tiene que aceptar)"}?${advertencia}`;
    if (!window.confirm(resumen)) return;

    startTransition(async () => {
      const res = await designarArbitro(
        partidosSeleccionados.map((p) => p.id),
        arbitro.id,
        modo
      );
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({
          tipo: "ok",
          texto:
            modo === "directa"
              ? "Listo: quedó designado y ya le llegó el aviso."
              : "Listo: le llegó la propuesta por mensajería para que acepte o rechace.",
        });
        setSeleccionados(new Set());
      }
    });
  };

  const quitar = (matchId: string, descripcion: string) => {
    if (!window.confirm(`¿Quitar la designación de ${descripcion}? Se le avisa al árbitro.`)) return;
    startTransition(async () => {
      const res = await quitarDesignacion(matchId);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Designación quitada." });
    });
  };

  const fmtFecha = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("es-AR", {
          weekday: "short",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "A programar";

  return (
    <div className="flex flex-col gap-5">
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

      {/* Lista de partidos con checkbox */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#F97316]" />
            Partidos programados ({panel.partidos.length})
          </h2>
          {seleccionados.size > 0 && (
            <span className="text-[10px] font-black text-[#F97316]">
              {seleccionados.size} tildado{seleccionados.size === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <ul className="divide-y divide-slate-100">
          {panel.partidos.map((p) => {
            const tildado = seleccionados.has(p.id);
            const estadoUi = p.designacion_estado
              ? ESTADO_DESIGNACION_UI[p.designacion_estado]
              : null;
            return (
              <li key={p.id} className={`px-4 py-3.5 flex gap-3 ${tildado ? "bg-orange-50/50" : ""}`}>
                <input
                  type="checkbox"
                  checked={tildado}
                  onChange={() => toggle(p.id)}
                  className="mt-1.5 w-4 h-4 accent-[#F97316] shrink-0"
                  aria-label={`Tildar partido ${p.homeNombre} vs ${p.awayNombre}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {p.torneoNombre}
                    {p.categoriaNombre ? ` · ${p.categoriaNombre}` : ""}
                    {p.matchday ? ` · Fecha ${p.matchday}` : ""}
                  </p>
                  <p className="font-serif font-black text-[#1A2A44] text-sm truncate">
                    {p.homeNombre} <span className="text-slate-400 font-normal">vs</span> {p.awayNombre}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {fmtFecha(p.scheduled_at)}
                    {p.venueNombre ? ` · ${p.venueNombre}` : ""}
                  </p>
                  {p.designacion_estado === "rechazada" && p.designacion_rechazo_motivo && (
                    <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> Motivo del rechazo: {p.designacion_rechazo_motivo}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {p.referee_id ? (
                    <>
                      <span className="text-[10px] font-bold text-[#1A2A44] flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-[#F97316]" />
                        {p.arbitroNombre}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {estadoUi ? (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${estadoUi.className}`}>
                            {estadoUi.label}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                            {textoDesignacion(p.designacion_modo, null)}
                          </span>
                        )}
                        <button
                          onClick={() => quitar(p.id, `${p.homeNombre} vs ${p.awayNombre}`)}
                          disabled={pendiente}
                          title="Quitar designación"
                          className="p-1 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      Sin árbitro
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          {panel.partidos.length === 0 && (
            <li className="px-5 py-10 text-center text-xs text-slate-400">
              No hay partidos programados pendientes de jugar.
            </li>
          )}
        </ul>
      </div>

      {/* Selector de árbitro + modo + botón */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-4">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#F97316]" />
          Asignar árbitro a los partidos tildados
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          {panel.arbitros.map((a) => (
            <ArbitroCard
              key={a.id}
              arbitro={a}
              activo={arbitroId === a.id}
              partidosSeleccionados={partidosSeleccionados}
              onClick={() => setArbitroId(a.id)}
            />
          ))}
          {panel.arbitros.length === 0 && (
            <p className="text-xs text-slate-400 sm:col-span-2">
              Todavía no hay usuarios con rol árbitro. Crealos desde el Colegio de Árbitros.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end border-t border-slate-100 pt-4">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
              Modo de designación
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setModo("propuesta")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${
                  modo === "propuesta"
                    ? "border-[#F97316] bg-orange-50 text-[#F97316]"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                📩 Propuesta
                <span className="block text-[9px] font-semibold opacity-70">el árbitro acepta o rechaza</span>
              </button>
              <button
                onClick={() => setModo("directa")}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition ${
                  modo === "directa"
                    ? "border-[#F97316] bg-orange-50 text-[#F97316]"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                🟧 Directa
                <span className="block text-[9px] font-semibold opacity-70">queda designado ya</span>
              </button>
            </div>
          </div>
          <button
            onClick={asignar}
            disabled={pendiente || seleccionados.size === 0 || !arbitroId}
            className="sm:w-56 px-5 py-3 rounded-xl bg-[#F97316] hover:bg-[#ea580c] disabled:opacity-40 text-white font-black text-sm shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2"
          >
            {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
            Designar ({seleccionados.size})
          </button>
        </div>
      </div>
    </div>
  );
}

function ArbitroCard({
  arbitro,
  activo,
  partidosSeleccionados,
  onClick,
}: {
  arbitro: ArbitroOpcionUI;
  activo: boolean;
  partidosSeleccionados: Array<{ id: string; scheduled_at: string | null }>;
  onClick: () => void;
}) {
  const suspendido = arbitro.estado === "suspendido";
  const bloqueos = partidosSeleccionados.filter((p) =>
    estaBloqueado(p.scheduled_at, arbitro.bloques)
  ).length;
  const conflictos = partidosSeleccionados.filter((p) =>
    conflictoHorario(arbitro.partidos, p.scheduled_at, p.id)
  ).length;

  return (
    <button
      onClick={onClick}
      disabled={suspendido}
      className={`text-left px-4 py-3 rounded-xl border-2 transition flex flex-col gap-1 ${
        activo
          ? "border-[#F97316] bg-orange-50/60"
          : "border-slate-200 hover:border-slate-300 bg-white"
      } ${suspendido ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-sm text-[#1A2A44]">{arbitro.nombre}</p>
        {activo && <CheckCircle2 className="w-4 h-4 text-[#F97316]" />}
      </div>
      <p className="text-[10px] font-semibold text-slate-500">
        {arbitro.nivelNombre ?? "Sin nivel"}
        {suspendido ? " · SUSPENDIDO" : ""}
      </p>
      {(bloqueos > 0 || conflictos > 0) && (
        <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1">
          <UserX className="w-3 h-3" />
          {bloqueos > 0 && `${bloqueos} día(s) marcó que no puede `}
          {conflictos > 0 && `${conflictos} conflicto(s) de horario`}
        </p>
      )}
    </button>
  );
}
