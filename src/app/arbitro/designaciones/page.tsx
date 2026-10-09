import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerMisDesignaciones } from "@/lib/actions/arbitros.actions";
import { TarjetasDesignacion } from "@/components/arbitros/TarjetasDesignacion";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";

export const dynamic = "force-dynamic";

/**
 * MIS DESIGNACIONES (árbitro, Paso 16) — propuestas para aceptar/rechazar,
 * próximos partidos confirmados e historial con resultados.
 */
export default async function MisDesignaciones() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const designaciones = await obtenerMisDesignaciones();

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <RealtimeRefresher tablas={["matches"]} />
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <CalendarCheck className="w-7 h-7 text-[#F97316]" />
          Mis Designaciones
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Cuando la liga te propone un partido, respondé acá: aceptar o rechazar con motivo.
        </p>
      </div>

      <TarjetasDesignacion designaciones={designaciones} />
    </div>
  );
}
