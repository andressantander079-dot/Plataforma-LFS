"use client";

import { Fragment, useState, useTransition } from "react";
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
} from "lucide-react";
import { PanelInscribirJugador } from "@/components/admin/PanelInscribirJugador";
import { FichaJugadorClub } from "@/components/club/FichaJugadorClub";
import { calcularEdad, calcularEsMenor } from "@/lib/core/rules/jugadoresRules";
import { crearPlantel, eliminarPlantel } from "@/lib/actions/equipos.actions";

/**
 * PLANTELES DEL CLUB (Paso 10B)
 * Flujo: 1) crear el plantel de una categoría → 2) inscribir jugadores
 * dentro de ese plantel (con DNI, fecha de nacimiento, foto y los 4
 * documentos obligatorios). La categoría tiene que ser la de su año.
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
  status: "activo" | "inactivo";
  fechaNacimiento: string | null;
  fotoUrl: string | null;
  documentosCargados: string[]; // claves presentes en players.documents
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
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const totalJugadores = planteles.reduce((acc, p) => acc + p.jugadores.length, 0);

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
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Users className="w-7 h-7 text-[#F97316]" />
          Planteles de {clubName}
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          {planteles.length === 0
            ? "Todavía no tenés planteles. Creá el primero para empezar a inscribir jugadores."
            : `${planteles.length} plantel${planteles.length === 1 ? "" : "es"} · ${totalJugadores} jugador${totalJugadores === 1 ? "" : "es"} inscripto${totalJugadores === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Crear plantel */}
      {categoriasSinPlantel.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#F97316]" />
              1️⃣ Crear plantel por categoría
            </label>
            <select
              value={categoriaNueva}
              onChange={(e) => setCategoriaNueva(e.target.value)}
              className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
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

      {/* Planteles */}
      {planteles.length === 0 && categoriasSinPlantel.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          No hay categorías configuradas. La liga las carga desde su panel de configuración.
        </p>
      )}

      {planteles.map((p) => (
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
                {p.jugadores.length === 0
                  ? "Sin jugadores todavía"
                  : `${p.jugadores.length} jugador${p.jugadores.length === 1 ? "" : "es"}`}
              </p>
            </div>
            {p.jugadores.length === 0 && (
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
          {p.jugadores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-slate-400 font-bold uppercase border-b text-left">
                    <th className="py-2 px-4">Jugador</th>
                    <th className="py-2 px-2">DNI</th>
                    <th className="py-2 px-2">Edad</th>
                    <th className="py-2 px-2 text-center">Documentos</th>
                    <th className="py-2 px-2 text-center">Estado</th>
                    <th className="py-2 px-2 text-center">Ficha</th>
                  </tr>
                </thead>
                <tbody>
                  {p.jugadores.map((j) => {
                    const edad = j.fechaNacimiento ? calcularEdad(j.fechaNacimiento) : null;
                    const esMenor = calcularEsMenor(j.fechaNacimiento);
                    const abierta = fichaAbiertaId === j.id;
                    return (
                      <Fragment key={j.id}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={j.fotoUrl ?? "/jugador-default.png"}
                                alt={`Foto de ${j.fullName}`}
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 bg-slate-100"
                              />
                              <span className="font-bold text-[#1A2A44]">{j.fullName}</span>
                              {esMenor && (
                                <span
                                  className="text-[9px] font-black text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-md flex items-center gap-0.5"
                                  title="Menor de 18: sus pases necesitan la firma de un tutor"
                                >
                                  <ShieldAlert className="w-3 h-3" /> MENOR
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-slate-600">{j.dni}</td>
                          <td className="py-2.5 px-2 text-slate-600">
                            {edad !== null ? `${edad} años` : "⚠️ sin fecha"}
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                j.documentosCargados.length >= 4
                                  ? "text-green-700 bg-green-100"
                                  : "text-amber-700 bg-amber-100"
                              }`}
                            >
                              {j.documentosCargados.length}/4 docs
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                j.status === "activo"
                                  ? "text-green-700 bg-green-100"
                                  : "text-red-600 bg-red-100"
                              }`}
                            >
                              {j.status === "activo" ? "Activo" : "Inactivo"}
                            </span>
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => setFichaAbiertaId(abierta ? null : j.id)}
                              className="text-[10px] font-bold text-[#F97316] hover:text-[#1A2A44] transition flex items-center gap-0.5 mx-auto"
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
                            <td colSpan={6} className="px-4 py-4">
                              <FichaJugadorClub jugador={j} />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

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
