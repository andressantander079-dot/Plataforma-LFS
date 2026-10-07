"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  AlertTriangle,
  PenLine,
  BadgeCheck,
  Inbox,
  Search,
  ArrowRight,
} from "lucide-react";
import type { Bandeja, FilaBandeja } from "@/lib/actions/tramites.actions";
import { TABS_BANDEJA, type TabBandeja } from "@/lib/core/rules/tramitesRules";
import { ESTADO_PASE_UI } from "@/lib/core/rules/pasesRules";

/**
 * BANDEJA DE TRÁMITES de la federación (Paso 15).
 * 4 KPIs que filtran al tocarlos + pestañas (Pendientes de la liga /
 * En curso / Trabados / Historial). Tarjetas en móvil, tabla en desktop.
 */

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function horasDesdeIso(iso: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3600000));
}

export function BandejaTramites({ bandeja }: { bandeja: Bandeja }) {
  const [tab, setTab] = useState<TabBandeja>("pendientes");
  const [busqueda, setBusqueda] = useState("");

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return bandeja.filas.filter((f) => {
      if (f.tab !== tab) return false;
      if (texto) {
        const blob = `${f.jugador} ${f.dni} ${f.origen} ${f.destino} ${f.numeroPase ?? ""}`.toLowerCase();
        if (!blob.includes(texto)) return false;
      }
      return true;
    });
  }, [bandeja.filas, tab, busqueda]);

  const conteos = useMemo(() => {
    const mapa: Record<TabBandeja, number> = { pendientes: 0, en_curso: 0, trabados: 0, historial: 0 };
    for (const f of bandeja.filas) mapa[f.tab] += 1;
    return mapa;
  }, [bandeja.filas]);

  const KPIS = [
    {
      id: "pendientes" as TabBandeja,
      label: "Pendientes de la liga",
      valor: bandeja.kpis.pendientesLiga,
      icono: Inbox,
      color: "text-[#1A2A44]",
    },
    {
      id: "trabados" as TabBandeja,
      label: "Trabados",
      valor: bandeja.kpis.trabados,
      icono: AlertTriangle,
      color: "text-red-600",
    },
    {
      id: "en_curso" as TabBandeja,
      label: "Esperando firma",
      valor: bandeja.kpis.esperandoFirma,
      icono: PenLine,
      color: "text-violet-600",
    },
    {
      id: "historial" as TabBandeja,
      label: `Efectivos ${new Date().getFullYear()}`,
      valor: bandeja.kpis.efectivosAnio,
      icono: BadgeCheck,
      color: "text-emerald-600",
    },
  ];

  const renderBadge = (f: FilaBandeja) => {
    const ui = ESTADO_PASE_UI[f.estado];
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${ui.className}`}>{ui.label}</span>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs clickeables */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPIS.map((k) => (
          <button
            key={k.label}
            onClick={() => setTab(k.id)}
            className={`bg-white border rounded-2xl p-4 text-left transition hover:shadow-md ${
              tab === k.id ? "border-[#F97316] ring-2 ring-[#F97316]/20" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k.label}</p>
              <k.icono className={`w-4 h-4 ${k.color}`} />
            </div>
            <p className={`font-serif text-2xl font-black mt-1 ${k.color}`}>{k.valor}</p>
          </button>
        ))}
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 overflow-x-auto">
        {TABS_BANDEJA.map((t) => {
          const activa = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activa ? "bg-[#1A2A44] text-white shadow" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t.label}
              {conteos[t.id] > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    activa ? "bg-[#F97316] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {conteos[t.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por jugadora/o, DNI, club o número de pase…"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
        />
      </div>

      {/* Móvil: tarjetas */}
      <div className="flex flex-col gap-3 md:hidden">
        {filtradas.map((f) => (
          <Link
            key={f.id}
            href={`/admin/tramites/pases/${f.id}`}
            className={`bg-white border rounded-2xl p-4 flex flex-col gap-2 active:scale-[0.99] transition ${
              f.trabado ? "border-red-300 ring-1 ring-red-100" : "border-slate-200"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-serif text-sm font-black text-[#1A2A44] truncate">{f.jugador}</p>
              {renderBadge(f)}
            </div>
            <p className="text-[11px] text-slate-500">
              {f.origen} → <span className="font-bold text-slate-700">{f.destino}</span>
              {f.numeroPase ? ` · ${f.numeroPase}` : ""}
            </p>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-400">
                Sin movimiento hace {horasDesdeIso(f.ultimaActividad)} hs
              </p>
              {f.trabado && (
                <span className="text-[9px] font-black text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> TRABADO
                </span>
              )}
            </div>
          </Link>
        ))}
        {filtradas.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-500">No hay trámites en esta pestaña.</p>
          </div>
        )}
      </div>

      {/* Desktop: tabla */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b text-left">
              <th className="py-3 px-4">Jugador</th>
              <th className="py-3 px-3">Origen → Destino</th>
              <th className="py-3 px-3">Estado</th>
              <th className="py-3 px-3">Último movimiento</th>
              <th className="py-3 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((f) => (
              <tr key={f.id} className={`hover:bg-slate-50/60 transition ${f.trabado ? "bg-red-50/40" : ""}`}>
                <td className="py-3 px-4">
                  <p className="font-bold text-[#1A2A44]">{f.jugador}</p>
                  <p className="text-[10px] text-slate-400">DNI {f.dni}</p>
                </td>
                <td className="py-3 px-3 text-slate-600">
                  {f.origen} <ArrowRight className="w-3 h-3 inline text-slate-300" />{" "}
                  <span className="font-semibold">{f.destino}</span>
                  {f.numeroPase && <p className="text-[10px] text-slate-400">{f.numeroPase}</p>}
                </td>
                <td className="py-3 px-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {renderBadge(f)}
                    {f.trabado && (
                      <span className="text-[9px] font-black text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> TRABADO
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-3 text-slate-500">
                  {formatoFechaHora(f.ultimaActividad)}
                  <p className="text-[10px] text-slate-400">hace {horasDesdeIso(f.ultimaActividad)} hs</p>
                </td>
                <td className="py-3 px-3">
                  <Link
                    href={`/admin/tramites/pases/${f.id}`}
                    className="px-3 py-1.5 rounded-xl bg-[#1A2A44] text-white text-[10px] font-bold hover:bg-[#25375a]"
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-slate-400 font-semibold">
                  No hay trámites en esta pestaña.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
