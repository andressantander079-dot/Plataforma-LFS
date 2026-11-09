"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Newspaper,
  Tags,
  BarChart3,
  Plus,
  Pencil,
  Star,
  Eye,
  Heart,
  CalendarClock,
  Archive,
  RotateCcw,
  Trash2,
  Globe,
} from "lucide-react";
import type { PanelNoticias, NoticiaAdminUI } from "@/lib/actions/noticias.actions";
import {
  cambiarEstadoNoticia,
  eliminarNoticia,
} from "@/lib/actions/noticias.actions";
import { ESTADO_NOTICIA_UI, type EstadoDerivadoNoticia } from "@/lib/core/rules/noticiasRules";
import { GestionCategoriasNoticias } from "./GestionCategoriasNoticias";
import { EstadisticasNoticias } from "./EstadisticasNoticias";

type Pestaña = "noticias" | "categorias" | "estadisticas";

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BadgeEstado({ estado }: { estado: EstadoDerivadoNoticia }) {
  const ui = ESTADO_NOTICIA_UI[estado];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${ui.badge}`}
    >
      {ui.label}
    </span>
  );
}

function TarjetaKpi({ titulo, valor, detalle }: { titulo: string; valor: string | number; detalle?: string }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
      <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase block">{titulo}</span>
      <span className="text-2xl font-serif font-black text-[#1A2A44] block mt-1">{valor}</span>
      {detalle ? <span className="text-xs text-slate-500 block mt-0.5">{detalle}</span> : null}
    </div>
  );
}

export function NoticiasTabs({ panel }: { panel: PanelNoticias }) {
  const [pestaña, setPestaña] = useState<Pestaña>("noticias");
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function accionRapida(n: NoticiaAdminUI, accion: "publicar" | "despublicar" | "archivar" | "a_borrador") {
    if (ocupado) return;
    setOcupado(n.id);
    const r = await cambiarEstadoNoticia(n.id, accion);
    setOcupado(null);
    if (!r.ok) alert(r.error ?? "No se pudo completar la acción.");
    router.refresh();
  }

  async function borrar(n: NoticiaAdminUI) {
    if (ocupado) return;
    if (!confirm(`¿Borrar el borrador "${n.titulo}"? Esta acción no se puede deshacer.`)) return;
    setOcupado(n.id);
    const r = await eliminarNoticia(n.id);
    setOcupado(null);
    if (!r.ok) alert(r.error ?? "No se pudo borrar.");
    router.refresh();
  }

  const tabs: Array<{ id: Pestaña; nombre: string; icono: typeof Newspaper }> = [
    { id: "noticias", nombre: "Noticias", icono: Newspaper },
    { id: "categorias", nombre: "Categorías", icono: Tags },
    { id: "estadisticas", nombre: "Estadísticas", icono: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Newspaper className="w-7 h-7 text-[#F97316]" />
            Noticias
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Publicaciones del portal público: redactá, programá y destacá novedades de la liga.
          </p>
        </div>
        <Link
          href="/admin/noticias/nueva"
          id="btn-nueva-noticia"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-orange-500/25 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nueva noticia
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`tab-noticias-${t.id}`}
            onClick={() => setPestaña(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${
              pestaña === t.id
                ? "bg-white text-[#1A2A44] shadow-sm"
                : "text-slate-500 hover:text-[#1A2A44]"
            }`}
          >
            <t.icono className="w-4 h-4" />
            {t.nombre}
          </button>
        ))}
      </div>

      {pestaña === "noticias" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TarjetaKpi titulo="Publicadas" valor={panel.kpis.publicadas} detalle={`de ${panel.kpis.total} en total`} />
            <TarjetaKpi titulo="Borradores" valor={panel.kpis.borradores} />
            <TarjetaKpi titulo="Programadas" valor={panel.kpis.programadas} />
            <TarjetaKpi
              titulo="Alcance"
              valor={panel.kpis.vistasTotales.toLocaleString("es-AR")}
              detalle={`${panel.kpis.likesTotales.toLocaleString("es-AR")} me gusta`}
            />
          </div>

          {/* Lista */}
          {panel.noticias.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
              <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">
                Todavía no hay noticias. Creá la primera con el botón <b>“Nueva noticia”</b>.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {panel.noticias.map((n) => (
                <div
                  key={n.id}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* Miniatura */}
                  <div className="w-full sm:w-28 h-20 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                    {n.portadaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.portadaUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-slate-300 text-lg">LFS</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BadgeEstado estado={n.estadoDerivado} />
                      {n.destacada && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700">
                          <Star className="w-3 h-3" /> Destacada
                        </span>
                      )}
                      {n.categoriaNombre && (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ backgroundColor: n.categoriaColor ?? "#64748B" }}
                        >
                          {n.categoriaNombre}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-[#1A2A44] mt-1.5 truncate">{n.titulo}</h3>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" /> {n.vistas.toLocaleString("es-AR")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> {n.likes.toLocaleString("es-AR")}
                      </span>
                      {n.estado === "programada" && n.publicarAt && (
                        <span className="flex items-center gap-1 text-sky-600">
                          <CalendarClock className="w-3.5 h-3.5" /> Sale {formatearFecha(n.publicarAt)}
                        </span>
                      )}
                      {n.publicadaAt && <span>Publicada {formatearFecha(n.publicadaAt)}</span>}
                      {n.venceAt && <span className="text-rose-500">Vence {formatearFecha(n.venceAt)}</span>}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <Link
                      href={`/admin/noticias/${n.id}`}
                      id={`btn-editar-noticia-${n.id}`}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1A2A44] transition"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    {(n.estado === "borrador" || n.estado === "programada" || n.estado === "archivada") && (
                      <button
                        id={`btn-publicar-noticia-${n.id}`}
                        onClick={() => accionRapida(n, "publicar")}
                        disabled={ocupado === n.id}
                        className="p-2 rounded-lg text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 transition disabled:opacity-40"
                        title="Publicar ahora"
                      >
                        <Globe className="w-4 h-4" />
                      </button>
                    )}
                    {n.estado === "publicada" && (
                      <button
                        id={`btn-despublicar-noticia-${n.id}`}
                        onClick={() => accionRapida(n, "despublicar")}
                        disabled={ocupado === n.id}
                        className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition disabled:opacity-40"
                        title="Despublicar (archivar)"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                    {n.estado === "archivada" && (
                      <button
                        id={`btn-borrador-noticia-${n.id}`}
                        onClick={() => accionRapida(n, "a_borrador")}
                        disabled={ocupado === n.id}
                        className="p-2 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-sky-600 transition disabled:opacity-40"
                        title="Volver a borrador"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {n.estado === "borrador" && (
                      <button
                        id={`btn-borrar-noticia-${n.id}`}
                        onClick={() => borrar(n)}
                        disabled={ocupado === n.id}
                        className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-40"
                        title="Borrar borrador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pestaña === "categorias" && <GestionCategoriasNoticias categorias={panel.categorias} />}
      {pestaña === "estadisticas" && <EstadisticasNoticias />}
    </div>
  );
}
