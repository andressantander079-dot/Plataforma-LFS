"use client";

import { useState } from "react";
import Link from "next/link";
import { Trophy, Menu, X, Download, Calendar, BarChart3, ListOrdered, FileText } from "lucide-react";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Inicio", href: "/", icon: Trophy },
    { name: "Fixture", href: "/fixture", icon: Calendar },
    { name: "Posiciones", href: "/posiciones", icon: ListOrdered },
    { name: "Estadísticas", href: "/estadisticas", icon: BarChart3 },
    { name: "Descargas", href: "/descargas", icon: Download },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-55/30">
      {/* Barra de navegación superior accesible */}
      <nav className="bg-[#1A2A44] text-white sticky top-0 z-40 shadow-md border-b-2 border-[#F97316]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logotipo LFS */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-3 group" id="navbar-brand-logo">
                <div className="w-9 h-9 bg-[#F97316] rounded-full flex items-center justify-center font-black text-sm text-white group-hover:scale-105 transition-transform">
                  LFS
                </div>
                <div>
                  <span className="font-serif text-lg font-bold tracking-tight block">
                    Liga de Fútsal
                  </span>
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest block -mt-1">
                    Ushuaia
                  </span>
                </div>
              </Link>
            </div>

            {/* Menú Escritorio */}
            <div className="hidden md:flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  id={`nav-link-${item.name.toLowerCase()}`}
                  className="text-sm font-semibold text-slate-200 hover:text-[#F97316] flex items-center gap-1.5 transition-colors py-2 px-1"
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              ))}
            </div>

            {/* Botón Menú Móvil */}
            <div className="flex md:hidden">
              <button
                type="button"
                id="btn-mobile-menu"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none transition"
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? (
                  <X className="h-6 h-6" />
                ) : (
                  <Menu className="h-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Panel del Menú Móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#1A2A44] border-t border-slate-800" id="mobile-navigation-menu">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  id={`mobile-nav-link-${item.name.toLowerCase()}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-slate-200 hover:bg-[#F97316]/10 hover:text-[#F97316] block px-3 py-2.5 rounded-xl text-base font-semibold flex items-center gap-3 transition"
                >
                  <item.icon className="w-5 h-5 text-slate-400" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Contenido Dinámico de la Página */}
      <main className="flex-1 flex flex-col">
        {children}
      </main>

      {/* Footer Compartido de Rutas Públicas */}
      <footer className="bg-slate-900 text-slate-500 py-6 px-4 text-center text-xs border-t border-slate-800 mt-auto">
        <p>© 2026 Liga de Fútsal de Ushuaia (LFS). Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
