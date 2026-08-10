import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obtenerPlanilla } from "@/lib/actions/planilla.actions";
import { VistaPlanilla } from "@/components/planilla/VistaPlanilla";
import { BotonAprobarPlanilla } from "@/components/planilla/BotonAprobarPlanilla";
import { BotonImprimir } from "@/components/planilla/BotonImprimir";

/**
 * PLANILLA DEL PARTIDO (federación) — Paso 7A
 * Vista completa con aprobación, reapertura e impresión.
 */
export default async function PlanillaAdmin({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  let planilla;
  try {
    planilla = await obtenerPlanilla(matchId);
  } catch {
    redirect("/admin/competencias");
  }
  if (!planilla.esAdmin) redirect("/admin/dashboard");

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/admin/competencias/${planilla.competitionId}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1A2A44] text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al torneo
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <BotonImprimir />
          <BotonAprobarPlanilla matchId={matchId} status={planilla.sheet?.status ?? null} />
        </div>
      </div>

      <VistaPlanilla planilla={planilla} />
    </div>
  );
}
