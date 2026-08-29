import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerConfiguracionAdminCompleta } from "@/lib/actions/configuracion.actions";
import { PanelConfiguracion } from "@/components/admin/configuracion/PanelConfiguracion";
import { DEFAULT_LEAGUE_CONFIG } from "@/lib/core/rules/configuracionRules";

export const metadata = {
  title: "Panel de Configuración General • Admin LFS",
  description: "Configuración integral de la Liga de Fútsal de Ushuaia (identidad, categorías, sponsors, sedes y disciplina).",
};

export const dynamic = "force-dynamic";

export default async function ConfiguracionAdminPage() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/club/dashboard");
  }

  const res = await obtenerConfiguracionAdminCompleta();

  const initialConfig = res.data?.config || DEFAULT_LEAGUE_CONFIG;
  const initialSponsors = res.data?.sponsors || [];
  const initialCategories = res.data?.categories || [];
  const initialVenues = res.data?.venues || [];
  const initialAuditLogs = res.data?.auditLogs || [];

  return (
    <PanelConfiguracion
      initialConfig={initialConfig}
      initialSponsors={initialSponsors}
      initialCategories={initialCategories}
      initialVenues={initialVenues}
      initialAuditLogs={initialAuditLogs}
    />
  );
}
