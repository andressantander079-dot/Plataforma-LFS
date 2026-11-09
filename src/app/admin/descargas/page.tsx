import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerGestionDescargas } from "@/lib/actions/descargas.actions";
import { DescargasTabs } from "@/components/descargas/DescargasTabs";

export const dynamic = "force-dynamic";

/**
 * DESCARGAS (admin, Paso 17A) — la federación sube reglamentos, boletines,
 * formularios y planillas con historial completo de versiones, en dos
 * ámbitos: público y solo para clubes/árbitros.
 */
export default async function AdminDescargas() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [gestionPublicos, gestionClubes] = await Promise.all([
    obtenerGestionDescargas("publico"),
    obtenerGestionDescargas("clubes"),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Download className="w-7 h-7 text-[#F97316]" />
          Descargas
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Documentos oficiales con versionado: el historial completo queda visible para quien descarga.
        </p>
      </div>

      <DescargasTabs gestionPublicos={gestionPublicos} gestionClubes={gestionClubes} />
    </div>
  );
}
