import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerMiPanel } from "@/lib/actions/arbitros.actions";
import { PanelArbitro } from "@/components/arbitros/PanelArbitro";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";

export const dynamic = "force-dynamic";

/**
 * PANEL DEL ÁRBITRO (Paso 16) — KPIs reales, propuestas de designación para
 * responder en el momento y próximos partidos. Se actualiza en tiempo real.
 */
export default async function RefereeDashboard() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const panel = await obtenerMiPanel();

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <RealtimeRefresher tablas={["matches", "referee_events"]} />
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Home className="w-7 h-7 text-[#F97316]" />
          Hola, {panel.nombre.split(" ")[0]}
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {panel.nivelNombre ? `${panel.nivelNombre} · ` : ""}
          Tus designaciones, planillas y honorarios en un solo lugar.
        </p>
      </div>

      <PanelArbitro panel={panel} />
    </div>
  );
}
