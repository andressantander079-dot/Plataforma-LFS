"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, KeyRound, Save, AlertTriangle, LoaderCircle, Info } from "lucide-react";
import { asignarCredencialesClub } from "@/lib/actions/equipos.actions";

/**
 * PANEL LATERAL: ASIGNAR CREDENCIALES A UN CLUB
 * La federación crea el email y la contraseña con los que
 * el club va a iniciar sesión en su propio panel.
 */

interface Props {
  clubId: string;
  clubName: string;
  abierto: boolean;
  onCerrar: () => void;
}

export function PanelCredencialesClub({ clubId, clubName, abierto, onCerrar }: Props) {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const formData = new FormData(e.currentTarget);
    const result = await asignarCredencialesClub(clubId, formData);
    setCargando(false);

    if (!result.ok) {
      setError(result.error ?? "Ocurrió un error inesperado.");
      return;
    }

    (e.target as HTMLFormElement).reset();
    onCerrar();
    router.refresh();
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] w-full";

  return (
    <>
      <div
        onClick={onCerrar}
        className={`fixed inset-0 z-40 bg-[#1A2A44]/40 backdrop-blur-[1px] transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-[#1A2A44]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F97316] flex items-center justify-center">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">
                Asignar Credenciales
              </h3>
              <p className="text-slate-400 text-[11px]">{clubName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition"
            aria-label="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div className="flex items-start gap-2 p-3 bg-[#1A2A44]/5 text-slate-500 text-[11px] rounded-xl">
            <Info className="w-4 h-4 shrink-0 text-[#F97316]" />
            <span>
              Se creará un usuario de la plataforma vinculado a este club.
              Entregá estas credenciales solo a las autoridades. Podés crear
              más de un usuario por club (por ejemplo, uno para el presidente
              y otro para el delegado).
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Email de acceso</label>
            <input
              type="email"
              name="email"
              required
              placeholder="club@lfs.org.ar"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">
              Contraseña (mínimo 6 caracteres)
            </label>
            <input
              type="text"
              name="password"
              required
              minLength={6}
              placeholder="Ej: lfs2026camioneros"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={cargando}
              className="w-full px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
            >
              {cargando ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {cargando ? "Creando usuario..." : "Crear Acceso"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
