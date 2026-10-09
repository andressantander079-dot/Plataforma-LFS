import { redirect } from "next/navigation";
import { UserCheck } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerPanelDesignaciones } from "@/lib/actions/arbitros.actions";
import { PanelDesignacionesAdmin } from "@/components/arbitros/PanelDesignacionesAdmin";

export const dynamic = "force-dynamic";

/**
 * DESIGNACIONES (admin, Paso 16) — asignación manual mejorada:
 * tildás partidos, elegís árbitro (con disponibilidad y conflictos a la
 * vista) y modo: directa o propuesta con confirmación del árbitro.
 */
export default async function DesignacionesAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const panel = await obtenerPanelDesignaciones();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <UserCheck className="w-7 h-7 text-[#F97316]" />
          Designaciones de Árbitros
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Asignación manual: tildá uno o varios partidos, elegí el árbitro y el modo.
          El aviso llega por mensajería interna automáticamente.
        </p>
      </div>

      <PanelDesignacionesAdmin panel={panel} />
    </div>
  );
}
