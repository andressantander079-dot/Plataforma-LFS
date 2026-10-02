import { BottomNav } from "@/components/navigation/BottomNav";

/**
 * LAYOUT DEL ÁRBITRO — Envuelve todas las páginas /arbitro.
 * Agrega la barra de navegación inferior estilo app (solo móvil)
 * y el espacio inferior para que no tape el contenido.
 * El guard por rol lo hace el proxy; las páginas validan sesión.
 */
export default function ArbitroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100 pb-20 md:pb-0">
      {children}
      <BottomNav rol="arbitro" />
    </div>
  );
}
