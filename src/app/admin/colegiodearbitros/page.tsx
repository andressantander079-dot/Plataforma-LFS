import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  obtenerColegio,
  obtenerEventosArbitrales,
  obtenerLiquidaciones,
} from "@/lib/actions/arbitros.actions";
import { periodoActual } from "@/lib/core/rules/arbitrosRules";
import { ColegioTabs } from "@/components/arbitros/ColegioTabs";

export const dynamic = "force-dynamic";

/**
 * COLEGIO DE ÁRBITROS (admin, Paso 16) — el centro de gestión arbitral:
 * padrón completo con stats, niveles y tarifas, eventos arbitrales y
 * liquidaciones mensuales de honorarios (vinculadas a tesorería).
 */
export default async function ColegioDeArbitros() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const periodo = periodoActual();
  const [{ padron, niveles }, eventos, { filas }] = await Promise.all([
    obtenerColegio(),
    obtenerEventosArbitrales(),
    obtenerLiquidaciones(periodo),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Award className="w-7 h-7 text-[#F97316]" />
          Colegio de Árbitros
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Padrón, niveles y tarifas, eventos arbitrales y honorarios — todo el
          mundo arbitral de la liga en una sola pantalla.
        </p>
      </div>

      <ColegioTabs
        padron={padron}
        niveles={niveles}
        eventos={eventos}
        periodo={periodo}
        liquidaciones={filas}
      />
    </div>
  );
}
