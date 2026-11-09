import { redirect, notFound } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerNoticiaParaEditar } from "@/lib/actions/noticias.actions";
import { EditorNoticia } from "@/components/noticias/EditorNoticia";

export const dynamic = "force-dynamic";

/** Edición de una noticia existente (carga valores iniciales en el editor). */
export default async function EditarNoticia({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const datos = await obtenerNoticiaParaEditar(id);
  if (!datos) notFound();

  return <EditorNoticia categorias={datos.categorias} noticia={datos.noticia} />;
}
