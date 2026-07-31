"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Trophy, ArrowLeft, Calendar, BarChart3, Users, Clock } from "lucide-react";

export default function CompetenciaDetailAdmin() {
  const params = useParams();
  const router = useRouter();
  const compId = params.id as string;

  const comp = {
    id: compId,
    name: "Torneo Apertura LFS 2026",
    year: 2026,
    category: "Primera División",
    gender: "Masculino",
    teamsCount: 8,
    status: "Activo"
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.push("/admin/competencias")}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#F97316]" />
            {comp.name}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Ficha de torneo y accesos de administración del fixture.</p>
        </div>
      </section>

      {/* Grid de Accesos de Torneo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href={`/admin/competencias/${compId}/fixture`} className="bg-white border p-5 rounded-2xl flex flex-col justify-between hover:border-[#F97316] transition shadow-sm h-32">
          <Calendar className="w-6 h-6 text-[#1A2A44]" />
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1A2A44]">Gestionar Fixture</h4>
            <p className="text-[10px] text-slate-450 mt-0.5">Fechas y horarios de juego</p>
          </div>
        </Link>

        <Link href={`/admin/competencias/${compId}/playoffs`} className="bg-white border p-5 rounded-2xl flex flex-col justify-between hover:border-[#F97316] transition shadow-sm h-32">
          <Trophy className="w-6 h-6 text-[#1A2A44]" />
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1A2A44]">Playoffs / Brackets</h4>
            <p className="text-[10px] text-slate-450 mt-0.5">Eliminación directa brackets</p>
          </div>
        </Link>

        <Link href={`/admin/competencias/${compId}/posiciones`} className="bg-white border p-5 rounded-2xl flex flex-col justify-between hover:border-[#F97316] transition shadow-sm h-32">
          <BarChart3 className="w-6 h-6 text-[#1A2A44]" />
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1A2A44]">Posiciones</h4>
            <p className="text-[10px] text-slate-450 mt-0.5">Cálculo en vivo de la tabla</p>
          </div>
        </Link>

        <Link href={`/admin/competencias/${compId}/planillas`} className="bg-white border p-5 rounded-2xl flex flex-col justify-between hover:border-[#F97316] transition shadow-sm h-32">
          <Users className="w-6 h-6 text-[#1A2A44]" />
          <div>
            <h4 className="font-serif font-bold text-sm text-[#1A2A44]">Planillas de Partido</h4>
            <p className="text-[10px] text-slate-450 mt-0.5">Carga y firmas de mesa</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
