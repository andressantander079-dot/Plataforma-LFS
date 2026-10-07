"use client";

import Link from "next/link";
import {
  ArrowLeft,
  UserRound,
  Square,
  Scale,
  Gavel,
  AlertTriangle,
} from "lucide-react";
import type { FichaDisciplinaria as FichaData } from "@/lib/actions/tribunal.actions";
import {
  estadoSancion,
  ESTADO_SANCION_UI,
  ESTADO_APELACION_UI,
  motivoLegible,
  formatoPesos,
} from "@/lib/core/rules/tribunalRules";

/**
 * FICHA DISCIPLINARIA — Timeline completo de un jugador.
 * Tarjetas (de las planillas), sanciones (automáticas y manuales) y
 * apelaciones, todo ordenado en el tiempo. Solo para la federación.
 */

interface EventoTimeline {
  fecha: string; // ISO para ordenar
  icono: "amarilla" | "roja" | "sancion" | "apelacion";
  titulo: string;
  detalle: string;
  extra?: string;
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

export function FichaDisciplinaria({ ficha }: { ficha: FichaData }) {
  const eventos: EventoTimeline[] = [];

  for (const t of ficha.tarjetas) {
    eventos.push({
      fecha: t.fechaPartido ?? "",
      icono: t.tipo,
      titulo: t.tipo === "amarilla" ? "Tarjeta amarilla" : "Tarjeta roja",
      detalle: `vs ${t.rival} · ${t.torneo}${t.minuto != null ? ` · minuto ${t.minuto}'` : ""}`,
    });
  }

  for (const s of ficha.sanciones) {
    const estado = estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes });
    const partes: string[] = [];
    if (s.partidosPendientes > 0 || estado !== "activa") {
      partes.push(`${ESTADO_SANCION_UI[estado].label}`);
    }
    if (s.montoMulta != null && s.montoMulta > 0) partes.push(`Multa ${formatoPesos(s.montoMulta)}`);
    eventos.push({
      fecha: s.createdAt,
      icono: "sancion",
      titulo: motivoLegible(s.infraccion),
      detalle: `${s.origen === "automatica" ? "Automática" : "Manual"} · ${partes.join(" · ")}`,
      extra: s.anuladaMotivo ? `Anulada: ${s.anuladaMotivo}` : undefined,
    });
  }

  for (const a of ficha.apelaciones) {
    eventos.push({
      fecha: a.createdAt,
      icono: "apelacion",
      titulo: `Apelación ${ESTADO_APELACION_UI[a.estado].label.toLowerCase()}`,
      detalle: a.motivo,
      extra: a.resolucion ? `Fallo: ${a.resolucion}` : undefined,
    });
  }

  // Ordenar: los eventos sin fecha (tarjetas sin partido agendado) van al final
  eventos.sort((a, b) => {
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
  });

  const totalAmarillas = ficha.tarjetas.filter((t) => t.tipo === "amarilla").length;
  const totalRojas = ficha.tarjetas.filter((t) => t.tipo === "roja").length;
  const sancionesVigentes = ficha.sanciones.filter(
    (s) => estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes }) === "activa"
  ).length;

  const iconoDe = (icono: EventoTimeline["icono"]) => {
    switch (icono) {
      case "amarilla":
        return <Square className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />;
      case "roja":
        return <Square className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
      case "sancion":
        return <Scale className="w-3.5 h-3.5 text-[#1A2A44]" />;
      case "apelacion":
        return <Gavel className="w-3.5 h-3.5 text-[#F97316]" />;
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/tribunal/sanciones"
        className="text-xs font-bold text-slate-500 hover:text-[#F97316] flex items-center gap-1 self-start"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver al tribunal
      </Link>

      {/* Encabezado del jugador */}
      <div className="bg-gradient-to-r from-[#1A2A44] to-[#25375a] text-white rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#F97316] flex items-center justify-center shrink-0">
          <UserRound className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif text-xl font-black truncate">{ficha.jugador.nombre}</h2>
          <p className="text-[11px] text-slate-300">
            DNI {ficha.jugador.dni} · {ficha.clubNombre}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="font-serif text-2xl font-black text-amber-500">{totalAmarillas}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Amarillas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="font-serif text-2xl font-black text-red-600">{totalRojas}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Rojas</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center">
          <p className="font-serif text-2xl font-black text-[#1A2A44]">{sancionesVigentes}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sanciones vigentes</p>
        </div>
      </div>

      {/* Timeline */}
      <section className="flex flex-col gap-0">
        <h3 className="font-serif text-base font-black text-[#1A2A44] mb-3">Historial disciplinario</h3>
        {eventos.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">El jugador no tiene antecedentes disciplinarios.</p>
          </div>
        )}
        {eventos.map((e, i) => (
          <div key={i} className="flex gap-3">
            {/* Línea del tiempo */}
            <div className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                {iconoDe(e.icono)}
              </div>
              {i < eventos.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
            </div>
            <div className="pb-4 min-w-0 flex-1">
              <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-xs font-black text-[#1A2A44]">{e.titulo}</p>
                  {e.fecha && (
                    <span className="text-[10px] text-slate-400 font-semibold">{formatoFechaHora(e.fecha)}</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{e.detalle}</p>
                {e.extra && <p className="text-[10px] text-slate-400 italic mt-1">{e.extra}</p>}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
