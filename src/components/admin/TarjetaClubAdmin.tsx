"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Phone,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  UserRound,
  Loader2,
  Wallet,
  ChevronDown,
  Check,
} from "lucide-react";
import { cambiarEstadoClub } from "@/lib/actions/equipos.actions";

export interface ClubItem {
  id: string;
  name: string;
  president_name: string | null;
  president_dni: string;
  president_phone: string;
  treasurer_name: string | null;
  treasurer_dni: string;
  treasurer_phone: string;
  status: "inhabilitado" | "en_revision" | "habilitado";
}

const ESTADOS_INFO = {
  inhabilitado: {
    label: "Inhabilitado",
    Icon: XCircle,
    border: "border-red-500",
    badgeClase: "bg-red-50 text-red-700 border-red-200 hover:bg-red-100/80",
    iconColor: "text-red-600",
    chevronColor: "text-red-400",
    desc: "Inhabilitado para competir y hacer trámites",
  },
  habilitado: {
    label: "Habilitado",
    Icon: CheckCircle,
    border: "border-emerald-500",
    badgeClase: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/80",
    iconColor: "text-emerald-600",
    chevronColor: "text-emerald-400",
    desc: "Club activo con acceso total a trámites",
  },
  en_revision: {
    label: "En revisión",
    Icon: AlertCircle,
    border: "border-amber-500",
    badgeClase: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/80",
    iconColor: "text-amber-600",
    chevronColor: "text-amber-400",
    desc: "Documentación o pagos en revisión",
  },
} as const;

type EstadoClub = keyof typeof ESTADOS_INFO;

export function TarjetaClubAdmin({ club }: { club: ClubItem }) {
  const router = useRouter();
  const [status, setStatus] = useState<EstadoClub>(club.status);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar lista desplegable al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAbierto(false);
      }
    }
    if (menuAbierto) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuAbierto]);

  const handleSeleccionarEstado = (nuevoEstado: EstadoClub) => {
    setMenuAbierto(false);
    if (nuevoEstado === status || isPending) return;

    setErrorMsg(null);
    const estadoPrevio = status;

    // Actualización optimista inmediata
    setStatus(nuevoEstado);

    startTransition(async () => {
      const res = await cambiarEstadoClub(club.id, nuevoEstado);
      if (!res.ok) {
        setStatus(estadoPrevio);
        setErrorMsg(res.error ?? "No se pudo actualizar el estado.");
      } else {
        router.refresh();
      }
    });
  };

  const actualInfo = ESTADOS_INFO[status] ?? ESTADOS_INFO.inhabilitado;
  const ActualIcon = actualInfo.Icon;

  return (
    <div
      className={`bg-white rounded-2xl border-l-4 ${actualInfo.border} border-y border-r border-slate-200/80 p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all duration-200`}
    >
      <div>
        {/* Encabezado con lista desplegable compacta para que nunca se desborde en móviles */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Contenedor relativo de la lista desplegable */}
          <div className="relative inline-block text-left" ref={menuRef}>
            <button
              type="button"
              id={`dropdown-btn-${club.id}`}
              onClick={() => setMenuAbierto((prev) => !prev)}
              disabled={isPending}
              aria-expanded={menuAbierto}
              aria-haspopup="true"
              title="Cambiar estado del club"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${actualInfo.badgeClase}`}
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
              ) : (
                <ActualIcon className={`w-3.5 h-3.5 ${actualInfo.iconColor}`} />
              )}
              <span>{actualInfo.label}</span>
              <ChevronDown
                className={`w-3 h-3 ${actualInfo.chevronColor} transition-transform duration-200 ${
                  menuAbierto ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Menú flotante desplegable */}
            {menuAbierto && (
              <div
                className="absolute left-0 top-full mt-1.5 w-56 rounded-xl bg-white border border-slate-200 shadow-xl z-30 py-1.5 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                aria-orientation="vertical"
              >
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                  Cambiar estado
                </div>

                {(Object.keys(ESTADOS_INFO) as EstadoClub[]).map((key) => {
                  const item = ESTADOS_INFO[key];
                  const ItemIcon = item.Icon;
                  const seleccionado = status === key;

                  return (
                    <button
                      key={key}
                      type="button"
                      role="menuitem"
                      id={`option-${key}-${club.id}`}
                      onClick={() => handleSeleccionarEstado(key)}
                      className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors cursor-pointer ${
                        seleccionado
                          ? "bg-slate-50 font-bold text-[#1A2A44]"
                          : "hover:bg-slate-50 text-slate-600"
                      }`}
                    >
                      <ItemIcon className={`w-4 h-4 mt-0.5 shrink-0 ${item.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1A2A44]">
                            {item.label}
                          </span>
                          {seleccionado && (
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 line-clamp-1">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-bold tracking-tight shrink-0">
            LFS v3.0
          </span>
        </div>

        {/* Mensaje de error si falla la actualización */}
        {errorMsg && (
          <div className="mb-3 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Nombre del Club */}
        <h4 className="font-serif text-lg font-bold text-[#1A2A44] mb-3">
          {club.name}
        </h4>

        {/* Contactos */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mb-6">
          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Presidente
            </span>
            <p className="text-slate-700 text-xs font-bold flex items-center gap-1">
              <UserRound className="w-3 h-3 text-slate-400" />
              {club.president_name ?? `DNI ${club.president_dni}`}
            </p>
            <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-[#F97316]" /> {club.president_phone}
            </p>
          </div>

          <div>
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Tesorero
            </span>
            <p className="text-slate-700 text-xs font-bold">
              {club.treasurer_name ?? `DNI ${club.treasurer_dni}`}
            </p>
            <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-[#F97316]" /> {club.treasurer_phone}
            </p>
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="flex gap-2">
        <Link
          href={`/admin/equipos/${club.id}/plantel`}
          id={`btn-plantel-${club.id}`}
          className="flex-1 px-3 py-2 bg-[#1A2A44]/5 hover:bg-[#1A2A44] text-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] transition text-center flex items-center justify-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          Ver Plantel
        </Link>
        <Link
          href={`/admin/equipos/${club.id}/finanzas`}
          id={`btn-finanzas-${club.id}`}
          className="px-3 py-2 bg-slate-50 hover:bg-[#F97316] hover:text-white text-slate-650 rounded-lg font-bold text-[10px] transition text-center flex items-center justify-center gap-1"
        >
          <Wallet className="w-3 h-3" />
          Finanzas
        </Link>
      </div>
    </div>
  );
}
