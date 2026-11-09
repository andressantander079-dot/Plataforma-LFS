"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Lock, Loader2, ShieldAlert, LogIn } from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";

/**
 * GATE DE CONTRASEÑA — Paso 17C
 * Antes de abrir la planilla, el árbitro confirma SU contraseña de
 * cuenta (una sola vez por sesión de navegador: queda en sessionStorage).
 * El admin en modo override no pasa por acá.
 */

const CLAVE_SESION = "lfs_planilla_gate";

export function GateContrasena({
  children,
  titulo = "Confirmá tu identidad",
  descripcion = "Por seguridad, ingresá tu contraseña para abrir la planilla del partido.",
}: {
  children: ReactNode;
  titulo?: string;
  descripcion?: string;
}) {
  const [estado, setEstado] = useState<"cargando" | "bloqueado" | "listo">("cargando");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const supabase = createLfsClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelado) return;
      if (!user) {
        setEstado("bloqueado");
        setError("No hay una sesión activa. Volvé a entrar a la plataforma.");
        return;
      }
      setUserId(user.id);
      try {
        const guardado = sessionStorage.getItem(`${CLAVE_SESION}_${user.id}`);
        setEstado(guardado === "ok" ? "listo" : "bloqueado");
      } catch {
        setEstado("bloqueado");
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const verificar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || verificando) return;
    setVerificando(true);
    setError(null);
    try {
      const supabase = createLfsClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        setError("No pudimos leer tu usuario. Recargá la página.");
        return;
      }
      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (errorAuth) {
        setError("La contraseña no es correcta. Probá de nuevo.");
        setPassword("");
        return;
      }
      try {
        sessionStorage.setItem(`${CLAVE_SESION}_${userId}`, "ok");
      } catch {
        // si el navegador bloquea storage, igual la dejamos pasar esta vez
      }
      setEstado("listo");
    } finally {
      setVerificando(false);
    }
  };

  if (estado === "cargando") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (estado === "bloqueado") {
    return (
      <div className="max-w-md mx-auto">
        <form
          onSubmit={verificar}
          className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 flex flex-col gap-5"
        >
          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#1A2A44] text-[#F97316] flex items-center justify-center shadow-lg">
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-black text-[#1A2A44]">{titulo}</h2>
            <p className="text-sm text-slate-500 leading-relaxed">{descripcion}</p>
            <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest">
              Se pide una sola vez por sesión
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            autoFocus
            autoComplete="current-password"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316] outline-none"
          />

          <button
            type="submit"
            disabled={verificando || password.length < 4}
            className="inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea6a0a] disabled:bg-slate-300 text-white font-bold text-sm rounded-xl px-5 py-3 transition-colors"
          >
            {verificando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {verificando ? "Verificando..." : "Abrir planilla"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
