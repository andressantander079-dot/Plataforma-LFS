import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { obtenerPlanilla } from "@/lib/actions/planilla.actions";
import { PlanillaArbitro } from "@/components/planilla/PlanillaArbitro";
import { EstadoPlanillaBadge } from "@/components/planilla/VistaPlanilla";

/**
 * PLANILLA DEL ÁRBITRO — Paso 7A
 * Edición de jugadores (bajas/altas) y carga de eventos del partido.
 */
export default async function PlanillaArbitroPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  let planilla;
  try {
    planilla = await obtenerPlanilla(matchId);
  } catch {
    redirect("/arbitro/designaciones");
  }
  if (!planilla.esArbitroPartido && !planilla.esAdmin) redirect("/arbitro/designaciones");

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/arbitro/designaciones"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1A2A44] text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Designaciones
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <EstadoPlanillaBadge status={planilla.sheet?.status ?? null} />
        </div>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-[#F97316]" />
          {planilla.local} vs {planilla.visitante}
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {planilla.torneo} · {planilla.categoria}
          {planilla.matchday !== null && ` · Fecha ${planilla.matchday}`}
        </p>
      </div>

      <PlanillaArbitro planilla={planilla} />
    </div>
  );
}
