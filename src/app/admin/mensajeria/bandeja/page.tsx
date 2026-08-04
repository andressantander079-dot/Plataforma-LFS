import { redirect } from "next/navigation";

/**
 * Esta ruta pertenecía a la mensajería de demostración (mock).
 * La mensajería real vive ahora en /admin/mensajeria.
 */
export default function MensajeriaLegacy() {
  redirect("/admin/mensajeria");
}
