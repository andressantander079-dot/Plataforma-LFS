/**
 * SKELETONS — Pantallas de carga con la FORMA del contenido
 * (estándar premium: Instagram, LinkedIn). Se muestran mientras
 * el servidor prepara los datos del dashboard.
 */

function Bloque({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6" aria-busy="true" aria-label="Cargando panel">
      {/* Saludo */}
      <div className="flex flex-col gap-2">
        <Bloque className="h-3 w-28" />
        <Bloque className="h-8 w-3/4 max-w-md" />
      </div>

      {/* Hero */}
      <Bloque className="h-44 w-full" />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Bloque className="h-24" />
        <Bloque className="h-24" />
        <Bloque className="h-24" />
        <Bloque className="h-24" />
      </div>

      {/* Alertas */}
      <div className="flex flex-col gap-2">
        <Bloque className="h-3 w-40" />
        <Bloque className="h-16" />
        <Bloque className="h-16" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Bloque className="h-24" />
        <Bloque className="h-24" />
        <Bloque className="h-24" />
        <Bloque className="h-24" />
      </div>
    </div>
  );
}
