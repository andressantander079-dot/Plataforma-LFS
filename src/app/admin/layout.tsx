"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Users, 
  FileText, 
  ShieldCheck, 
  Wallet, 
  MessageSquare, 
  ClipboardList, 
  Scale, 
  Settings, 
  Menu, 
  X, 
  LogOut 
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const menuItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: Trophy },
    { name: "Competencias", href: "/admin/competencias", icon: Trophy },
    { name: "Equipos (Clubes)", href: "/admin/equipos", icon: Users },
    { name: "Tesorería", href: "/admin/tesoreria/movimientos", icon: Wallet },
    { name: "Trámites", href: "/admin/tramites/pendientes", icon: ClipboardList },
    { name: "Colegio de Árbitros", href: "/admin/colegiodearbitros", icon: ShieldCheck },
    { name: "Tribunal de Disciplina", href: "/admin/tribunal/sanciones", icon: Scale },
    { name: "Mensajería", href: "/admin/mensajeria/bandeja", icon: MessageSquare },
    { name: "Configuración", href: "/admin/configuracion/general", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-slate-100 font-sans">
      {/* Botón de Menú para Móviles */}
      <button
        id="btn-admin-sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-[#1A2A44] text-white rounded-xl shadow-md"
      >
        {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar Fijo en Escritorio y Desplizable en Móvil */}
      <aside
        id="admin-sidebar"
        className={`w-64 bg-[#1A2A44] text-white flex flex-col justify-between p-4 z-40 transition-all duration-300 fixed md:sticky top-0 h-screen ${
          isSidebarOpen ? "left-0" : "-left-64 md:left-0"
        }`}
      >
        <div className="flex flex-col gap-6">
          {/* Logo / Header */}
          <div className="flex items-center gap-3 border-b border-slate-750 pb-4">
            <div className="w-9 h-9 bg-[#F97316] rounded-full flex items-center justify-center font-black text-sm text-white">
              LFS
            </div>
            <div>
              <span className="font-serif text-base font-bold block">Panel Admin</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest block -mt-1">Liga Fútsal Ushuaia</span>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex flex-col gap-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                id={`admin-menu-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setIsSidebarOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-800 hover:text-[#F97316] transition-colors"
              >
                <item.icon className="w-4 h-4 text-slate-450" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Footer del Sidebar */}
        <div className="border-t border-slate-750 pt-4 flex flex-col gap-2">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">
              AD
            </div>
            <div>
              <p className="text-xs font-bold truncate">Administrador LFS</p>
              <span className="text-[9px] text-[#F97316] font-bold">Acceso Total</span>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Link>
        </div>
      </aside>

      {/* Área del Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
