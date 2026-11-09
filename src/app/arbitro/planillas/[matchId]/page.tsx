import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Users } from "lucide-react";
import { obtenerPlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import { PlanillaEnVivoPanel } from "@/components/planilla-vivo/PlanillaEnVivoPanel";
import { GateContrasena } from "@/components/planilla-vivo/GateContrasena";
import { EstadoPlanillaBadge } from "@/components/planilla/VistaPlanilla";

/**
 * PLANILLA DEL ÁRBITRO — Paso 17C (premium)
 * Gate de contraseña (una vez por sesión), semáforo pre-partido, reloj
 * con cuenta regresiva, eventos con minuto automático, faltas
 * acumuladas, tiempos pedidos, cierre con firmas y multi-oficial.
 */
export default async function PlanillaArbitroPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;

  const res = await obtenerPlanillaEnVivo(matchId);
  if (res.error || !res.data) redirect("/arbitro/designaciones");

  const planilla = res.data;
  const esInvolucrado =
    planilla.esPrincipal || planilla.esSegundo || planilla.esPlanillero || planilla.esAdmin;
  if (!esInvolucrado) redirect("/arbitro/designaciones");

  const rolTxt = planilla.esAdmin
    ? "Modo federación (override)"
    : planilla.esPrincipal
      ? "Árbitro principal"
      : planilla.esSegundo
        ? "2do árbitro"
        : "Planillero de mesa";

  const contenido = (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/arbitro/designaciones"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1A2A44] text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Designaciones
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest bg-[#1A2A44] text-white rounded-full px-3 py-1">
            <Users className="w-3 h-3" /> {rolTxt}
          </span>
          <EstadoPlanillaBadge status={planilla.sheetStatus} />
        </div>
      </div>

      <div>
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-[#F97316]" />
          {planilla.local} vs {planilla.visitante}
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          {planilla.torneo} · {planilla.categoria}
          {planilla.cancha && ` · ${planilla.cancha}`}
        </p>
        {planilla.oficiales.length > 0 && (
          <p className="text-slate-400 text-[11px] mt-1">
            {planilla.oficiales
              .filter((o) => o.estado === "aceptada")
              .map((o) => `${o.rol === "segundo_arbitro" ? "2do árbitro" : "Planillero"}: ${o.nombre}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <PlanillaEnVivoPanel planilla={planilla} />
    </div>
  );

  // El admin entra en modo override sin contraseña; los oficiales sí.
  if (planilla.esAdmin) return contenido;
  return <GateContrasena>{contenido}</GateContrasena>;
}
