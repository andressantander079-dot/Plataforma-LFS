import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerPanelTribunalAdmin } from "@/lib/actions/tribunal.actions";
import { TribunalAdmin } from "@/components/tribunal/TribunalAdmin";

/**
 * TRIBUNAL DE DISCIPLINA — Panel de la federación (admin).
 * Vigentes / Apelaciones / Historial / Catálogo, con sanciones manuales
 * y modificación o anulación auditada de cualquier sanción.
 */
export default async function TribunalSancionesPage() {
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

  const panel = await obtenerPanelTribunalAdmin();

  return <TribunalAdmin panel={panel} />;
}
