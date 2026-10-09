import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerMiCalendario } from "@/lib/actions/arbitros.actions";
import { CalendarioArbitro } from "@/components/arbitros/CalendarioArbitro";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";

export const dynamic = "force-dynamic";

/**
 * CALENDARIO DEL ÁRBITRO (Paso 16) — mes a mes: sus partidos, los eventos
 * que carga la liga (capacitaciones/congresos) y sus bloques de no
 * disponibilidad. Todo real, nada inventado.
 */
export default async function ArbitroCalendario() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const ahora = new Date();
  const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  const dias = await obtenerMiCalendario(mes);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <RealtimeRefresher tablas={["matches", "referee_events"]} />
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Mi Calendario
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Partidos designados, capacitaciones y tus días de no disponibilidad.
        </p>
      </div>

      <CalendarioArbitro mesInicial={mes} diasIniciales={dias} />
    </div>
  );
}
