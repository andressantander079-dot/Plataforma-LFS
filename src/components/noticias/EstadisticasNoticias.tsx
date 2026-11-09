"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Heart, Newspaper, TrendingUp, Tags, BarChart3 } from "lucide-react";
import type { EstadisticasNoticias as Datos } from "@/lib/actions/noticias.actions";
import { obtenerEstadisticasNoticias } from "@/lib/actions/noticias.actions";

function formatearDia(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

export function EstadisticasNoticias() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    obtenerEstadisticasNoticias()
      .then(setDatos)
      .catch(() => setError("No pude cargar las estadísticas."));
  }, []);

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-700 text-sm font-semibold">
        {error}
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center text-slate-400 text-sm animate-pulse">
        Calculando estadísticas…
      </div>
    );
  }

  const maxVistasDia = Math.max(1, ...datos.vistasPorDia.map((d) => d.vistas));

  return (
    <div className="flex flex-col gap-6">
      {/* Totales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-1">
            <Newspaper className="w-3 h-3" /> Noticias
          </span>
          <span className="text-2xl font-serif font-black text-[#1A2A44] block mt-1">{datos.totales.total}</span>
          <span className="text-xs text-slate-500">{datos.totales.publicadas} publicadas</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-1">
            <Eye className="w-3 h-3" /> Lecturas
          </span>
          <span className="text-2xl font-serif font-black text-[#1A2A44] block mt-1">
            {datos.totales.vistasTotales.toLocaleString("es-AR")}
          </span>
          <span className="text-xs text-slate-500">históricas</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-1">
            <Heart className="w-3 h-3" /> Me gusta
          </span>
          <span className="text-2xl font-serif font-black text-[#1A2A44] block mt-1">
            {datos.totales.likesTotales.toLocaleString("es-AR")}
          </span>
          <span className="text-xs text-slate-500">acumulados</span>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> Promedio
          </span>
          <span className="text-2xl font-serif font-black text-[#1A2A44] block mt-1">
            {datos.totales.publicadas > 0
              ? Math.round(datos.totales.vistasTotales / datos.totales.publicadas)
              : 0}
          </span>
          <span className="text-xs text-slate-500">lecturas por publicación</span>
        </div>
      </div>

      {/* Lecturas últimos 30 días */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="font-serif font-bold text-[#1A2A44] flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-[#F97316]" />
          Lecturas de los últimos 30 días
        </h3>
        <div className="flex items-end gap-[3px] h-32">
          {datos.vistasPorDia.map((d) => (
            <div key={d.dia} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div
                className="w-full bg-[#F97316]/80 group-hover:bg-[#F97316] rounded-t transition-all min-h-[2px]"
                style={{ height: `${(d.vistas / maxVistasDia) * 100}%` }}
                title={`${formatearDia(d.dia)}: ${d.vistas} lecturas`}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-2">
          <span>{formatearDia(datos.vistasPorDia[0]?.dia ?? "")}</span>
          <span>Hoy</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top vistas */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <h3 className="font-serif font-bold text-[#1A2A44] mb-3">Más leídas</h3>
          {datos.topVistas.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay lecturas registradas.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {datos.topVistas.map((n, i) => (
                <li key={n.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <Link
                    href={`/noticias/${n.slug}`}
                    className="flex-1 text-sm font-semibold text-[#1A2A44] hover:text-[#F97316] truncate transition"
                  >
                    {n.titulo}
                  </Link>
                  <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                    <Eye className="w-3 h-3" /> {n.vistas.toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Top likes */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <h3 className="font-serif font-bold text-[#1A2A44] mb-3">Más queridas</h3>
          {datos.topLikes.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay me gusta registrados.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {datos.topLikes.map((n, i) => (
                <li key={n.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-xs font-black flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <Link
                    href={`/noticias/${n.slug}`}
                    className="flex-1 text-sm font-semibold text-[#1A2A44] hover:text-[#F97316] truncate transition"
                  >
                    {n.titulo}
                  </Link>
                  <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
                    <Heart className="w-3 h-3" /> {n.likes.toLocaleString("es-AR")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Por categoría */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <h3 className="font-serif font-bold text-[#1A2A44] flex items-center gap-2 mb-4">
          <Tags className="w-4 h-4 text-[#F97316]" />
          Rendimiento por categoría
        </h3>
        {datos.porCategoria.length === 0 ? (
          <p className="text-sm text-slate-400">Sin datos todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {datos.porCategoria.map((c) => {
              const max = datos.porCategoria[0]?.vistas || 1;
              return (
                <div key={c.nombre} className="flex items-center gap-3">
                  <span
                    className="w-28 shrink-0 text-xs font-bold truncate"
                    style={{ color: c.color }}
                  >
                    {c.nombre}
                  </span>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(c.vistas / max) * 100}%`, backgroundColor: c.color }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 w-40 text-right shrink-0">
                    {c.cantidad} not. · {c.vistas.toLocaleString("es-AR")} lect. · {c.likes.toLocaleString("es-AR")} ❤
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
