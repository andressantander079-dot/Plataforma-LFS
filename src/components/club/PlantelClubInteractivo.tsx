"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import {
  Users,
  Plus,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Layers,
  Trash2,
  Loader2,
  AlertCircle,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Info,
} from "lucide-react";
import { PanelInscribirJugador } from "@/components/admin/PanelInscribirJugador";
import { FichaJugadorClub } from "@/components/club/FichaJugadorClub";
import {
  calcularEdad,
  calcularEsMenor,
  estadoJugadorInfo,
  type EstadoJugador,
} from "@/lib/core/rules/jugadoresRules";
import { crearPlantel, eliminarPlantel } from "@/lib/actions/equipos.actions";

/**
 * PLANTELES DEL CLUB (Paso 10B + Renovación Federativa)
 * Flujo:
 * 1) Crear el plantel de cada categoría de la institución.
 * 2) Inscribir jugadores (DNI único, fecha de nacimiento, foto y 4 documentos).
 * 3) Seguimiento reglamentario:
 *    - Los jugadores arrancan en "En revisión" en la Federación (Trámites).
 *    - La Federación dictamina: Aprobado (activo), En deuda (activo provisorio) o Denegado.
 *    - Si un jugador fue transferido a otro club ("Pase efectivo"), ya no pertenece a este plantel.
 */

export interface CategoriaConRangoUI {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

export interface JugadorFila {
  id: string;
  dni: string;
  fullName: string;
  status: EstadoJugador;
  fechaNacimiento: string | null;
  fotoUrl: string | null;
  numeroCamiseta?: number | null;
  documentosCargados: string[]; // claves presentes en players.documents
  documents?: Record<string, string>;
}

export interface PlantelUI {
  plantelId: string;
  categoria: CategoriaConRangoUI;
  jugadores: JugadorFila[];
}

function rangoTexto(c: CategoriaConRangoUI): string {
  return c.anio_desde && c.anio_hasta
    ? `nacidos ${c.anio_desde}–${c.anio_hasta}`
    : "sin límite de edad";
}

type FiltroTab = "todos" | "activo" | "pendiente" | "en_deuda" | "denegado" | "incompleto";

export function PlantelClubInteractivo({
  clubId,
  clubName,
  planteles,
  categoriasSinPlantel,
}: {
  clubId: string;
  clubName: string;
  planteles: PlantelUI[];
  categoriasSinPlantel: CategoriaConRangoUI[];
}) {
  const [categoriaNueva, setCategoriaNueva] = useState("");
  const [panelCategoria, setPanelCategoria] = useState<CategoriaConRangoUI | null>(null);
  const [fichaAbiertaId, setFichaAbiertaId] = useState<string | null>(null);
  const [filtroTab, setFiltroTab] = useState<FiltroTab>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // Todos los jugadores acumulados de todos los planteles para KPIs globales del club
  const todosLosJugadores = useMemo(
    () => planteles.flatMap((p) => p.jugadores),
    [planteles]
  );

  const kpis = useMemo(() => {
    let activos = 0;
    let pendientes = 0;
    let enDeuda = 0;
    let denegados = 0;
    let docsIncompletos = 0;

    for (const j of todosLosJugadores) {
      if (j.status === "activo") activos++;
      else if (j.status === "pendiente") pendientes++;
      else if (j.status === "en_deuda") enDeuda++;
      else if (j.status === "denegado") denegados++;

      if (j.documentosCargados.length < 4) {
        docsIncompletos++;
      }
    }

    return {
      total: todosLosJugadores.length,
      activos,
      pendientes,
      enDeuda,
      denegados,
      docsIncompletos,
      habilitados: activos + enDeuda,
    };
  }, [todosLosJugadores]);

  // Filtrado reactivo por categoría según filtroTab y busqueda
  const plantelesFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return planteles.map((p) => {
      const jugadores = p.jugadores.filter((j) => {
        // Filtro de estado
        if (filtroTab === "activo" && j.status !== "activo") return false;
        if (filtroTab === "pendiente" && j.status !== "pendiente") return false;
        if (filtroTab === "en_deuda" && j.status !== "en_deuda") return false;
        if (filtroTab === "denegado" && j.status !== "denegado") return false;
        if (filtroTab === "incompleto" && j.documentosCargados.length >= 4) return false;

        // Buscador por nombre o DNI
        if (q) {
          const matchTexto = `${j.fullName} ${j.dni}`.toLowerCase();
          if (!matchTexto.includes(q)) return false;
        }

        return true;
      });

      return {
        ...p,
        jugadores,
      };
    });
  }, [planteles, filtroTab, busqueda]);

  function handleCrearPlantel() {
    if (!categoriaNueva) return;
    setError(null);
    startTransition(async () => {
      const res = await crearPlantel(clubId, categoriaNueva);
      if (res.error) setError(res.error);
      else setCategoriaNueva("");
    });
  }

  function handleEliminarPlantel(p: PlantelUI) {
    if (
      !window.confirm(
        `¿Eliminar el plantel de ${p.categoria.name}? Solo se puede si no tiene jugadores.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const res = await eliminarPlantel(p.plantelId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <div className="border-b pb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#F97316]" />
            Planteles de {clubName}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            {planteles.length === 0
              ? "Todavía no tenés planteles. Creá el primero para empezar a inscribir jugadores."
              : `${planteles.length} plantel${planteles.length === 1 ? "" : "es"} · ${kpis.total} jugador${kpis.total === 1 ? "" : "es"} inscripto${kpis.total === 1 ? "" : "s"} (${kpis.habilitados} habilitados para competir)`}
          </p>
        </div>

        {/* Resumen rápido de habilitación */}
        {kpis.total > 0 && (
          <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {kpis.habilitados} de {kpis.total} habilitados para planilla
            </span>
          </div>
        )}
      </div>

      {/* Banner Informativo de Trámites y Documentación */}
      <div className="bg-gradient-to-r from-slate-900 to-[#1A2A44] text-white p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl text-[#F97316] shrink-0 mt-0.5 md:mt-0">
            <Info className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-white text-sm">
              Inscripciones y Revisión Federativa de Jugadores
            </p>
            <p className="text-slate-300 mt-1 leading-relaxed">
              Los jugadores registrados quedan en estado{" "}
              <b className="text-amber-300 font-bold">En revisión</b> hasta que la Federación
              audite sus documentos en Trámites. Abrí la <b>Ficha</b> de cada jugador para subir
              los 4 documentos requeridos (DNI, CEMAD médico, CEMAD autorización y pago) y
              acelerar su habilitación.
            </p>
          </div>
        </div>
      </div>

      {/* KPIs Interactivos (Filtros de 1 clic) */}
      {kpis.total > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setFiltroTab("todos")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroTab === "todos"
                ? "bg-[#1A2A44] text-white border-[#1A2A44] shadow"
                : "bg-white border-slate-200 hover:border-slate-300 text-[#1A2A44]"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-wider ${
                filtroTab === "todos" ? "text-slate-300" : "text-slate-400"
              }`}
            >
              Total Jugadores
            </p>
            <p className="text-2xl font-black mt-0.5">{kpis.total}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                filtroTab === "todos" ? "text-slate-300" : "text-slate-500"
              }`}
            >
              {kpis.habilitados} habilitados
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab(filtroTab === "activo" ? "todos" : "activo")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroTab === "activo"
                ? "bg-emerald-600 text-white border-emerald-700 shadow"
                : "bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100 text-emerald-900"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                filtroTab === "activo" ? "text-emerald-100" : "text-emerald-700"
              }`}
            >
              <CheckCircle2 className="w-3 h-3" /> Activos
            </p>
            <p className="text-2xl font-black mt-0.5">{kpis.activos}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                filtroTab === "activo" ? "text-emerald-100" : "text-emerald-700"
              }`}
            >
              Habilitados 100%
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab(filtroTab === "pendiente" ? "todos" : "pendiente")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroTab === "pendiente"
                ? "bg-amber-500 text-white border-amber-600 shadow"
                : "bg-amber-50/70 border-amber-200 hover:bg-amber-100 text-amber-900"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                filtroTab === "pendiente" ? "text-amber-100" : "text-amber-700"
              }`}
            >
              <Clock className="w-3 h-3" /> En Revisión
            </p>
            <p className="text-2xl font-black mt-0.5">{kpis.pendientes}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                filtroTab === "pendiente" ? "text-amber-100" : "text-amber-700"
              }`}
            >
              Pendientes en Liga
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab(filtroTab === "en_deuda" ? "todos" : "en_deuda")}
            className={`text-left p-3.5 rounded-2xl border transition ${
              filtroTab === "en_deuda"
                ? "bg-orange-500 text-white border-orange-600 shadow"
                : "bg-orange-50/70 border-orange-200 hover:bg-orange-100 text-orange-900"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                filtroTab === "en_deuda" ? "text-orange-100" : "text-orange-700"
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> En Deuda
            </p>
            <p className="text-2xl font-black mt-0.5">{kpis.enDeuda}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                filtroTab === "en_deuda" ? "text-orange-100" : "text-orange-700"
              }`}
            >
              Activo provisorio
            </p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroTab(filtroTab === "incompleto" ? "todos" : "incompleto")}
            className={`text-left p-3.5 rounded-2xl border transition col-span-2 sm:col-span-1 ${
              filtroTab === "incompleto"
                ? "bg-rose-600 text-white border-rose-700 shadow"
                : "bg-rose-50/70 border-rose-200 hover:bg-rose-100 text-rose-900"
            }`}
          >
            <p
              className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                filtroTab === "incompleto" ? "text-rose-100" : "text-rose-700"
              }`}
            >
              <FileText className="w-3 h-3" /> Faltan Docs
            </p>
            <p className="text-2xl font-black mt-0.5">{kpis.docsIncompletos}</p>
            <p
              className={`text-[10px] mt-0.5 ${
                filtroTab === "incompleto" ? "text-rose-100" : "text-rose-700"
              }`}
            >
              Menos de 4 docs
            </p>
          </button>
        </section>
      )}

      {/* Buscador y Filtros */}
      {kpis.total > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar jugador por nombre o DNI…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 bg-white"
            />
          </div>

          {filtroTab !== "todos" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">
                Filtrado por: <b className="text-[#1A2A44]">{filtroTab}</b>
              </span>
              <button
                type="button"
                onClick={() => setFiltroTab("todos")}
                className="text-xs font-bold text-[#F97316] hover:underline"
              >
                Limpiar filtro
              </button>
            </div>
          )}
        </div>
      )}

      {/* Crear plantel */}
      {categoriasSinPlantel.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#F97316]" />
              Crear plantel por categoría
            </label>
            <select
              value={categoriaNueva}
              onChange={(e) => setCategoriaNueva(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 bg-white"
            >
              <option value="">Elegí la categoría…</option>
              {categoriasSinPlantel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({rangoTexto(c)})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={pendiente || !categoriaNueva}
            onClick={handleCrearPlantel}
            className="px-4 py-2.5 bg-[#1A2A44] text-white font-bold text-xs rounded-xl hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crear plantel
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {/* Listado de Planteles */}
      {planteles.length === 0 && categoriasSinPlantel.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No hay categorías configuradas. La liga las carga desde su panel de configuración.
        </p>
      )}

      {plantelesFiltrados.map((p) => {
        const jugadoresMostrados = p.jugadores;
        const totalOriginal =
          planteles.find((orig) => orig.plantelId === p.plantelId)?.jugadores.length ?? 0;

        return (
          <div
            key={p.plantelId}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
          >
            {/* Cabecera del plantel */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex-1 min-w-[180px]">
                <p className="font-black text-sm text-[#1A2A44] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#F97316]" />
                  Plantel {p.categoria.name}
                  <span className="text-[10px] font-bold text-slate-400">
                    ({rangoTexto(p.categoria)})
                  </span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {totalOriginal === 0
                    ? "Sin jugadores todavía"
                    : `${totalOriginal} jugador${totalOriginal === 1 ? "" : "es"} inscripto${totalOriginal === 1 ? "" : "s"}`}
                  {filtroTab !== "todos" || busqueda
                    ? ` · mostrando ${jugadoresMostrados.length}`
                    : ""}
                </p>
              </div>

              {totalOriginal === 0 && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => handleEliminarPlantel(p)}
                  className="px-3 py-2 rounded-xl border border-red-200 text-red-500 text-[11px] font-bold hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                </button>
              )}

              <button
                type="button"
                onClick={() => setPanelCategoria(p.categoria)}
                className="px-4 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl hover:bg-[#F97316]/95 transition shadow-md flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Inscribir jugador
              </button>
            </div>

            {/* Jugadores del plantel */}
            {jugadoresMostrados.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-bold uppercase border-b text-left bg-slate-50/30">
                      <th className="py-2.5 px-3 text-center">N°</th>
                      <th className="py-2.5 px-4">Jugador</th>
                      <th className="py-2.5 px-2">DNI</th>
                      <th className="py-2.5 px-2">Edad</th>
                      <th className="py-2.5 px-2 text-center">Documentos</th>
                      <th className="py-2.5 px-2 text-center">Estado LFS</th>
                      <th className="py-2.5 px-2 text-center">Ficha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jugadoresMostrados.map((j) => {
                      const edad = j.fechaNacimiento ? calcularEdad(j.fechaNacimiento) : null;
                      const esMenor = calcularEsMenor(j.fechaNacimiento);
                      const abierta = fichaAbiertaId === j.id;
                      const infoEstado = estadoJugadorInfo(j.status);
                      const cantDocs = j.documentosCargados.length;

                      return (
                        <Fragment key={j.id}>
                          <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition">
                            <td className="py-2.5 px-3 text-center">
                              {j.numeroCamiseta ? (
                                <span className="inline-block font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-orange-100 text-[#F97316] border border-orange-200">
                                  #{j.numeroCamiseta}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-300 font-mono italic" title="Sin camiseta asignada">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={j.fotoUrl ?? "/jugador-default.png"}
                                  alt={`Foto de ${j.fullName}`}
                                  className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100 shrink-0"
                                />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-[#1A2A44] truncate">
                                    {j.fullName}
                                  </span>
                                  {esMenor && (
                                    <span
                                      className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded-md flex items-center gap-0.5 w-fit mt-0.5"
                                      title="Menor de 18: sus pases necesitan la firma de un tutor"
                                    >
                                      <ShieldAlert className="w-2.5 h-2.5" /> MENOR
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-2.5 px-2 font-mono text-slate-600">{j.dni}</td>
                            <td className="py-2.5 px-2 text-slate-600">
                              {edad !== null ? `${edad} años` : "⚠️ sin fecha"}
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md inline-block ${
                                  cantDocs >= 4
                                    ? "text-emerald-700 bg-emerald-100"
                                    : "text-amber-800 bg-amber-100"
                                }`}
                              >
                                {cantDocs}/4 docs
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span
                                title={infoEstado.descripcion}
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border inline-block ${infoEstado.badgeClase}`}
                              >
                                {infoEstado.label}
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => setFichaAbiertaId(abierta ? null : j.id)}
                                className="text-[11px] font-bold text-[#F97316] hover:text-[#1A2A44] transition flex items-center gap-0.5 mx-auto px-2 py-1 rounded-lg hover:bg-orange-50"
                              >
                                {abierta ? (
                                  <>
                                    Cerrar <ChevronUp className="w-3.5 h-3.5" />
                                  </>
                                ) : (
                                  <>
                                    Ver ficha <ChevronDown className="w-3.5 h-3.5" />
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                          {abierta && (
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                              <td colSpan={7} className="px-4 py-4">
                                <FichaJugadorClub jugador={j} clubId={clubId} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : totalOriginal > 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/50">
                Ningún jugador coincide con el filtro seleccionado en este plantel.
              </div>
            ) : null}
          </div>
        );
      })}

      <p className="text-[11px] text-slate-400">
        💡 El DNI es la identidad única del jugador en toda la liga: si ya figura en otro club,
        no lo inscribas — corresponde un <b>pase</b> desde la pantalla de Trámites. Los jugadores
        pueden jugar <b>para arriba</b> en la planilla del partido, pero en el plantel solo se
        inscriben en la categoría de su año.
      </p>

      {/* Panel lateral de inscripción (con la categoría del plantel ya elegida) */}
      <PanelInscribirJugador
        clubId={clubId}
        clubName={clubName}
        categories={planteles.map((p) => p.categoria)}
        abierto={panelCategoria !== null}
        onCerrar={() => setPanelCategoria(null)}
        categoriaFija={panelCategoria ?? undefined}
      />
    </div>
  );
}
