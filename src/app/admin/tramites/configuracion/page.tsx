import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings2, PencilLine } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerConfigMercado } from "@/lib/actions/tramites.actions";
import { VistaMercadoReadOnly } from "@/components/tramites/VistaMercadoReadOnly";

export const dynamic = "force-dynamic";

/**
 * CONFIGURACIÓN DEL MERCADO — vista de consulta (Paso 15).
 * La ÚNICA fuente de verdad es esta misma información, y se edita desde
 * Configuración LFS → pestaña "Pases & Fichajes". Acá se ve en vivo
 * (se actualiza sola sin recargar) pero no se toca, para que nunca haya
 * dos lugares con valores distintos.
 */
export default async function ConfiguracionPasesPage() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const config = await obtenerConfigMercado();

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tramites"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Trámites
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <Settings2 className="w-7 h-7 text-[#F97316]" />
              Configuración del mercado
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Reglas del mercado de pases: ventanas, categorías, derechos de pase y recargos.
            </p>
          </div>
          <Link
            href="/admin/configuracion"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#ea580c] text-white transition text-[11px] shadow-lg shadow-orange-500/20"
          >
            <PencilLine className="w-4 h-4" />
            Editar en Configuración LFS
          </Link>
        </div>
      </div>

      <VistaMercadoReadOnly inicial={config} />
    </div>
  );
}
