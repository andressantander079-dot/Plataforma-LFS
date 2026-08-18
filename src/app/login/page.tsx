"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldAlert, Sparkles } from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createLfsClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Credenciales inválidas.");
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError("Error en el inicio de sesión. Inténtalo de nuevo.");
        setLoading(false);
        return;
      }

      // Obtener el rol del perfil del usuario
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        setError("No tienes un perfil registrado o careces de permisos.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      const role = profile.role;
      if (role === "admin") {
        router.push("/admin/dashboard");
      } else if (role === "tesorero") {
        router.push("/admin/tesoreria/movimientos");
      } else if (role === "arbitro" || role === "arbitro_asistente") {
        router.push("/arbitro/dashboard");
      } else if (role === "club") {
        router.push("/club/dashboard");
      } else {
        setError("Rol no reconocido en la plataforma.");
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A2A44] to-[#0d1522] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white/95 backdrop-blur-md border border-slate-100 rounded-3xl p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden">
        {/* Glow Decorativo */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#F97316]/20 rounded-full blur-xl" />

        {/* Logo/Header */}
        <div className="text-center flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#1A2A44] to-[#F97316] rounded-2xl flex items-center justify-center shadow-lg text-white font-serif text-xl font-black">LFS</div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44]">Iniciar Sesión</h1>
          <p className="text-slate-400 text-xs">Acceso institucional a la Liga de Fútsal de Ushuaia.</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Correo Electrónico</label>
            <input
              type="email"
              required
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Contraseña</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100 font-bold">
              <ShieldAlert className="w-4 h-4 text-red-650" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#F97316]/10 flex items-center justify-center gap-2 hover:bg-[#F97316]/95 transition disabled:opacity-50"
          >
            {loading ? "Iniciando..." : (
              <>
                <LogIn className="w-4 h-4" />
                Ingresar a la Plataforma
              </>
            )}
          </button>
        </form>

        {/* Tip Informativo */}
        <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
          <Sparkles className="w-4 h-4 text-[#F97316] shrink-0" />
          <span>**Sugerencia de prueba:** Use `admin@lfs.com` para panel de Administración, `arbitro@lfs.com` para Árbitros o `club@lfs.com` para Clubes.</span>
        </div>
      </div>
    </div>
  );
}
