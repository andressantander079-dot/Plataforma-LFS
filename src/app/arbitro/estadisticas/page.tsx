import { redirect } from "next/navigation";
import { SquareChartGantt } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerMisEstadisticas } from "@/lib/actions/arbitros.actions";
import { EstadisticasArbitroPanel } from "@/components/arbitros/EstadisticasArbitroPanel";

export const dynamic = "force-dynamic";

/**
 * MIS ESTADÍSTICAS (árbitro, Paso 16) — números reales calculados de los
 * partidos y planillas que cargó: totales y desglose por torneo.
 */
export default async function ArbitroEstadisticas() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { total, porTorneo } = await obtenerMisEstadisticas();

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <SquareChartGantt className="w-7 h-7 text-[#F97316]" />
          Mis Estadísticas
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Tus números salen de las planillas reales que cargaste — ni más ni menos.
        </p>
      </div>

      <EstadisticasArbitroPanel total={total} porTorneo={porTorneo} />
    </div>
  );
}
