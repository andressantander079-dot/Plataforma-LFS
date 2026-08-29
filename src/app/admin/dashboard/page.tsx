"use client";

import Link from "next/link";
import { 
  Trophy, Users, Wallet, ClipboardList, MessageSquare, 
  ShieldCheck, Scale, FileText, Calendar, Settings, BarChart3, Activity 
} from "lucide-react";

export default function AdminDashboard() {
  const stats = [
    { name: "Partidos de Hoy", value: "3", desc: "1 en curso, 2 programados" },
    { name: "Mensajes Nuevos", value: "14", desc: "8 de clubes, 6 de árbitros" },
    { name: "Trámites de Pase", value: "6", desc: "4 esperando revisión FVF" },
    { name: "Saldo Tesorería", value: "$420.500", desc: "Pesos Argentinos (ARS)" },
  ];

  const modules = [
    { name: "Competencias", href: "/admin/competencias", icon: Trophy, desc: "Crear torneos, fixtures y llaves", badge: "2 Activos" },
    { name: "Equipos (Clubes)", href: "/admin/equipos", icon: Users, desc: "Habilitación de clubes y planteles", badge: "3 Clubes" },
    { name: "Tesorería", href: "/admin/tesoreria", icon: Wallet, desc: "Ingresos, egresos y PIN 00T00", badge: "Seguro" },
    { name: "Trámites", href: "/admin/tramites", icon: ClipboardList, desc: "Bajas, altas y auditoría de pases", badge: "6 Ptes" },
    { name: "Colegio de Árbitros", href: "/admin/colegiodearbitros", icon: ShieldCheck, desc: "Fichaje y evaluaciones de árbitros", badge: "8 Árb." },
    { name: "Designaciones", href: "/admin/designaciones", icon: Calendar, desc: "Asignar ternas a los partidos", badge: "Fecha 5" },
    { name: "Tribunal Disciplinario", href: "/admin/tribunal", icon: Scale, desc: "Sanciones, multas y apelaciones", badge: "2 Activas" },
    { name: "Mensajería", href: "/admin/mensajeria/bandeja", icon: MessageSquare, desc: "Bandeja y archivado PIN 9090", badge: "14 Ptes" },
    { name: "Reglamento Oficial", href: "/admin/reglamento", icon: FileText, desc: "Subida de PDF e historial de versiones", badge: "v2026" },
    { name: "Agenda", href: "/admin/agenda", icon: Calendar, desc: "Calendario institucional y recordatorios", badge: "3 Ev." },
    { name: "Configuración General", href: "/admin/configuracion", icon: Settings, desc: "Identidad, categorías, sponsors, sedes y reglas", badge: "Oficial" },
    { name: "Estadísticas Globales", href: "/admin/estadisticas", icon: BarChart3, desc: "Rendimiento global de la liga", badge: "Top 8" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Encabezado */}
      <section className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44]">
            Panel de Administración
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestión integral de la Liga de Fútsal de Ushuaia v3.0.
          </p>
        </div>
      </section>

      {/* Grid de Resumen Rápido */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.name} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{stat.name}</span>
            <span className="text-2xl font-serif font-black text-[#1A2A44] my-1">{stat.value}</span>
            <span className="text-slate-400 text-[9px] font-medium">{stat.desc}</span>
          </div>
        ))}
      </section>

      {/* Mosaicos de Módulos Operativos (Tiles) */}
      <section className="flex flex-col gap-4">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">Módulos Administrativos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" id="admin-modules-grid">
          {modules.map((mod) => (
            <Link
              key={mod.name}
              href={mod.href}
              id={`tile-admin-${mod.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-[#F97316] hover:shadow-md transition duration-250 flex flex-col justify-between group h-40"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-[#1A2A44] group-hover:bg-[#F97316] group-hover:text-white transition shadow-inner">
                    <mod.icon className="w-5 h-5" />
                  </div>
                  {mod.badge && (
                    <span className="text-[8px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                      {mod.badge}
                    </span>
                  )}
                </div>
                <h4 className="font-serif text-sm font-bold text-[#1A2A44] leading-snug group-hover:text-[#F97316] transition">
                  {mod.name}
                </h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-2">
                {mod.desc}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
