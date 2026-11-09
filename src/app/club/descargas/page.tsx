import { redirect } from "next/navigation";
import { Download, Lock } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerDescargasClub } from "@/lib/actions/descargas.actions";
import { ListaDescargas } from "@/components/descargas/ListaDescargas";

export const dynamic = "force-dynamic";

/**
 * DESCARGAS DEL CLUB (Paso 17A) — documentos del ámbito interno
 * (planillas en blanco, circulares, material para delegados) que la
 * federación publica solo para clubes y árbitros con cuenta.
 */
export default async function ClubDescargas() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const documentos = await obtenerDescargasClub();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Download className="w-7 h-7 text-[#F97316]" />
          Descargas del Club
        </h2>
        <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
          <Lock className="w-3 h-3" />
          Material interno para clubes y árbitros: planillas, circulares y documentación oficial.
        </p>
      </div>

      <ListaDescargas documentos={documentos} />
    </div>
  );
}
