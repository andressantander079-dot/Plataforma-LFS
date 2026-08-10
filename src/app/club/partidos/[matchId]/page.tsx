import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { obtenerPlanilla } from "@/lib/actions/planilla.actions";
import { VistaPlanilla, EstadoPlanillaBadge } from "@/components/planilla/VistaPlanilla";
import { BotonImprimir } from "@/components/planilla/BotonImprimir";

/**
 * PLANILLA DEL PARTIDO (club) — Paso 7A
 * El club puede VER y DESCARGAR la planilla una vez que la federación
 * la aprobó. Antes de eso, ve el estado en el que está.
 */
export default async function PlanillaClub({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  let planilla;
  try {
    planilla = await obtenerPlanilla(matchId);
  } catch {
    redirect("/club/partidos");
  }

  const aprobada = planilla.sheet?.status === "aprobada";
  const soyAdmin = planilla.esAdmin;

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white">
      <div className="bg-[#1A2A44] print:hidden">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center gap-3">
          <Link
            href="/club/partidos"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Mis partidos
          </Link>
          <h1 className="font-serif text-xl font-black text-white ml-auto">Planilla del partido</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col gap-4">
        {!aprobada && !soyAdmin ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm flex flex-col items-center gap-3">
            <Clock className="w-8 h-8 text-[#F97316]" />
            <p className="font-serif text-lg font-black text-[#1A2A44]">
              La planilla todavía no está aprobada
            </p>
            <p className="text-xs text-slate-500 max-w-sm">
              Cuando la federación apruebe la planilla de este partido, vas a poder verla y
              descargarla desde acá, de manera automática.
            </p>
            <EstadoPlanillaBadge status={planilla.sheet?.status ?? null} />
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <BotonImprimir />
            </div>
            <VistaPlanilla planilla={planilla} />
          </>
        )}
      </div>
    </main>
  );
}
