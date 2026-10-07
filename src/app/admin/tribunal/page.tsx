import { redirect } from "next/navigation";

/** El tribunal vive en /admin/tribunal/sanciones (a donde apunta el menú). */
export default function TribunalPage() {
  redirect("/admin/tribunal/sanciones");
}
