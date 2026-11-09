"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  CalendarDays,
  ClipboardList,
  Compass,
  Download,
  Home,
  LayoutDashboard,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";

export type RolPagina = "admin" | "club" | "arbitro";

interface Acceso {
  href: string;
  nombre: string;
  descripcion: string;
  Icono: typeof Home;
}

const ACCESOS: Record<RolPagina, Acceso[]> = {
  admin: [
    {
      href: "/admin/dashboard",
      nombre: "Dashboard",
      descripcion: "El pulso de la liga en tiempo real",
      Icono: LayoutDashboard,
    },
    {
      href: "/admin/agenda",
      nombre: "Agenda",
      descripcion: "Eventos y fechas clave del torneo",
      Icono: CalendarDays,
    },
    {
      href: "/admin/competencias",
      nombre: "Torneos y fixture",
      descripcion: "Fechas, fixture y posiciones",
      Icono: Trophy,
    },
    {
      href: "/admin/estadisticas",
      nombre: "Estadísticas",
      descripcion: "Números globales de la liga",
      Icono: BarChart3,
    },
  ],
  club: [
    {
      href: "/club/dashboard",
      nombre: "Dashboard",
      descripcion: "El resumen de tu club",
      Icono: LayoutDashboard,
    },
    {
      href: "/club/planteles",
      nombre: "Planteles",
      descripcion: "Tus jugadores y equipos",
      Icono: Users,
    },
    {
      href: "/club/partidos",
      nombre: "Partidos",
      descripcion: "Fixture y resultados",
      Icono: Trophy,
    },
    {
      href: "/club/agenda",
      nombre: "Agenda",
      descripcion: "Eventos de la liga y tus partidos",
      Icono: CalendarDays,
    },
    {
      href: "/club/finanzas",
      nombre: "Finanzas",
      descripcion: "Cargos y pagos",
      Icono: Wallet,
    },
    {
      href: "/club/descargas",
      nombre: "Descargas",
      descripcion: "Documentos para tu club",
      Icono: Download,
    },
  ],
  arbitro: [
    {
      href: "/arbitro/calendario",
      nombre: "Mi calendario",
      descripcion: "Tus designaciones y eventos",
      Icono: Calendar,
    },
    {
      href: "/arbitro/planillas",
      nombre: "Planillas",
      descripcion: "Cargá resultados y eventos",
      Icono: ClipboardList,
    },
    {
      href: "/arbitro/designaciones",
      nombre: "Designaciones",
      descripcion: "Tus partidos asignados",
      Icono: Trophy,
    },
    {
      href: "/arbitro/dashboard",
      nombre: "Inicio",
      descripcion: "Tu panel principal",
      Icono: LayoutDashboard,
    },
  ],
};

const INICIO: Record<RolPagina, string> = {
  admin: "/admin/dashboard",
  club: "/club/dashboard",
  arbitro: "/arbitro/dashboard",
};

/**
 * PÁGINA 404 PREMIUM (Paso 17B): reemplaza los catch-all con contenido de
 * mentira. Mensaje institucional + accesos directos SEGÚN EL ROL para que
 * nadie se quede "perdido" en una ruta que no existe.
 */
export function PaginaNoDisponible({ rol }: { rol: RolPagina }) {
  const router = useRouter();
  const accesos = ACCESOS[rol];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-8 py-10 px-4">
      {/* Marca 404 */}
      <div className="text-center flex flex-col items-center gap-3">
        <div className="w-16 h-16 bg-[#1A2A44] rounded-2xl flex items-center justify-center shadow-lg">
          <Compass className="w-8 h-8 text-[#F97316]" />
        </div>
        <span className="font-serif text-7xl sm:text-8xl font-black text-[#1A2A44] leading-none tracking-tight">
          4<span className="text-[#F97316]">0</span>4
        </span>
        <h1 className="font-serif text-xl sm:text-2xl font-black text-[#1A2A44]">
          Esta página no existe (o se movió)
        </h1>
        <p className="text-sm text-slate-500 max-w-md">
          No pasa nada: estas cosas también le pasan a los mejores equipos. Elegí a dónde ir y
          seguimos jugando.
        </p>
      </div>

      {/* Accesos según rol */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-3xl">
        {accesos.map(({ href, nombre, descripcion, Icono }) => (
          <Link
            key={href}
            href={href}
            className="group bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:border-[#F97316]/50 hover:shadow-md transition flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 group-hover:bg-orange-50 flex items-center justify-center shrink-0 transition">
              <Icono className="w-5 h-5 text-slate-400 group-hover:text-[#F97316] transition" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-[#1A2A44] text-sm block">{nombre}</span>
              <span className="text-[11px] text-slate-400 font-semibold">{descripcion}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" /> Volver atrás
        </button>
        <Link
          href={INICIO[rol]}
          className="px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-black uppercase tracking-widest transition flex items-center gap-1.5 shadow-md"
        >
          <Home className="w-4 h-4" /> Ir al inicio
        </Link>
      </div>
    </div>
  );
}
