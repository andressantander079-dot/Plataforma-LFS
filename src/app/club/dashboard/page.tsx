"use client";

import Link from "next/link";
import { 
  Users, MessageSquare, ClipboardList, Wallet, Calendar, 
  BarChart3, Settings, Download, Trophy, Bell, ArrowRight 
} from "lucide-react";

export default function ClubDashboard() {
  const nextMatch = {
    opponent: "HAF Ushuaia",
    date: "Sábado 1 de Agosto - 16:00",
    venue: "Gimnasio Cochocho Vargas",
    category: "Primera División",
  };

  const modules = [
    { name: "Gestión de Planteles", href: "/club/planteles", icon: Users, desc: "Inscripción de jugadores y carga masiva", badge: "18 Habilitados" },
    { name: "Mensajería Directa", href: "/club/mensajeria", icon: MessageSquare, desc: "Mensajes y tickets con Administración", badge: "Sin leer" },
    { name: "Trámites y Pases", href: "/club/tramites", icon: ClipboardList, desc: "Iniciar pases y ver auditoría de 7 pasos", badge: "2 Pendientes" },
    { name: "Estado Financiero", href: "/club/finanzas", icon: Wallet, desc: "Ver deudas, saldos y subir comprobantes", badge: "Al día" },
    { name: "Partidos del Club", href: "/club/partidos", icon: Calendar, desc: "Próximos encuentros y planillas oficiales", badge: "Fecha 5" },
    { name: "Estadísticas Club", href: "/club/estadisticas", icon: BarChart3, desc: "Rendimiento y goleadores de tus categorías", badge: "Top 3" },
    { name: "Configuración Perfil", href: "/club/configuracion", icon: Settings, desc: "Contactos de autoridades y notificaciones", badge: "Ajustes" },
    { name: "Centro de Descargas", href: "/club/descargas", icon: Download, desc: "Descarga de planillas de partido y boletines", badge: "v2026" },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <section className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center font-bold text-white shadow-md">
            CC
          </div>
          <div>
            <h2 className="font-serif text-2xl font-black text-[#1A2A44]">
              Club Camioneros Ushuaia
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Portal oficial de gestión interna para delegados de clubes.</p>
          </div>
        </div>
        <button className="relative p-2 text-slate-400 hover:text-[#1A2A44] transition" title="Notificaciones">
          <Bell className="w-6 h-6" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </section>

      {/* Widget Próximo Partido */}
      <section className="bg-gradient-to-br from-[#1A2A44] to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-6 translate-y-6">
          <Trophy className="w-48 h-48" />
        </div>
        <div className="max-w-md relative z-10 flex flex-col gap-3">
          <span className="text-[9px] bg-[#F97316] font-black uppercase px-2 py-0.5 rounded text-white w-fit">
            Próximo Encuentro
          </span>
          <h3 className="font-serif text-xl font-bold">Camioneros vs {nextMatch.opponent}</h3>
          <div className="text-xs text-slate-350 flex flex-col gap-1 mt-1 font-medium">
            <p>Categoría: {nextMatch.category}</p>
            <p>Fecha: {nextMatch.date} hs</p>
            <p>Estadio: {nextMatch.venue}</p>
          </div>
        </div>
      </section>

      {/* Grid de Mosaicos */}
      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">Módulos del Club</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="club-modules-grid">
          {modules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              id={`tile-club-${mod.name.toLowerCase().replace(/\s+/g, "-")}`}
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
