import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { FormularioConfiguracion } from "@/components/tesoreria/FormularioConfiguracion";

/**
 * CONFIGURACIÓN DE TESORERÍA
 * Montos de multas automáticas, recargo por mora y datos fiscales.
 * Solo el admin modifica; el tesorero la ve en solo lectura.
 */
export default async function TesoreriaConfiguracion() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("treasury_settings").select("*").eq("id", 1).single(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-2">
        <Link
          href="/admin/tesoreria"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Tesorería
        </Link>
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#F97316]" />
          Configuración de Tesorería
        </h1>
        <p className="text-slate-500 text-xs">
          Los montos de las multas se aplican automáticamente desde que se guardan.
          Las multas ya emitidas no cambian.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <FormularioConfiguracion
          settings={{
            fine_red: Number(settings?.fine_red ?? 0),
            fine_wo: Number(settings?.fine_wo ?? 0),
            fine_yellow_accum: Number(settings?.fine_yellow_accum ?? 0),
            late_fee_percent: Number(settings?.late_fee_percent ?? 0),
            league_legal_name: settings?.league_legal_name ?? null,
            league_cuit: settings?.league_cuit ?? null,
            league_address: settings?.league_address ?? null,
          }}
          soloLectura={profile?.role !== "admin"}
        />
      </div>
    </div>
  );
}
