"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Trophy, BarChart3, Users, Play } from "lucide-react";

export default function CompetenciaSubPagesCatchAll() {
  const params = useParams();
  const router = useRouter();
  const compId = params.id as string;
  const slug = params.slug as string[];
  const subRoute = slug ? slug[0] : "";

  const compName = "Torneo Apertura LFS 2026";

  const renderContent = () => {
    switch (subRoute) {
      case "fixture":
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#F97316]" /> Fixture y Cronograma de Fechas
            </h3>
            <p className="text-slate-500 text-xs">Administra las fechas del torneo y resuelve conflictos de canchas u horarios.</p>
            <div className="border rounded-xl p-4 bg-slate-50 text-xs font-semibold text-slate-700 flex justify-between items-center mt-2">
              <span>Fecha 1: Camioneros vs HAF (Cochocho Vargas - Sab 16:00 hs)</span>
              <span className="text-green-600 font-bold uppercase text-[9px] px-1.5 py-0.5 bg-green-50 border rounded">Programado</span>
            </div>
          </div>
        );
      case "playoffs":
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#F97316]" /> Llaves de Eliminación Directa
            </h3>
            <p className="text-slate-500 text-xs">Estructura de Semifinal y Final con drag-and-drop para ganadores de ronda.</p>
            <div className="flex gap-4 items-center mt-4">
              <div className="flex flex-col gap-2 p-3 bg-white border rounded-xl shadow-sm text-xs font-bold text-[#1A2A44] w-48">
                <div>Camioneros</div>
                <div className="border-t pt-1 mt-1 text-slate-400">vs HAF</div>
              </div>
              <div className="text-slate-400 font-black">$\rightarrow$</div>
              <div className="p-3 bg-white border border-dashed rounded-xl text-xs font-bold text-slate-400 w-48 text-center">
                Esperando Ganador
              </div>
            </div>
          </div>
        );
      case "posiciones":
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#F97316]" /> Tabla de Posiciones Administrativa
            </h3>
            <p className="text-slate-500 text-xs">Cálculo de puntos automático según sistema: Victoria 3, Empate 1, Derrota 0.</p>
            <div className="bg-white border rounded-xl p-4 mt-2">
              <div className="flex justify-between text-xs font-bold border-b pb-2 text-[#1A2A44]">
                <span>Club</span>
                <span>Puntos</span>
              </div>
              <div className="flex justify-between text-xs font-semibold py-2 border-b">
                <span>1. Club Camioneros</span>
                <span>9 Pts</span>
              </div>
            </div>
          </div>
        );
      case "planillas":
        return (
          <div className="flex flex-col gap-4">
            <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F97316]" /> Planillas de Partido de la Competencia
            </h3>
            <p className="text-slate-500 text-xs">Control de incidentes, firmas de planilleros e impresión de actas físicas.</p>
            <div className="border rounded-xl p-4 bg-slate-50 text-xs font-semibold text-slate-700 flex justify-between items-center mt-2">
              <span>Camioneros vs HAF (Planilla Abierta)</span>
              <button onClick={() => router.push("/arbitro/planillas/p1")} className="px-3 py-1 bg-[#1A2A44] hover:bg-[#F97316] text-white font-bold rounded-lg text-[9px] transition flex items-center gap-1">
                <Play className="w-3 h-3" /> Ver Planilla
              </button>
            </div>
          </div>
        );
      default:
        return <div>Sub-módulo no encontrado.</div>;
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.push(`/admin/competencias/${compId}`)}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">
            {compName}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Gestión de la competencia • LFS v3.0</p>
        </div>
      </section>

      {/* Contenido Dinámico */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {renderContent()}
      </div>
    </div>
  );
}
