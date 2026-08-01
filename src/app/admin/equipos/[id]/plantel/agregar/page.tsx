import { notFound } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { FormularioAgregarJugador } from "@/components/admin/FormularioAgregarJugador";

/**
 * PÁGINA: INSCRIBIR JUGADOR (wrapper de servidor)
 * Trae el club y las categorías reales desde Supabase
 * y se los pasa al formulario (componente cliente).
 */

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

export default async function AgregarJugadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createLfsServerClient();

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!club) notFound();

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, level_hierarchy")
    .order("level_hierarchy");

  return (
    <FormularioAgregarJugador
      clubId={club.id}
      clubName={club.name}
      categories={(categories ?? []) as Category[]}
    />
  );
}
