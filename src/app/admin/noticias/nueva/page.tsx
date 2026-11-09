import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerPanelNoticias } from "@/lib/actions/noticias.actions";
import { EditorNoticia } from "@/components/noticias/EditorNoticia";

export const dynamic = "force-dynamic";

/** Nueva noticia: editor completo con portada, galería, video y programación. */
export default async function NuevaNoticia() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Solo necesitamos las categorías para el selector
  const panel = await obtenerPanelNoticias();

  return <EditorNoticia categorias={panel.categorias} />;
}
