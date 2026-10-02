"use client";

import { useEffect, useState } from "react";
import {
  Megaphone,
  ChevronDown,
  CheckCheck,
  Clock,
  Lock,
  Loader2,
  Users,
  Flag,
} from "lucide-react";
import {
  obtenerComunicadosAdmin,
  obtenerLecturasComunicado,
  type ComunicadoResumen,
  type LecturaComunicado,
} from "@/lib/actions/mensajeria.actions";

/**
 * COMUNICADOS ENVIADOS — panel de la federación.
 * Lista de comunicados con su alcance y, al expandir, el detalle de
 * "quién lo leyó" (clubes y árbitros, con fecha de lectura).
 */

function fechaLarga(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function PanelComunicadosAdmin({ refresco = 0 }: { refresco?: number }) {
  const [comunicados, setComunicados] = useState<ComunicadoResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [lecturas, setLecturas] = useState<LecturaComunicado[] | null>(null);
  const [cargandoLecturas, setCargandoLecturas] = useState(false);

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
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando comunicados…
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
          Usá el botón “Redactar” para enviar el primer comunicado oficial a clubes y árbitros.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4 flex flex-col gap-2.5 bg-[#F4F6FA]">
      {comunicados.map((c) => {
        const porcentaje = c.totalDestinatarios
          ? Math.round((c.leidos / c.totalDestinatarios) * 100)
          : 0;
        const abierto = expandido === c.anuncioId;
        return (
          <article
            key={c.anuncioId}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => alternarDetalle(c.anuncioId)}
              className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50/60 transition"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A2A44] to-[#2A3D5F] text-white flex items-center justify-center shrink-0">
                <Megaphone className="w-5 h-5 text-[#F97316]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif font-bold text-[#1A2A44] leading-snug">
                    {c.asunto}
                  </h3>
                  {c.sinRespuestas && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-[#EA580C] bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
                      <Lock className="w-3 h-3" /> Sin respuestas
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{c.preview}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] text-slate-400">{fechaLarga(c.fecha)}</span>
                  <span className="text-[11px] font-bold text-[#1A2A44]">
                    {c.leidos}/{c.totalDestinatarios} lo leyeron
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
              <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                  ¿Quién lo leyó?
                </p>
                {cargandoLecturas && (
                  <p className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando lecturas…
                  </p>
                )}
                {lecturas && !cargandoLecturas && (
                  <ul className="flex flex-col divide-y divide-slate-200/70">
                    {lecturas.map((l, i) => (
                      <li key={`${l.nombre}-${i}`} className="flex items-center gap-2.5 py-2">
                        {l.tipoDestino === "club" ? (
                          <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-[#1A2A44] truncate flex-1">
                          {l.nombre}
                        </span>
                        {l.leido ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 shrink-0">
                            <CheckCheck className="w-3.5 h-3.5" />
                            {l.leidoAt ? fechaLarga(l.leidoAt) : "Leído"}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 shrink-0">
                            <Clock className="w-3.5 h-3.5" /> Sin leer
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
