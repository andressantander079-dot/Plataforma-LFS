"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Users,
  X,
  Loader2,
  Search,
  UserPlus,
  Trash2,
  CheckCircle2,
  Clock,
  FileDown,
  Star,
  ShieldCheck,
} from "lucide-react";
import {
  obtenerConvocables,
  obtenerPlanilla,
  convocarJugador,
  quitarConvocado,
  alternarTitular,
  confirmarMiConvocatoria,
  type Convocable,
  type PlanillaCompleta,
} from "@/lib/actions/planilla.actions";

/**
 * GESTIONAR PLANTEL (club) — Paso 7A
 * Botón junto a cada partido del club. Abre el panel de convocatoria:
 * el club elige sus jugadores (regla: los más chicos pueden subir,
 * nunca bajar), marca titulares y confirma su lado de la planilla.
 */

export interface EstadoPlanilla {
  status: string; // 'borrador' | 'confirmada' | 'aprobada'
  miLadoConfirmado: boolean;
}

export function GestionPlantelClub({
  matchId,
  teamId,
  equipoNombre,
  rivalNombre,
  estado,
}: {
  matchId: string;
  teamId: string;
  equipoNombre: string;
  rivalNombre: string;
  estado: EstadoPlanilla | undefined;
}) {
  const [abierto, setAbierto] = useState(false);

  // Aprobada → solo link de descarga
  if (estado?.status === "aprobada") {
    return (
      <Link
        href={`/club/partidos/${matchId}`}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl px-3 py-1.5 transition-colors"
      >
        <FileDown className="w-3.5 h-3.5" /> Ver / descargar planilla
      </Link>
    );
  }

  // Confirmada por ambos → la edita el árbitro
  if (estado?.status === "confirmada") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-1.5">
        <ShieldCheck className="w-3.5 h-3.5" /> Planilla confirmada · la edita el árbitro
      </span>
    );
  }

  // Mi lado ya confirmado, esperando al rival
  if (estado?.miLadoConfirmado) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl px-3 py-1.5">
        <Clock className="w-3.5 h-3.5" /> Convocatoria enviada · esperando al rival
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white bg-[#F97316] hover:bg-[#ea6a0a] rounded-xl px-3 py-1.5 transition-colors shadow-sm"
      >
        <Users className="w-3.5 h-3.5" /> Gestionar Plantel
      </button>
      {abierto && (
        <PanelConvocatoria
          matchId={matchId}
          teamId={teamId}
          equipoNombre={equipoNombre}
          rivalNombre={rivalNombre}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function PanelConvocatoria({
  matchId,
  teamId,
  equipoNombre,
  rivalNombre,
  onCerrar,
}: {
  matchId: string;
  teamId: string;
  equipoNombre: string;
  rivalNombre: string;
  onCerrar: () => void;
}) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [convocables, setConvocables] = useState<Convocable[]>([]);
  const [planilla, setPlanilla] = useState<PlanillaCompleta | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [pendiente, startTransition] = useTransition();

  async function recargar() {
    const [resConv, resPlan] = await Promise.all([
      obtenerConvocables(matchId, teamId),
      obtenerPlanilla(matchId),
    ]);
    if (resConv.error) setError(resConv.error);
    else setConvocables(resConv.convocables ?? []);
    setPlanilla(resPlan);
    setCargando(false);
  }

  // carga inicial al abrir el panel
  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ejecutar(accion: () => Promise<{ ok?: boolean; error?: string }>, mensajeOk?: string) {
    setError(null);
    setAviso(null);
    startTransition(async () => {
      const res = await accion();
      if (res.error) setError(res.error);
      else {
        if (mensajeOk) setAviso(mensajeOk);
        await recargar();
      }
    });
  }

  const misConvocados = (planilla?.convocados ?? []).filter((c) => c.teamId === teamId);
  const idsConvocados = new Set(misConvocados.map((c) => c.playerId));
  const disponibles = convocables.filter(
    (c) =>
      !idsConvocados.has(c.playerId) &&
      (busqueda.trim() === "" ||
        c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        c.dni.includes(busqueda.trim()))
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-[#1A2A44]/40"
        onClick={() => !pendiente && onCerrar()}
      />
      <aside className="relative w-full max-w-md h-full bg-slate-50 shadow-2xl flex flex-col">
        {/* Cabecera */}
        <div className="bg-[#1A2A44] text-white px-5 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-serif font-black text-lg leading-tight">Gestionar Plantel</p>
            <p className="text-xs text-slate-300 mt-0.5">
              {equipoNombre} vs {rivalNombre}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cargando ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#F97316]" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
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

              {/* Convocados */}
              <section>
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1A2A44] mb-2">
                  Convocados ({misConvocados.length})
                </h3>
                {misConvocados.length === 0 && (
                  <p className="text-xs text-slate-400 bg-white border border-slate-200 rounded-xl px-3 py-3">
                    Todavía no convocaste a nadie. Elegí jugadores de la lista de abajo.
                  </p>
                )}
                <ul className="flex flex-col gap-1.5">
                  {misConvocados.map((c) => (
                    <li
                      key={c.id}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1A2A44] truncate">{c.nombre}</p>
                        <p className="text-[10px] text-slate-400">DNI {c.dni}</p>
                      </div>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => alternarTitular(c.id))}
                        title={c.esTitular ? "Pasar a suplente" : "Pasar a titular"}
                        className={`p-1.5 rounded-lg transition-colors ${
                          c.esTitular
                            ? "text-[#F97316] bg-orange-50"
                            : "text-slate-300 hover:text-[#F97316] hover:bg-orange-50"
                        }`}
                      >
                        <Star className="w-4 h-4" fill={c.esTitular ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => quitarConvocado(c.id))}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Quitar de la convocatoria"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                  <Star className="w-3 h-3" /> La estrella marca a los titulares.
                </p>
              </section>

              {/* Plantel disponible */}
              <section>
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#1A2A44] mb-2">
                  Plantel disponible ({disponibles.length})
                </h3>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por nombre o DNI…"
                    className="w-full text-sm bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
                  />
                </div>
                <ul className="flex flex-col gap-1.5">
                  {disponibles.map((c) => (
                    <li
                      key={c.playerId}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1A2A44] truncate">{c.nombre}</p>
                        <p className="text-[10px] text-slate-400">
                          {c.categoria} · DNI {c.dni}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => ejecutar(() => convocarJugador(matchId, teamId, c.playerId))}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#F97316] hover:bg-orange-50 rounded-lg px-2 py-1.5 transition-colors"
                      >
                        <UserPlus className="w-3.5 h-3.5" /> Convocar
                      </button>
                    </li>
                  ))}
                  {disponibles.length === 0 && (
                    <p className="text-xs text-slate-400 px-1 py-2">
                      No hay más jugadores disponibles con esa búsqueda.
                    </p>
                  )}
                </ul>
              </section>
            </div>

            {/* Pie: confirmar */}
            <div className="border-t border-slate-200 bg-white px-5 py-4">
              <button
                type="button"
                disabled={pendiente || misConvocados.length === 0}
                onClick={() => {
                  if (
                    window.confirm(
                      `¿Confirmar la convocatoria de ${equipoNombre} con ${misConvocados.length} jugadores? Después de confirmar, los cambios los hace el árbitro.`
                    )
                  ) {
                    ejecutar(
                      () => confirmarMiConvocatoria(matchId, teamId),
                      "Convocatoria confirmada. Cuando el rival confirme, pasa al árbitro."
                    );
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#1A2A44] hover:bg-[#24365a] disabled:opacity-50 text-white font-bold text-sm rounded-2xl px-4 py-3 transition-colors"
              >
                {pendiente ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                Confirmar convocatoria ({misConvocados.length})
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-2">
                Recién cuando ambos clubes confirman, la planilla pasa al árbitro.
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
