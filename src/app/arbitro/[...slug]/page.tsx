import { redirect } from "next/navigation";

/**
 * Catch-all del panel árbitro (Paso 16): antes mostraba submódulos falsos
 * (firma táctil trucha, etc.). Ahora todo es real y tiene su propia ruta,
 * así que cualquier subruta vieja vuelve al panel principal.
 */
export default function ArbitroCatchAll() {
  redirect("/arbitro/dashboard");
}
