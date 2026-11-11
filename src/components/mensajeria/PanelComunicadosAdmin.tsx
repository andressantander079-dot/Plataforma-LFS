"use client";

import { useEffect, useState } from "react";
import {
  Megaphone,
  ChevronDown,
  CheckCheck,
  Check,
  Clock,
  Lock,
  Loader2,
  Users,
  Flag,
  Tag,
} from "lucide-react";
import {
  obtenerComunicadosAdmin,
  obtenerLecturasComunicado,
  type ComunicadoResumen,
  type LecturaComunicado,
} from "@/lib/actions/mensajeria.actions";
import { PRIORIDADES_MENSAJE } from "@/lib/core/rules/mensajeriaRules";

/**
 * COMUNICADOS ENVIADOS Y SEGUIMIENTO DE LECTURA INDIVIDUAL — Panel de la federación.
 * Lista de comunicados con categoría, nivel de importancia, barra de progreso
 * y desglose individual por destinatario (enviado, entregado y leído con fecha/hora).
 */

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type FiltroLectura = "todos" | "leidos" | "pendientes";

export function PanelComunicadosAdmin({ refresco = 0 }: { refresco?: number }) {
  const [comunicados, setComunicados] = useState<ComunicadoResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [lecturas, setLecturas] = useState<LecturaComunicado[] | null>(null);
  const [cargandoLecturas, setCargandoLecturas] = useState(false);
  const [filtroLectura, setFiltroLectura] = useState<FiltroLectura>("todos");

  useEffect(() => {
    let activo = true;
    obtenerComunicadosAdmin()
      .then((lista) => {
        if (activo) setComunicados(lista);
      })
      .catch(() => {
        if (activo) setError("No se pudieron cargar los comunicados.");
      });
    return () => {
      activo = false;
    };
  }, [refresco]);

  async function alternarDetalle(anuncioId: string) {
    if (expandido === anuncioId) {
      setExpandido(null);
      setLecturas(null);
      return;
    }
    setExpandido(anuncioId);
    setFiltroLectura("todos");
    setLecturas(null);
    setCargandoLecturas(true);
    try {
      const detalle = await obtenerLecturasComunicado(anuncioId);
      setLecturas(detalle);
    } catch {
      setLecturas([]);
    } finally {
      setCargandoLecturas(false);
    }
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!comunicados) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-slate-400 gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando historial de comunicados…
      </div>
    );
  }

  if (!comunicados.length) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-200/70 flex items-center justify-center">
          <Megaphone className="w-6 h-6" />
        </div>
        <p className="text-sm font-semibold text-[#1A2A44]">Todavía no enviaste comunicados</p>
        <p className="text-xs max-w-xs">
          Usá el botón “Redactar mensaje” para enviar el primer comunicado oficial a clubes y árbitros.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-3 bg-[#F4F6FA]">
      {comunicados.map((c) => {
        const porcentaje = c.totalDestinatarios
          ? Math.round((c.leidos / c.totalDestinatarios) * 100)
          : 0;
        const abierto = expandido === c.anuncioId;
        const cfgPrioridad = PRIORIDADES_MENSAJE[c.prioridad ?? "normal"];

        const lecturasFiltradas = (lecturas ?? []).filter((l) => {
          if (filtroLectura === "leidos") return l.leido;
          if (filtroLectura === "pendientes") return !l.leido;
          return true;
        });

        return (
          <article
            key={c.anuncioId}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${cfgPrioridad.bordeClase}`}
          >
            <button
              type="button"
              onClick={() => alternarDetalle(c.anuncioId)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50/60 transition"
            >
              <div
                className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${
                  c.prioridad === "urgente"
                    ? "bg-red-600"
                    : c.prioridad === "importante"
                      ? "bg-amber-500"
                      : "bg-gradient-to-br from-[#1A2A44] to-[#2A3D5F]"
                }`}
              >
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                    <Tag className="w-2.5 h-2.5 text-[#F97316]" /> {c.categoria}
                  </span>
                  {c.prioridad !== "normal" && (
                    <span
                      className={`text-[10px] font-black uppercase tracking-wider rounded-full px-2 py-0.5 border ${cfgPrioridad.badgeClase}`}
                    >
                      {cfgPrioridad.etiqueta}
                    </span>
                  )}
                  {c.sinRespuestas && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#EA580C] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                      <Lock className="w-3 h-3" /> Sin respuestas
                    </span>
                  )}
                </div>

                <h3 className="font-serif font-bold text-[#1A2A44] leading-snug mt-1">
                  {c.asunto}
                </h3>
                <p className="text-xs text-slate-500 truncate mt-0.5">{c.preview}</p>

                <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                  <span className="text-[11px] text-slate-400">
                    Enviado el {fechaLarga(c.fecha)}
                  </span>
                  <span className="text-[11px] font-bold text-[#1A2A44]">
                    {c.leidos} de {c.totalDestinatarios} leído{c.totalDestinatarios === 1 ? "" : "s"} ({porcentaje}%)
                  </span>
                </div>

                {/* Barra de lectura */}
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#EA580C] transition-all"
                    style={{ width: `${porcentaje}%` }}
                  />
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${
                  abierto ? "rotate-180" : ""
                }`}
              />
            </button>

            {abierto && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3.5 flex flex-col gap-3">
                {/* Cuerpo completo del comunicado */}
                {c.cuerpoHtml && (
                  <div className="rounded-xl bg-white border border-slate-200 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                      Contenido enviado
                    </p>
                    <div
                      className="prose-lfs text-xs text-slate-700"
                      dangerouslySetInnerHTML={{ __html: c.cuerpoHtml }}
                    />
                  </div>
                )}

                {/* Seguimiento individual de entrega y lectura */}
                <div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Seguimiento individual por destinatario
                    </p>
                    <div className="flex items-center gap-1">
                      {(
                        [
                          { id: "todos", label: `Todos (${c.totalDestinatarios})` },
                          { id: "leidos", label: `Leídos (${c.leidos})` },
                          {
                            id: "pendientes",
                            label: `Sin leer (${c.totalDestinatarios - c.leidos})`,
                          },
                        ] as const
                      ).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFiltroLectura(f.id)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                            filtroLectura === f.id
                              ? "bg-[#1A2A44] text-white"
                              : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {cargandoLecturas && (
                    <p className="flex items-center gap-2 text-xs text-slate-400 py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando estado de lectura…
                    </p>
                  )}

                  {lecturas && !cargandoLecturas && (
                    <ul className="flex flex-col divide-y divide-slate-200/70 bg-white rounded-xl border border-slate-200 px-3">
                      {lecturasFiltradas.length === 0 && (
                        <li className="py-3 text-xs text-slate-400 text-center">
                          No hay destinatarios en este filtro.
                        </li>
                      )}
                      {lecturasFiltradas.map((l, i) => (
                        <li
                          key={`${l.nombre}-${i}`}
                          className="flex items-center justify-between gap-2.5 py-2.5 flex-wrap"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {l.tipoDestino === "club" ? (
                              <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-[#1A2A44] truncate">
                              {l.nombre}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-slate-400">
                              ({l.tipoDestino === "club" ? "Club" : "Árbitro"})
                            </span>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {l.entregadoAt && (
                              <span
                                className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400"
                                title="Fecha y hora de entrega en el buzón"
                              >
                                <Check className="w-3 h-3 text-slate-400" />
                                Entregado {fechaLarga(l.entregadoAt)}
                              </span>
                            )}
                            {l.leido ? (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCheck className="w-3.5 h-3.5" />
                                Leído: {l.leidoAt ? fechaLarga(l.leidoAt) : "Confirmado"}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Clock className="w-3.5 h-3.5" /> Pendiente de lectura
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
