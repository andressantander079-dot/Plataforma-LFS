"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  ShieldCheck,
  Pencil,
  X,
  Check,
  Loader2,
  AlertCircle,
  Trophy,
  ClipboardList,
} from "lucide-react";
import {
  actualizarPartido,
  cargarResultadoAdmin,
  confirmarResultado,
  marcarWO,
} from "@/lib/actions/competencias.actions";

/**
 * FIXTURE EDITABLE (admin/federación)
 * Partidos agrupados por fecha. Cada partido permite:
 *  - Programar (drawer: día, hora, cancha, árbitro, suspender/reprogramar)
 *  - Cargar resultado directo (confirmado al instante)
 *  - Confirmar lo que cargó el árbitro
 *  - Marcar W.O. para cualquiera de los dos equipos
 */

export interface PartidoUI {
  id: string;
  matchday: number | null;
  round: number;
  homeNombre: string;
  awayNombre: string;
  scheduled_at: string | null;
  venueNombre: string | null;
  referee_id: string | null;
  refereeNombre: string | null;
  status: "programado" | "suspendido" | "jugado" | "wo";
  home_score: number | null;
  away_score: number | null;
  result_confirmed: boolean;
  notes: string | null;
}

interface Opcion {
  id: string;
  nombre: string;
}

interface FixtureEditableProps {
  competitionId: string;
  partidos: PartidoUI[];
  canchas: Opcion[];
  arbitros: Opcion[];
}

const ESTADO_UI: Record<string, { label: string; className: string }> = {
  programado: { label: "Programado", className: "bg-slate-100 text-slate-600" },
  suspendido: { label: "Suspendido", className: "bg-red-100 text-red-700" },
  jugado: { label: "Jugado", className: "bg-green-100 text-green-700" },
  wo: { label: "W.O.", className: "bg-orange-100 text-orange-700" },
};

function paraInputFecha(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export function FixtureEditable({ competitionId, partidos, canchas, arbitros }: FixtureEditableProps) {
  const [editando, setEditando] = useState<PartidoUI | null>(null);
  const [resultando, setResultando] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function ejecutar(accion: Promise<{ error?: string; ok?: boolean }>) {
    setPendiente(true);
    setError(null);
    startTransition(async () => {
      const res = await accion;
      if (res.error) setError(res.error);
      setPendiente(false);
    });
  }

  // Agrupar por fecha (jornada)
  const porFecha = new Map<number | string, PartidoUI[]>();
  for (const p of partidos) {
    const clave = p.matchday !== null ? p.matchday : "sin-fecha";
    if (!porFecha.has(clave)) porFecha.set(clave, []);
    porFecha.get(clave)!.push(p);
  }
  const grupos = Array.from(porFecha.entries()).sort((a, b) => {
    const numA = typeof a[0] === "number" ? a[0] : 9999;
    const numB = typeof b[0] === "number" ? b[0] : 9999;
    return numA - numB;
  });

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {grupos.map(([fecha, lista]) => (
        <div key={String(fecha)} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#F97316]" />
            <span className="font-bold text-sm text-[#1A2A44]">
              {typeof fecha === "number" ? `Fecha ${fecha}` : "Sin fecha asignada"}
            </span>
            <span className="text-[11px] text-slate-400">
              {lista.length} partido{lista.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {lista.map((p) => (
              <div key={p.id} className="px-4 py-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {/* Equipos y marcador */}
                  <div className="flex-1 min-w-[220px] flex items-center gap-2 text-sm">
                    <span className="font-bold text-[#1A2A44] text-right flex-1 truncate">
                      {p.homeNombre}
                    </span>
                    {p.home_score !== null && p.away_score !== null ? (
                      <span className="shrink-0 font-black text-[#1A2A44] bg-slate-100 rounded-lg px-2.5 py-0.5">
                        {p.home_score} - {p.away_score}
                      </span>
                    ) : (
                      <span className="shrink-0 text-slate-400 font-bold text-xs">VS</span>
                    )}
                    <span className="font-bold text-[#1A2A44] flex-1 truncate">{p.awayNombre}</span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_UI[p.status].className}`}>
                    {ESTADO_UI[p.status].label}
                  </span>
                  {p.status === "jugado" && !p.result_confirmed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600">
                      Pendiente de confirmación
                    </span>
                  )}
                  {p.result_confirmed && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Confirmado
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {fechaLinda(p.scheduled_at)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {p.venueNombre ?? "Sin cancha"}
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> {p.refereeNombre ?? "Sin árbitro"}
                  </span>
                </div>

                {/* Acciones */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditando(p)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-[#1A2A44] hover:border-[#F97316] hover:text-[#F97316] transition flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    {p.status === "suspendido" ? "Reprogramar" : "Programar"}
                  </button>

                  {(p.status === "programado" || p.status === "jugado") && (
                    <button
                      type="button"
                      onClick={() => setResultando(resultando === p.id ? null : p.id)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-[#1A2A44] hover:border-[#F97316] hover:text-[#F97316] transition"
                    >
                      {p.home_score !== null ? "Editar resultado" : "Cargar resultado"}
                    </button>
                  )}

                  {p.status === "jugado" && !p.result_confirmed && (
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => ejecutar(confirmarResultado(p.id, competitionId))}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  )}

                  <Link
                    href={`/admin/planillas/${p.id}`}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-300 text-[#1A2A44] hover:border-[#F97316] hover:text-[#F97316] transition flex items-center gap-1"
                  >
                    <ClipboardList className="w-3 h-3" /> Planilla
                  </Link>

                  {p.status === "programado" && (
                    <>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => {
                          if (window.confirm(`¿W.O. a favor de ${p.homeNombre}? El marcador sale de la configuración del torneo.`)) {
                            ejecutar(marcarWO(p.id, competitionId, "home"));
                          }
                        }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 transition disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trophy className="w-3 h-3" /> W.O. local
                      </button>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => {
                          if (window.confirm(`¿W.O. a favor de ${p.awayNombre}? El marcador sale de la configuración del torneo.`)) {
                            ejecutar(marcarWO(p.id, competitionId, "away"));
                          }
                        }}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 transition disabled:opacity-50"
                      >
                        W.O. visitante
                      </button>
                    </>
                  )}
                </div>

                {/* Formulario inline de resultado (carga directa de la federación) */}
                {resultando === p.id && (
                  <form
                    action={async (formData) => {
                      setResultando(null);
                      ejecutar(cargarResultadoAdmin(p.id, formData));
                    }}
                    className="flex flex-wrap items-end gap-2 bg-slate-50 rounded-xl p-3"
                  >
                    <input type="hidden" name="competitionId" value={competitionId} />
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
                      {p.homeNombre}
                      <input
                        name="home_score"
                        type="number"
                        min={0}
                        max={99}
                        required
                        defaultValue={p.home_score ?? undefined}
                        className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                      />
                    </label>
                    <span className="font-black text-slate-400 pb-2">—</span>
                    <label className="flex flex-col gap-1 text-[11px] font-bold text-slate-500">
                      {p.awayNombre}
                      <input
                        name="away_score"
                        type="number"
                        min={0}
                        max={99}
                        required
                        defaultValue={p.away_score ?? undefined}
                        className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={pendiente}
                      className="px-4 py-1.5 rounded-lg bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Guardar y confirmar
                    </button>
                    <p className="w-full text-[10px] text-slate-400">
                      La federación carga directo: el resultado entra confirmado a la tabla.
                    </p>
                  </form>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* DRAWER de programación */}
      {editando && (
        <PanelProgramar
          partido={editando}
          competitionId={competitionId}
          canchas={canchas}
          arbitros={arbitros}
          onCerrar={() => setEditando(null)}
        />
      )}
    </div>
  );
}

/** Drawer lateral para programar/reprogramar un partido. */
function PanelProgramar({
  partido,
  competitionId,
  canchas,
  arbitros,
  onCerrar,
}: {
  partido: PartidoUI;
  competitionId: string;
  canchas: Opcion[];
  arbitros: Opcion[];
  onCerrar: () => void;
}) {
  const [pendiente, setPendiente] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="fixed inset-0 bg-[#1A2A44]/40 z-40" onClick={onCerrar} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-serif text-lg font-black text-[#1A2A44]">Programar partido</h3>
            <p className="text-xs text-slate-500">
              {partido.homeNombre} vs {partido.awayNombre}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className="p-1.5 text-slate-400 hover:text-[#1A2A44]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          action={async (formData) => {
            setPendiente(true);
            setError(null);
            const res = await actualizarPartido(partido.id, formData);
            setPendiente(false);
            if (res.error) setError(res.error);
            else onCerrar();
          }}
          className="flex-1 overflow-y-auto p-5 flex flex-col gap-4"
        >
          <input type="hidden" name="competitionId" value={competitionId} />

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Fecha (jornada)
            <input
              name="matchday"
              type="number"
              min={1}
              defaultValue={partido.matchday ?? undefined}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Día y hora
            <input
              name="scheduled_at"
              type="datetime-local"
              defaultValue={paraInputFecha(partido.scheduled_at)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Cancha
            <select
              name="venue_id"
              defaultValue=""
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            >
              <option value="">Sin cancha asignada</option>
              {canchas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Árbitro designado
            <select
              name="referee_id"
              defaultValue={partido.referee_id ?? ""}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            >
              <option value="">Sin árbitro asignado</option>
              {arbitros.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Estado
            <select
              name="status"
              defaultValue={partido.status === "suspendido" ? "suspendido" : "programado"}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            >
              <option value="programado">Programado</option>
              <option value="suspendido">Suspendido (lluvia / fuerza mayor)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
            Notas (opcional)
            <textarea
              name="notes"
              rows={2}
              defaultValue={partido.notes ?? ""}
              placeholder="Ej: se reprograma por lluvia del fin de semana"
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
            />
          </label>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-auto px-4 py-3 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar programación
          </button>
        </form>
      </aside>
    </>
  );
}
