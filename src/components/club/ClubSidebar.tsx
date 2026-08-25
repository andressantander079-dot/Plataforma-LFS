"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  Wallet,
  ClipboardList,
  MessageSquare,
  BarChart3,
  Download,
  Settings,
  Menu,
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import { BadgeMensajeria } from "@/components/mensajeria/BadgeMensajeria";

interface ClubSidebarProps {
  clubName: string;
  clubStatus: "habilitado" | "en_revision" | "inhabilitado";
  userName: string;
  children: React.ReactNode;
}

const STATUS_UI = {
  habilitado: { label: "Habilitado", className: "bg-green-500/15 text-green-300", Icon: CheckCircle },
  en_revision: { label: "En revisión", className: "bg-orange-500/15 text-orange-300", Icon: AlertCircle },
  inhabilitado: { label: "Inhabilitado", className: "bg-red-500/15 text-red-300", Icon: XCircle },
} as const;

export function ClubSidebar({ clubName, clubStatus, userName, children }: ClubSidebarProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", href: "/club/dashboard", icon: LayoutDashboard },
    { name: "Plantel", href: "/club/planteles", icon: Users },
    { name: "Partidos y Torneos", href: "/club/partidos", icon: Trophy },
    { name: "Finanzas y Pagos", href: "/club/finanzas", icon: Wallet },
    { name: "Trámites y Pases", href: "/club/tramites", icon: ClipboardList },
    { name: "Mensajería LFS", href: "/club/mensajeria", icon: MessageSquare },
    { name: "Estadísticas", href: "/club/estadisticas", icon: BarChart3 },
    { name: "Descargas", href: "/club/descargas", icon: Download },
    { name: "Configuración", href: "/club/configuracion", icon: Settings },
  ];

  const status = STATUS_UI[clubStatus] ?? STATUS_UI.inhabilitado;
  const statusIconColor = clubStatus === "habilitado" ? "text-green-500" : clubStatus === "en_revision" ? "text-orange-500" : "text-red-500";

  const iniciales = clubName
    .split(" ")
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans">
      {/* Botón flotante para móviles (oculto en impresión) */}
      <button
        id="btn-club-sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#1A2A44] text-white rounded-xl shadow-lg border border-white/10 print:hidden"
        aria-label="Alternar menú"
      >
        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Barra lateral (oculta en impresión) */}
      <aside
        id="club-sidebar"
        className={`w-64 bg-[#1A2A44] text-white flex flex-col justify-between p-4 z-40 transition-all duration-300 fixed md:sticky top-0 h-screen shrink-0 print:hidden ${
          isSidebarOpen ? "left-0" : "-left-64 md:left-0"
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Encabezado del Club */}
          <div className="flex items-center gap-3 border-b border-slate-750 pb-4">
            <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0">
              {iniciales}
            </div>
            <div className="min-w-0">
              <span className="font-serif text-sm font-black block truncate text-slate-100">
                {clubName}
              </span>
              <span className="text-[9px] text-slate-400 uppercase tracking-wider block">
                Portal del Club
              </span>
            </div>
          </div>

          {/* Estado de Habilitación */}
          <div className={`px-3 py-2 rounded-xl flex items-center justify-between gap-2 border border-slate-700/50 ${status.className}`}>
            <span className="text-[10px] font-bold tracking-wide uppercase">Estado LFS:</span>
            <span className="text-[10px] font-black flex items-center gap-1">
              <status.Icon className="w-3.5 h-3.5" />
              {status.label}
            </span>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex flex-col gap-1 overflow-y-auto max-h-[55vh] pr-1">
            {menuItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  id={`club-menu-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    active
                      ? "bg-[#F97316] text-white shadow-md shadow-[#F97316]/10"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-white" : "text-slate-400"}`} />
                  <span className="flex-1 truncate">{item.name}</span>
                  {item.href === "/club/mensajeria" && <BadgeMensajeria />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Pie de la Barra Lateral */}
        <div className="border-t border-slate-750 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-750 flex items-center justify-center font-bold text-xs text-[#F97316] shrink-0 border border-slate-700">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-slate-200">{userName}</p>
              <span className="text-[9px] text-[#F97316] font-bold uppercase tracking-wider block">
                Delegado
              </span>
            </div>
          </div>
          <BotonCerrarSesion />
        </div>
      </aside>

      {/* Área del Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Cabecera Móvil - Oculto en escritorio y en impresión */}
        <header className="md:hidden bg-[#1A2A44] text-white py-4 px-6 flex items-center justify-between border-b border-slate-800 shrink-0 print:hidden">
          <div className="flex items-center gap-2 pl-8">
            <div className="w-6 h-6 bg-[#F97316] rounded-full flex items-center justify-center font-bold text-xs text-white">
              {iniciales}
            </div>
            <span className="font-serif text-xs font-black truncate max-w-[150px]">{clubName}</span>
          </div>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${status.className}`}>
            <status.Icon className="w-2.5 h-2.5" />
            {status.label}
          </span>
        </header>

        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
