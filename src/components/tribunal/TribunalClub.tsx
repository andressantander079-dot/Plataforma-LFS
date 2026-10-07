"use client";

import { useState, useTransition } from "react";
import {
  Scale,
  Gavel,
  Loader2,
  CircleAlert,
  Paperclip,
  X,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import {
  apelarSancion,
  type SancionFila,
  type ApelacionFila,
} from "@/lib/actions/tribunal.actions";
import {
  estadoSancion,
  ESTADO_SANCION_UI,
  ESTADO_APELACION_UI,
  ESTADO_MULTA_UI,
  motivoLegible,
  formatoPesos,
  puedeApelar,
  calcularLimiteApelacion,
  ETIQUETA_TIPO_SANCIONADO,
  PLAZO_APELACION_HORAS,
} from "@/lib/core/rules/tribunalRules";

/**
 * TRIBUNAL — Vista del CLUB.
 * El club revisa sus sanciones (jugadores, cuerpo técnico e institucionales),
 * ve el estado real de la multa en tesorería (pendiente / aceptada con fecha /
 * rechazada con fecha) y puede APELAR dentro de las 72 hs con texto y pruebas.
 * Mientras se evalúa la apelación, la sanción se sigue cumpliendo.
 */

function formatoFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Estado de la multa como lo pidió el club: pendiente (ámbar), aceptada (verde + fecha/hora), rechazada (+ fecha/hora). */
function EstadoMultaClub({ sancion }: { sancion: SancionFila }) {
  if (!sancion.cargo) {
    return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_MULTA_UI.sin_multa.clases}`}>
        Sin multa
      </span>
    );
  }
  const { cargo } = sancion;
  const pago = cargo.ultimoPago;

  if (pago?.status === "rechazado") {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
        Comprobante rechazado{pago.resueltoAt ? ` el ${formatoFechaHora(pago.resueltoAt)}` : ""}
      </span>
    );
  }
  if (cargo.status === "pagado" && pago?.status === "aprobado") {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Pago aceptado{pago.resueltoAt ? ` el ${formatoFechaHora(pago.resueltoAt)}` : ""}
      </span>
    );
  }
  if (cargo.status === "pendiente" && pago?.status === "pendiente") {
    return (
      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1">
        <Clock className="w-3 h-3" /> Comprobante en revisión por tesorería
      </span>
    );
  }
  const ui = ESTADO_MULTA_UI[cargo.status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ui.clases}`}>{ui.label}</span>
  );
}

export function TribunalClub({
  clubNombre,
  sanciones,
  apelaciones,
}: {
  clubId: string;
  clubNombre: string;
  sanciones: SancionFila[];
  apelaciones: ApelacionFila[];
}) {
  const [pendiente, startTransition] = useTransition();
  const [apelando, setApelando] = useState<SancionFila | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [archivos, setArchivos] = useState<File[]>([]);

  const vigentes = sanciones.filter(
    (s) => estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes }) === "activa"
  );
  const otras = sanciones.filter(
    (s) => estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes }) !== "activa"
  );

  const agregarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevos = Array.from(e.target.files ?? []);
    setArchivos((prev) => [...prev, ...nuevos].slice(0, 3));
    e.target.value = "";
  };

  const enviarApelacion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!apelando) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("suspensionId", apelando.id);
    for (const a of archivos) fd.append("pruebas", a);
    startTransition(async () => {
      const res = await apelarSancion(fd);
      if (res?.error) {
        setError(res.error);
      } else {
        setExito(true);
        setTimeout(() => {
          setApelando(null);
          setExito(false);
          setArchivos([]);
        }, 1200);
      }
    });
  };

  const renderSancion = (s: SancionFila) => {
    const estado = estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes });
    const uiEstado = ESTADO_SANCION_UI[estado];
    const habilitado = puedeApelar({
      creadaAtIso: s.createdAt,
      yaApelo: !!s.apelacion,
      anulada: !!s.anuladaAt,
    });

    return (
      <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-sm font-black text-[#1A2A44]">{s.sancionadoNombre}</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${uiEstado.clases}`}>{uiEstado.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {ETIQUETA_TIPO_SANCIONADO[s.sancionadoTipo]}
              {s.equipoNombre ? ` · ${s.equipoNombre}` : ""}
              {s.competitionNombre ? ` · ${s.competitionNombre}` : ""} · {formatoFecha(s.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            {s.partidosPendientes > 0 && (
              <p className="text-sm font-black text-red-600">
                {s.partidosPendientes} fecha{s.partidosPendientes > 1 ? "s" : ""}
              </p>
            )}
            {s.montoMulta != null && s.montoMulta > 0 && (
              <p className="text-sm font-black text-amber-600">{formatoPesos(s.montoMulta)}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          {motivoLegible(s.infraccion)}
        </p>
        {s.anuladaMotivo && (
          <p className="text-[11px] text-slate-500 italic">
            Anulada el {formatoFecha(s.anuladaAt)}: {s.anuladaMotivo}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <EstadoMultaClub sancion={s} />
            {s.apelacion && (
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ESTADO_APELACION_UI[s.apelacion.estado].clases}`}>
                Apelación: {ESTADO_APELACION_UI[s.apelacion.estado].label}
              </span>
            )}
          </div>
          {!s.apelacion && habilitado.ok && (
            <button
              onClick={() => {
                setError(null);
                setArchivos([]);
                setApelando(s);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#1A2A44] text-white text-[10px] font-bold flex items-center gap-1 hover:bg-[#25375a]"
            >
              <Gavel className="w-3 h-3" /> Apelar
            </button>
          )}
          {!s.apelacion && !habilitado.ok && estado !== "anulada" && (
            <span className="text-[10px] text-slate-400 font-semibold">{habilitado.motivo}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Scale className="w-7 h-7 text-[#F97316]" />
          Tribunal de Disciplina
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Sanciones de {clubNombre}: jugadores, cuerpo técnico e institucionales.
          Podés apelar dentro de las {PLAZO_APELACION_HORAS} hs de notificada.
        </p>
      </div>

      {/* Aviso reglamentario */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[11px] text-amber-800 leading-relaxed">
          <strong>Importante:</strong> mientras el tribunal evalúa la apelación, la sanción se sigue
          cumpliendo. Si el fallo la acepta, la sanción y su multa quedan anuladas.
        </p>
      </div>

      {/* Vigentes */}
      <section className="flex flex-col gap-3">
        <h3 className="font-serif text-base font-black text-[#1A2A44]">
          Sanciones vigentes ({vigentes.length})
        </h3>
        {vigentes.map(renderSancion)}
        {vigentes.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">El club no tiene sanciones vigentes. ¡Felicitaciones!</p>
          </div>
        )}
      </section>

      {/* Historial */}
      {otras.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-serif text-base font-black text-[#1A2A44]">
            Historial ({otras.length})
          </h3>
          {otras.map(renderSancion)}
        </section>
      )}

      {/* Mis apelaciones */}
      {apelaciones.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="font-serif text-base font-black text-[#1A2A44]">
            Apelaciones presentadas ({apelaciones.length})
          </h3>
          {apelaciones.map((a) => {
            const sancion = sanciones.find((s) => s.id === a.sancionId);
            const ui = ESTADO_APELACION_UI[a.estado];
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-serif text-sm font-black text-[#1A2A44]">
                    {sancion?.sancionadoNombre ?? "Sanción"}
                  </span>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ui.clases}`}>{ui.label}</span>
                </div>
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 whitespace-pre-wrap">
                  {a.motivo}
                </p>
                <p className="text-[10px] text-slate-400">
                  Presentada el {formatoFechaHora(a.createdAt)}
                  {a.resueltoAt ? ` · Fallo del ${formatoFechaHora(a.resueltoAt)}` : ""}
                </p>
                {a.resolucion && (
                  <p className="text-[11px] text-slate-500 italic border-l-2 border-[#F97316] pl-2">
                    {a.resolucion}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Modal: apelar */}
      {apelando && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => !pendiente && setApelando(null)}
        >
          <form
            onSubmit={enviarApelacion}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-serif text-base font-black text-[#1A2A44]">Apelar sanción</h3>
              <p className="text-[11px] text-slate-500">
                {apelando.sancionadoNombre} · {motivoLegible(apelando.infraccion)}
              </p>
              <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Plazo hasta el{" "}
                {calcularLimiteApelacion(apelando.createdAt).toLocaleString("es-AR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Motivo de la apelación
              </span>
              <textarea
                name="motivo"
                rows={4}
                required
                minLength={10}
                placeholder="Explicá por qué consideran que la sanción no corresponde…"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-none"
              />
            </label>

            {/* Pruebas (hasta 3) */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Pruebas (opcional, hasta 3)
              </span>
              <label className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 border-dashed border-slate-300 text-xs font-bold text-slate-500 cursor-pointer hover:border-[#F97316] hover:text-[#F97316] transition">
                <Paperclip className="w-4 h-4" />
                Adjuntar foto o PDF
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  multiple
                  className="hidden"
                  onChange={agregarArchivo}
                />
              </label>
              {archivos.map((a, i) => (
                <div key={`${a.name}-${i}`} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-[11px] font-semibold text-slate-600 truncate">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                    className="p-1 rounded-full text-slate-400 hover:text-red-500"
                    aria-label={`Quitar ${a.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-600 font-bold bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 flex items-center gap-1.5">
                <CircleAlert className="w-4 h-4 shrink-0" /> {error}
              </p>
            )}
            {exito && (
              <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                Apelación presentada. El tribunal la evaluará a la brevedad.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setApelando(null)}
                disabled={pendiente}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                disabled={pendiente}
                className="flex-1 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Presentar apelación
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
