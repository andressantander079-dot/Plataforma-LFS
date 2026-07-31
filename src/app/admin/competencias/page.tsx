"use client";

import Link from "next/link";
import { Trophy, Plus, FileText, Calendar, Archive, Eye } from "lucide-react";

const MOCK_COMPETITIONS = [
  { id: "c1", name: "Torneo Apertura 2026", year: 2026, category: "Primera", gender: "Masculino", teamsCount: 8, status: "Activo" },
  { id: "c2", name: "Copa Femenina Ushuaia 2026", year: 2026, category: "Primera", gender: "Femenino", teamsCount: 6, status: "Activo" },
  { id: "c3", name: "Torneo Clausura 2025", year: 2025, category: "Sub-18", gender: "Masculino", teamsCount: 10, status: "Archivado" },
];

export default function CompetenciasAdmin() {
  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <Trophy className="w-8 h-8 text-[#F97316]" />
            Gestión de Competencias
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Administra, crea y edita los torneos oficiales y copas de la LFS.
          </p>
        </div>

        <Link
          href="/admin/competencias/crear"
          id="btn-create-competition"
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs self-stretch sm:self-auto text-center justify-center"
        >
          <Plus className="w-4 h-4" />
          Nueva Competencia
        </Link>
      </section>

      {/* Lista de Competencias Activas */}
      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">
          Torneos en Curso
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MOCK_COMPETITIONS.map((comp) => (
            <div
              key={comp.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col justify-between shadow-sm hover:shadow-md transition duration-250"
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    comp.status === "Activo"
                      ? "bg-green-50 text-green-700 border border-green-150"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {comp.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-400">Año {comp.year}</span>
                </div>
                <h4 className="font-serif text-lg font-bold text-[#1A2A44] mb-2 leading-snug">
                  {comp.name}
                </h4>
                <p className="text-xs text-slate-500 mb-4 font-semibold">
                  Categoría: {comp.category} • Rama: {comp.gender}
                </p>
                <div className="flex items-center gap-2 mb-6">
                  <span className="text-slate-400 text-xs font-bold">{comp.teamsCount} Equipos</span>
                  <span className="text-slate-350">•</span>
                  <span className="text-slate-400 text-xs font-semibold">Fútbol Sala</span>
                </div>
              </div>

              {/* Botones de acción del admin */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                <Link
                  href={`/admin/competencias/${comp.id}`}
                  className="flex-1 px-3 py-2 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] text-slate-700 transition flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Detalle
                </Link>
                <Link
                  href={`/admin/competencias/${comp.id}/fixture`}
                  className="flex-1 px-3 py-2 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] text-slate-700 transition flex items-center justify-center gap-1.5"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Fixture
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
