import { PaginaNoDisponible } from "@/components/compartidos/PaginaNoDisponible";

/**
 * Catch-all del árbitro (Paso 17B): antes redirigía en silencio al panel.
 * Ahora muestra el 404 premium con accesos directos a sus módulos reales
 * (calendario, planillas, designaciones), más claro y consistente.
 */
export default function ArbitroCatchAll() {
  return <PaginaNoDisponible rol="arbitro" />;
}
