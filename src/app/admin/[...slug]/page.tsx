import { PaginaNoDisponible } from "@/components/compartidos/PaginaNoDisponible";

/**
 * Catch-all del admin (Paso 17B): antes mostraba submódulos falsos
 * (tribunal trucho, etc.). Todo lo real tiene su propia ruta, así que lo
 * que cae acá es una URL que no existe → 404 premium con accesos según rol.
 */
export default function AdminCatchAll() {
  return <PaginaNoDisponible rol="admin" />;
}
