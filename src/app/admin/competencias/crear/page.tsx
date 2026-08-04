import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { FormularioTorneo } from "@/components/competencias/FormularioTorneo";

/** Alta de torneo (admin). */
export default async function CrearTorneo() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: categorias } = await supabase
    .from("categories")
    .select("id, name")
    .order("level_hierarchy");

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <Link
          href="/admin/competencias"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Competencias
        </Link>
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Trophy className="w-7 h-7 text-[#F97316]" />
          Crear Torneo
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Configurá el torneo a tu medida: puntos, desempate, ida/vuelta y W.O.
        </p>
      </div>

      <FormularioTorneo categorias={categorias ?? []} />
    </div>
  );
}
