import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileBadge, Radio } from "lucide-react";
import { obtenerPlanilla } from "@/lib/actions/planilla.actions";
import { obtenerPlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import { VistaPlanilla } from "@/components/planilla/VistaPlanilla";
import { BotonAprobarPlanilla } from "@/components/planilla/BotonAprobarPlanilla";
import { BotonImprimir } from "@/components/planilla/BotonImprimir";
import { GestionOficiales } from "@/components/planilla-vivo/GestionOficiales";

/**
 * PLANILLA DEL PARTIDO (federación) — Paso 7A
 * Vista completa con aprobación, reapertura e impresión.
 * Paso 17C: gestión de oficiales (2do árbitro / planillero) y accesos a
 * la transmisión en vivo y la planilla oficial premium.
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

  // Datos en vivo (oficiales designados) para la gestión del cuerpo arbitral.
  const vivoRes = await obtenerPlanillaEnVivo(matchId);
  const vivo = vivoRes.data ?? null;

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Link
          href={`/admin/competencias/${planilla.competitionId}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1A2A44] text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al torneo
        </Link>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Link
            href={`/en-vivo/${matchId}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3.5 py-2 transition"
          >
            <Radio className="w-4 h-4" /> Transmisión
          </Link>
          <Link
            href={`/planilla-oficial/${matchId}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1A2A44] hover:bg-[#24365a] text-white text-xs font-bold px-3.5 py-2 transition"
          >
            <FileBadge className="w-4 h-4" /> Planilla oficial
          </Link>
          <BotonImprimir />
          <BotonAprobarPlanilla matchId={matchId} status={planilla.sheet?.status ?? null} />
        </div>
      </div>

      {vivo && (
        <GestionOficiales
          matchId={matchId}
          oficiales={vivo.oficiales}
          arbitroPrincipalId={vivo.arbitroPrincipalId}
        />
      )}

      <VistaPlanilla planilla={planilla} />
    </div>
  );
}
