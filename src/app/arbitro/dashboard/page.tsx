"use client";

import Link from "next/link";
import { 
  Calendar, Award, MessageSquare, User, BarChart3, Clock, Trophy, AlertTriangle 
} from "lucide-react";

export default function RefereeDashboard() {
  const nextDesignation = {
    match: "Camioneros vs HAF Ushuaia",
    date: "Hoy, 16:00",
    venue: "Gimnasio Cochocho Vargas",
    role: "Árbitro Principal",
  };

  const modules = [
    { name: "Mis Designaciones", href: "/arbitro/designaciones", icon: Calendar, desc: "Aceptar designaciones y ver historial", badge: "1 Hoy" },
    { name: "Carga de Planillas", href: "/arbitro/planillas", icon: Award, desc: "Cargar planillas táctiles y cierres QR", badge: "1 Pte" },
    { name: "Mensajería", href: "/arbitro/mensajeria", icon: MessageSquare, desc: "Mensajería con Colegio de Árbitros", badge: "Sin leer" },
    { name: "Mi Perfil y Firma", href: "/arbitro/perfil", icon: User, desc: "Firma digital y datos personales", badge: "Activo" },
    { name: "Mis Estadísticas", href: "/arbitro/estadisticas", icon: BarChart3, desc: "Calificaciones de mesa y partidos dirigidos", badge: "Puntaje 9.2" },
    { name: "Calendario LFS", href: "/arbitro/calendario", icon: Clock, desc: "Boletines de fechas y agenda mensual", badge: "Fecha 5" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <section className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#F97316]" />
            Panel de Árbitros LFS
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Control de arbitraje oficial de la Liga de Fútsal de Ushuaia.</p>
        </div>
      </section>

      {/* Alerta de Designación para Hoy */}
      <section className="bg-orange-50 border border-orange-250 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#F97316] flex-shrink-0 mt-0.5" />
          <div>
            <span className="text-[9px] font-black text-[#F97316] uppercase tracking-wider block">Designación Pendiente de Aceptación</span>
            <h3 className="font-bold text-[#1A2A44] text-sm mt-0.5">{nextDesignation.match}</h3>
            <p className="text-slate-500 text-xs mt-0.5">Rol: <strong>{nextDesignation.role}</strong> • Estadio: {nextDesignation.venue} • {nextDesignation.date} hs</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none px-4 py-2 bg-slate-250 hover:bg-slate-350 text-slate-700 rounded-xl font-bold text-xs transition">Rechazar</button>
          <button className="flex-1 md:flex-none px-4 py-2 bg-[#F97316] hover:bg-[#F97316]/95 text-white rounded-xl font-bold text-xs transition shadow-md shadow-[#F97316]/10">Aceptar Cargo</button>
        </div>
      </section>

      {/* Grid de Mosaicos (Tiles) */}
      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">Módulos de Árbitro</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="referee-modules-grid">
          {modules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              id={`tile-referee-${mod.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#F97316] hover:shadow-md transition duration-250 flex flex-col justify-between group h-36"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-[#1A2A44] group-hover:bg-[#F97316] group-hover:text-white transition">
                    <mod.icon className="w-4.5 h-4.5" />
                  </div>
                  {mod.badge && (
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-250">
                      {mod.badge}
                    </span>
                  )}
                </div>
                <h4 className="font-serif text-sm font-bold text-[#1A2A44] group-hover:text-[#F97316] transition leading-snug">
                  {mod.name}
                </h4>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold leading-relaxed mt-1">
                {mod.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
