import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerPanelNoticias } from "@/lib/actions/noticias.actions";
import { NoticiasTabs } from "@/components/noticias/NoticiasTabs";

export const dynamic = "force-dynamic";

/**
 * NOTICIAS (admin, Paso 17A) — redacción, programación, destacada,
 * categorías con color y estadísticas de contenido del portal público.
 */
export default async function AdminNoticias() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const panel = await obtenerPanelNoticias();

  return <NoticiasTabs panel={panel} />;
}
