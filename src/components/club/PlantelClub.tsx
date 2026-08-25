"use client";

import { useState } from "react";
import { Users, FileText, CheckCircle, AlertCircle, Search, Filter } from "lucide-react";
import { CeldaDocumento } from "@/components/admin/CeldaDocumento";

export interface JugadorPlantel {
  id: string;
  dni: string;
  fullName: string;
  status: "activo" | "inactivo";
  categories: string[];
  documents: Record<string, string>;
}

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

interface Props {
  clubId: string;
  clubName: string;
  jugadores: JugadorPlantel[];
  categories: Category[];
}

const DOCS = [
  { tipo: "medical" as const, titulo: "Ficha Médica" },
  { tipo: "ddjj" as const, titulo: "Declaración Jurada" },
  { tipo: "photo" as const, titulo: "Foto DNI" },
];

export function PlantelClub({
  clubId,
  clubName,
  jugadores,
  categories,
}: Props) {
  const [buscar, setBuscar] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("TODAS");

  // Filtros aplicados
  const jugadoresFiltrados = jugadores.filter((j) => {
    const coincideBusqueda =
      j.fullName.toLowerCase().includes(buscar.toLowerCase()) ||
      j.dni.includes(buscar);
    
    const coincideCategoria =
      categoriaSeleccionada === "TODAS" ||
      j.categories.includes(categoriaSeleccionada);

    return coincideBusqueda && coincideCategoria;
  });

  // Métricas rápidas
  const totalJugadores = jugadores.length;
  const conFichaMedica = jugadores.filter((j) => j.documents.medical).length;
  const listos = jugadores.filter(
    (j) => j.documents.medical && j.documents.ddjj && j.documents.photo
  ).length;
  const faltantes = totalJugadores - listos;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#F97316]" />
            Plantel y Fichas
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Portal de {clubName} — control interno de documentación y categorías habilitadas.
          </p>
        </div>
      </section>

      {/* Resumen de Fichaje (Métricas rápidas) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1A2A44]/5 text-[#1A2A44] rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Plantel Total</span>
            <span className="text-lg font-black text-[#1A2A44]">{totalJugadores} jugadores</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Habilitados Completos</span>
            <span className="text-lg font-black text-green-700">{listos} al día</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Documentación Pendiente</span>
            <span className="text-lg font-black text-red-600">{faltantes} incompletos</span>
          </div>
        </div>
      </div>

      {/* Controles de Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Campo de búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por Nombre o DNI..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] bg-slate-50/50 text-[#1A2A44]"
          />
        </div>

        {/* Categorías */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={categoriaSeleccionada}
            onChange={(e) => setCategoriaSeleccionada(e.target.value)}
            className="w-full sm:w-48 p-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-[#1A2A44] focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          >
            <option value="TODAS">Todas las Categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Jugadores */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 overflow-x-auto">
        {jugadoresFiltrados.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <Users className="w-8 h-8 text-slate-300" />
            <p className="text-slate-500 text-sm">
              No se encontraron jugadores con los filtros seleccionados.
            </p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-wider border-b border-slate-150 text-left">
                <th className="py-3 px-3">Jugador</th>
                <th className="py-3 px-3">DNI</th>
                <th className="py-3 px-3">Categorías</th>
                <th className="py-3 px-3 text-center">Ficha Médica</th>
                <th className="py-3 px-3 text-center">DDJJ</th>
                <th className="py-3 px-3 text-center">Foto DNI</th>
                <th className="py-3 px-3 text-center">Habilitación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {jugadoresFiltrados.map((player) => (
                <tr key={player.id} className="hover:bg-slate-50/50 transition">
                  <td className="py-4 px-3 font-bold text-[#1A2A44] text-xs">
                    {player.fullName}
                  </td>
                  <td className="py-4 px-3 font-mono text-slate-500 text-xs">
                    {player.dni}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex flex-wrap gap-1">
                      {player.categories.map((cat) => (
                        <span
                          key={cat}
                          className="px-2 py-0.5 rounded-full bg-[#1A2A44]/5 text-[#1A2A44] text-[9px] font-bold"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  {DOCS.map((doc) => (
                    <td key={doc.tipo} className="py-4 px-3 text-center">
                      <CeldaDocumento
                        clubId={clubId}
                        playerId={player.id}
                        tipo={doc.tipo}
                        ruta={player.documents[doc.tipo] ?? null}
                        titulo={doc.titulo}
                      />
                    </td>
                  ))}
                  <td className="py-4 px-3 text-center">
                    <span
                      className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        player.status === "activo"
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {player.status === "activo" ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Leyenda de Ayuda */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
          <FileText className="w-4 h-4 text-[#F97316] shrink-0" />
          <p>
            Instrucciones: Hacé clic sobre el ícono rojo (<span className="text-red-500">⚠</span>) para subir la documentación médica, DDJJ o DNI del jugador. Cuando esté aprobada aparecerá en verde (<span className="text-green-600">✔</span>) y podrás hacer clic para visualizarla. Si hay algún dato incorrecto, reportalo vía Mensajería.
          </p>
        </div>
      </section>
    </div>
  );
}
