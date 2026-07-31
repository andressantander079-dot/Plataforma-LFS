"use client";

import Link from "next/link";
import { 
  Trophy, 
  Users, 
  Wallet, 
  ClipboardList, 
  MessageSquare, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  Activity 
} from "lucide-react";

export default function AdminDashboard() {
  const stats = [
    { name: "Partidos de Hoy", value: "3", desc: "1 en curso, 2 programados", icon: Trophy, color: "text-[#F97316]" },
    { name: "Mensajes Pendientes", value: "14", desc: "8 de clubes, 6 de árbitros", icon: MessageSquare, color: "text-blue-500" },
    { name: "Trámites de Pase", value: "6", desc: "4 esperando revisión FVF", icon: ClipboardList, color: "text-purple-500" },
    { name: "Saldo Tesorería", value: "$420.500", desc: "Pesos Argentinos (ARS)", icon: Wallet, color: "text-green-500" },
  ];

  const recentLogs = [
    { id: 1, user: "Admin", action: "Habilitación de Club", target: "HAF Ushuaia", time: "10 min atrás" },
    { id: 2, user: "Planillero", action: "Firma Planilla Digital", target: "Camioneros vs Mercantil", time: "35 min atrás" },
    { id: 3, user: "Club Galicia", action: "Carga de Jugador", target: "Tomás Rivas (DNI 44.xxx)", time: "1 hora atrás" },
    { id: 4, user: "Tesorería", action: "Registro de Egreso", target: "Pago Arbitraje Fecha 4", time: "3 horas atrás" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Bienvenida y Saludo */}
      <section className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44]">
            Panel de Administración
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Resumen operativo y control de actividades de la Liga de Fútsal de Ushuaia.
          </p>
        </div>
      </section>

      {/* Grid de Resumen Rápido (Cards) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between hover:shadow transition duration-250"
          >
            <div className="flex flex-col gap-1">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">{stat.name}</span>
              <span className="text-3xl font-serif font-black text-[#1A2A44]">{stat.value}</span>
              <span className="text-slate-400 text-[10px] font-medium">{stat.desc}</span>
            </div>
            <div className={`w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center ${stat.color} shadow-inner`}>
              <stat.icon className="w-6 h-6" />
            </div>
          </div>
        ))}
      </section>

      {/* Grid Secundario: Módulos Operativos y Log Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Actividad Reciente */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-[#1A2A44]">
              <Activity className="w-5.5 h-5.5" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Historial de Auditoría</h3>
              <p className="text-xs text-slate-400">Últimas acciones registradas en el sistema</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-150 text-sm hover:bg-slate-100/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shadow-sm">
                    {log.user.substring(0, 2)}
                  </div>
                  <div>
                    <span className="font-bold text-[#1A2A44]">{log.action}:</span>{" "}
                    <span className="text-slate-500 font-medium">{log.target}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {log.time}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Mosaicos de Accesos Directos Administrativos */}
        <section className="bg-gradient-to-br from-[#1A2A44] to-slate-900 text-white rounded-2xl p-6 shadow-xl flex flex-col justify-between border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-6 translate-y-6">
            <Trophy className="w-64 h-64" />
          </div>
          <div className="relative z-10 flex flex-col gap-4">
            <h3 className="font-serif text-xl font-bold text-white mb-1">Accesos Rápidos</h3>
            <p className="text-slate-350 text-xs leading-relaxed mb-3">
              Administra competencias en curso, valida documentación de planteles o administra el tribunal de disciplina.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/admin/competencias/crear"
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-[#F97316] text-white hover:text-white transition font-bold text-xs group"
              >
                Crear Competencia
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/admin/equipos/crear"
                className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-850 hover:bg-[#F97316] text-white hover:text-white transition font-bold text-xs group"
              >
                Registrar Nuevo Club
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
