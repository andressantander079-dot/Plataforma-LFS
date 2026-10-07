"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Trophy,
  Users,
  ClipboardList,
  Wallet,
  MoreHorizontal,
  X,
  Calendar,
  Award,
  MessageSquare,
  Scale,
  User,
  type LucideIcon,
} from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import { obtenerBadgesNav } from "@/lib/actions/navigation.actions";

/**
 * BARRA DE NAVEGACIÓN INFERIOR (solo móvil, md+ se oculta)
 * Patrón de app nativa iOS/Android: 5 ítems fijos + burbujas rojas con
 * la cantidad de pendientes (se actualizan en tiempo real).
 * El ítem "Más" abre una hoja inferior con el resto de las secciones.
 */

export type RolNav = "admin" | "club" | "arbitro";

interface ItemNav {
  href: string;
  label: string;
  icono: LucideIcon;
}

const ITEMS: Record<RolNav, { fijos: ItemNav[]; mas: ItemNav[] }> = {
  admin: {
    fijos: [
      { href: "/admin/dashboard", label: "Inicio", icono: Home },
      { href: "/admin/competencias", label: "Partidos", icono: Trophy },
      { href: "/admin/tramites", label: "Trámites", icono: ClipboardList },
      { href: "/admin/tesoreria", label: "Tesorería", icono: Wallet },
    ],
    mas: [
      { href: "/admin/equipos", label: "Equipos (Clubes)", icono: Users },
      { href: "/admin/colegiodearbitros", label: "Colegio de Árbitros", icono: Award },
      { href: "/admin/tribunal/sanciones", label: "Tribunal", icono: Scale },
      { href: "/admin/mensajeria", label: "Mensajería", icono: MessageSquare },
      { href: "/admin/configuracion", label: "Configuración", icono: User },
    ],
  },
  club: {
    fijos: [
      { href: "/club/dashboard", label: "Inicio", icono: Home },
      { href: "/club/partidos", label: "Partidos", icono: Trophy },
      { href: "/club/planteles", label: "Plantel", icono: Users },
      { href: "/club/tramites", label: "Trámites", icono: ClipboardList },
    ],
    mas: [
      { href: "/club/finanzas", label: "Finanzas y Pagos", icono: Wallet },
      { href: "/club/tribunal", label: "Tribunal", icono: Scale },
      { href: "/club/mensajeria", label: "Mensajería LFS", icono: MessageSquare },
      { href: "/club/estadisticas", label: "Estadísticas", icono: Award },
      { href: "/club/configuracion", label: "Configuración", icono: User },
    ],
  },
  arbitro: {
    fijos: [
      { href: "/arbitro/dashboard", label: "Inicio", icono: Home },
      { href: "/arbitro/designaciones", label: "Fechas", icono: Calendar },
      { href: "/arbitro/planillas", label: "Planillas", icono: Award },
      { href: "/arbitro/mensajeria", label: "Mensajes", icono: MessageSquare },
    ],
    mas: [
      { href: "/arbitro/perfil", label: "Mi Perfil", icono: User },
      { href: "/arbitro/estadisticas", label: "Mis Estadísticas", icono: Award },
      { href: "/arbitro/calendario", label: "Calendario", icono: Calendar },
    ],
  },
};

// Tablas cuyos cambios pueden alterar las burbujas de cada rol
const TABLAS_REALTIME: Record<RolNav, string[]> = {
  admin: ["transfers", "treasury_payments", "matches"],
  club: ["transfers", "matches", "match_sheets"],
  arbitro: ["matches", "match_sheets"],
};

export function BottomNav({ rol }: { rol: RolNav }) {
  const pathname = usePathname();
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [masAbierto, setMasAbierto] = useState(false);

  const { fijos, mas } = ITEMS[rol];

  const refrescarBadges = useCallback(async () => {
    try {
      const res = await obtenerBadgesNav();
      if (res && typeof res === "object") {
        setBadges(res);
      }
    } catch {
      // Ignorar fallos de red o sesión de forma silenciosa
    }
  }, []);

  useEffect(() => {
    refrescarBadges();

    const supabase = createLfsClient();
    let canal = supabase.channel(`bottom-nav-${rol}`);
    for (const tabla of TABLAS_REALTIME[rol]) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        refrescarBadges
      );
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [rol, refrescarBadges]);

  // Cerrar la hoja "Más" al navegar
  useEffect(() => {
    setMasAbierto(false);
  }, [pathname]);

  const esActivo = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const badgeDe = (href: string) => badges[href] ?? 0;

  const algunaMasActiva = mas.some((i) => esActivo(i.href));

  return (
    <>
      {/* Hoja inferior "Más" */}
      {masAbierto && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setMasAbierto(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-5 pb-8 flex flex-col gap-1 animate-[slideUp_0.2s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Todas las secciones
              </span>
              <button
                onClick={() => setMasAbierto(false)}
                className="p-1.5 rounded-full bg-slate-100 text-slate-500"
                aria-label="Cerrar menú"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {mas.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
                  esActivo(item.href)
                    ? "bg-[#F97316]/10 text-[#F97316]"
                    : "text-[#1A2A44] hover:bg-slate-50"
                }`}
              >
                <item.icono className="w-4 h-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Barra inferior fija */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Navegación principal"
      >
        <div className="grid grid-cols-5">
          {fijos.map((item) => {
            const activo = esActivo(item.href);
            const cantidad = badgeDe(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]"
              >
                <span className="relative">
                  <item.icono
                    className={`w-5 h-5 transition ${activo ? "text-[#F97316]" : "text-slate-400"}`}
                  />
                  {cantidad > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center shadow">
                      {cantidad > 99 ? "99+" : cantidad}
                    </span>
                  )}
                </span>
                <span
                  className={`text-[9px] font-bold leading-none ${
                    activo ? "text-[#F97316]" : "text-slate-400"
                  }`}
                >
                  {item.label}
                </span>
                {activo && (
                  <span className="absolute top-0 w-8 h-0.5 rounded-full bg-[#F97316]" />
                )}
              </Link>
            );
          })}

          {/* Botón Más */}
          <button
            onClick={() => setMasAbierto(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]"
          >
            <MoreHorizontal
              className={`w-5 h-5 transition ${algunaMasActiva ? "text-[#F97316]" : "text-slate-400"}`}
            />
            <span
              className={`text-[9px] font-bold leading-none ${
                algunaMasActiva ? "text-[#F97316]" : "text-slate-400"
              }`}
            >
              Más
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
