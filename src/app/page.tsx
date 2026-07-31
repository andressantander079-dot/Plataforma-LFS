import Link from "next/link";
import { 
  Trophy, 
  Users, 
  FileText, 
  Settings, 
  ShieldCheck, 
  Calendar, 
  TrendingUp, 
  MessageSquare 
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header Institucional LFS */}
      <header className="bg-lfs-navy text-white py-6 px-8 shadow-md border-b-4 border-lfs-orange">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-lfs-orange rounded-full flex items-center justify-center font-bold text-xl shadow-inner">
              LFS
            </div>
            <div>
              <h1 className="font-serif text-3xl font-black tracking-tight">
                Liga de Fútsal de Ushuaia
              </h1>
              <p className="text-xs text-slate-300 tracking-widest uppercase">
                Portal Oficial de Gestión Deportiva • v3.0
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-lfs-orange/20 text-lfs-orange border border-lfs-orange/30">
              Temporada Activa 2026
            </span>
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" title="Sistemas en línea" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 flex flex-col gap-8">
        
        {/* Banner de Bienvenida / Hero */}
        <section className="bg-gradient-to-br from-lfs-navy to-slate-900 text-white rounded-2xl p-8 md:p-10 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12">
            <Trophy className="w-96 h-96" />
          </div>
          <div className="max-w-2xl relative z-10">
            <h2 className="font-serif text-4xl font-bold mb-4 leading-tight">
              Bienvenido a la Plataforma LFS
            </h2>
            <p className="text-slate-300 text-base mb-6 leading-relaxed">
              El sistema integral para la administración de competencias, planteles, pases y planillas digitales de arbitraje del fútsal más austral del mundo.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/admin/dashboard"
                id="btn-access-admin"
                className="px-6 py-3 rounded-xl font-bold bg-lfs-orange hover:bg-lfs-orange/95 text-white transition shadow-lg shadow-lfs-orange/25"
              >
                Panel de Administración
              </Link>
              <Link
                href="/club/dashboard"
                id="btn-access-club"
                className="px-6 py-3 rounded-xl font-bold bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 transition"
              >
                Acceso para Clubes
              </Link>
            </div>
          </div>
        </section>

        {/* Mosaicos de los Tres Paneles Principales */}
        <section>
          <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase mb-4">
            Módulos y Roles de Usuario
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Tarjeta Admin */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
              <div>
                <div className="w-12 h-12 bg-lfs-navy/5 text-lfs-navy rounded-xl flex items-center justify-center mb-4">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-xl font-bold text-lfs-navy mb-2">Administración</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Gestión contable (Tesorería), auditoría de pases de jugadores, sanciones disciplinarias, configuración de competencias y designación arbitral.
                </p>
              </div>
              <Link 
                href="/admin/dashboard" 
                id="link-go-admin"
                className="inline-flex items-center text-sm font-bold text-lfs-navy hover:text-lfs-orange transition group"
              >
                Ingresar al panel administrativo 
                <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform ml-1">→</span>
              </Link>
            </div>

            {/* Tarjeta Clubes */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
              <div>
                <div className="w-12 h-12 bg-lfs-navy/5 text-lfs-navy rounded-xl flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-xl font-bold text-lfs-navy mb-2">Clubes Afiliados</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Administración de planteles, checklist de documentación obligatoria por jugador, carga masiva CSV y seguimiento financiero del club.
                </p>
              </div>
              <Link 
                href="/club/dashboard" 
                id="link-go-club"
                className="inline-flex items-center text-sm font-bold text-lfs-navy hover:text-lfs-orange transition group"
              >
                Ingresar al panel de club 
                <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform ml-1">→</span>
              </Link>
            </div>

            {/* Tarjeta Árbitros */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-300">
              <div>
                <div className="w-12 h-12 bg-lfs-navy/5 text-lfs-navy rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <h4 className="font-serif text-xl font-bold text-lfs-navy mb-2">Colegio Arbitral</h4>
                <p className="text-slate-500 text-sm leading-relaxed mb-4">
                  Planilla digital táctil de arbitraje con cancha gráfica. Registro de sustituciones, goles, tarjetas y firma digital en 8 pasos con hash de seguridad.
                </p>
              </div>
              <Link 
                href="/arbitro/dashboard" 
                id="link-go-arbitro"
                className="inline-flex items-center text-sm font-bold text-lfs-navy hover:text-lfs-orange transition group"
              >
                Ingresar al panel de árbitro 
                <span className="transform translate-x-0 group-hover:translate-x-1 transition-transform ml-1">→</span>
              </Link>
            </div>

          </div>
        </section>

        {/* Resumen de Datos Rápidos / Onboarding */}
        <section className="bg-slate-50 border border-slate-200/60 rounded-2xl p-6">
          <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase mb-4 text-center">
            Estado de los Servicios e Integración
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <span className="block text-2xl font-serif font-black text-lfs-navy">Supabase RLS</span>
              <span className="text-xs text-slate-500">Esquema y Políticas RLS</span>
            </div>
            <div>
              <span className="block text-2xl font-serif font-black text-lfs-navy">YIQ Contrast</span>
              <span className="text-xs text-slate-500">WCAG 2.1 AAA</span>
            </div>
            <div>
              <span className="block text-2xl font-serif font-black text-lfs-navy">IndexedDB</span>
              <span className="text-xs text-slate-500">Offline-First List</span>
            </div>
            <div>
              <span className="block text-2xl font-serif font-black text-lfs-navy">Vitest Setup</span>
              <span className="text-xs text-slate-500">Pruebas Unitarias</span>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-500 py-8 px-6 text-center text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p>© 2026 Liga de Fútsal de Ushuaia (LFS). Todos los derechos reservados.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition">Reglamentos</a>
            <a href="#" className="hover:text-white transition">Políticas de Privacidad</a>
            <a href="#" className="hover:text-white transition">Soporte Técnico</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
