"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, LoaderCircle } from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";

/**
 * Botón de cierre de sesión real.
 * Reemplaza al viejo <Link href="/">Cerrar Sesión</Link> de los layouts.
 */
export function BotonCerrarSesion() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);

  async function handleLogout() {
    setCargando(true);
    try {
      const supabase = createLfsClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      // Si falla la conexión, igual lo mandamos al login
      router.push("/login");
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={cargando}
      className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition w-full disabled:opacity-60"
    >
      {cargando ? (
        <LoaderCircle className="w-4 h-4 animate-spin" />
      ) : (
        <LogOut className="w-4 h-4" />
      )}
      {cargando ? "Saliendo..." : "Cerrar Sesión"}
    </button>
  );
}
