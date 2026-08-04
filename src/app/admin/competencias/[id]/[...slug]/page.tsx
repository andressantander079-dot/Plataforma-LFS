import { redirect } from "next/navigation";

/** Sub-rutas viejas del scaffold → el detalle del torneo. */
export default async function CompetenciasLegacy({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/competencias/${id}`);
}
