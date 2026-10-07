import { redirect } from "next/navigation";
import { obtenerTribunalClub } from "@/lib/actions/tribunal.actions";
import { TribunalClub } from "@/components/tribunal/TribunalClub";

/**
 * TRIBUNAL — Vista del club.
 * Revisa sus sanciones, el estado de las multas en tesorería y apela
 * dentro de las 72 hs. (El guard de sesión/club ya lo hace el layout.)
 */
export default async function TribunalClubPage() {
  let datos;
  try {
    datos = await obtenerTribunalClub();
  } catch {
    redirect("/club/dashboard");
  }

  return (
    <TribunalClub
      clubId={datos.clubId}
      clubNombre={datos.clubNombre}
      sanciones={datos.sanciones}
      apelaciones={datos.apelaciones}
    />
  );
}
