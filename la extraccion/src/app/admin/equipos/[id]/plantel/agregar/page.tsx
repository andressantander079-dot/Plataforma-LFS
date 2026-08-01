import { redirect } from "next/navigation";

/**
 * REDIRECCIÓN DE COMPATIBILIDAD
 * La inscripción ahora se hace desde el panel lateral del plantel.
 * Esta ruta queda para enlaces viejos: manda al plantel con el panel abierto.
 */
export default async function AgregarRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/equipos/${id}/plantel?nuevo=1`);
}
