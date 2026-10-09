import { redirect } from "next/navigation";
import { User } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  obtenerMiPerfil,
  obtenerMiDisponibilidad,
  obtenerMisLiquidaciones,
} from "@/lib/actions/arbitros.actions";
import { PerfilArbitroForm } from "@/components/arbitros/PerfilArbitroForm";
import { DisponibilidadArbitro } from "@/components/arbitros/DisponibilidadArbitro";
import { MisLiquidaciones } from "@/components/arbitros/MisLiquidaciones";

export const dynamic = "force-dynamic";

/**
 * MI PERFIL (árbitro, Paso 16) — edita foto, teléfono y firma digital real.
 * Además: su disponibilidad (días que NO puede) y sus honorarios.
 * El nivel y el estado los fija la liga desde el Colegio de Árbitros.
 */
export default async function ArbitroPerfil() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [perfil, bloques, pagos] = await Promise.all([
    obtenerMiPerfil(),
    obtenerMiDisponibilidad(),
    obtenerMisLiquidaciones(),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <User className="w-7 h-7 text-[#F97316]" />
          Mi Perfil
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Tu foto, teléfono, firma digital, disponibilidad y honorarios.
        </p>
      </div>

      <PerfilArbitroForm perfil={perfil} />
      <DisponibilidadArbitro bloques={bloques} />
      <MisLiquidaciones pagos={pagos} />
    </div>
  );
}
