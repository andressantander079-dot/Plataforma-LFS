import { redirect, notFound } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerFichaDisciplinaria } from "@/lib/actions/tribunal.actions";
import { FichaDisciplinaria } from "@/components/tribunal/FichaDisciplinaria";

/**
 * FICHA DISCIPLINARIA de un jugador (solo federación):
 * tarjetas, sanciones y apelaciones en un solo timeline.
 */
export default async function FichaJugadorPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;

  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/club/dashboard");

  let ficha;
  try {
    ficha = await obtenerFichaDisciplinaria(playerId);
  } catch {
    notFound();
  }

  return <FichaDisciplinaria ficha={ficha} />;
}
