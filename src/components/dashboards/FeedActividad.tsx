import { Activity } from "lucide-react";

/**
 * FEED DE ACTIVIDAD — Últimas acciones registradas en la liga
 * (tabla audit_logs). Solo lo ve el admin. Estilo timeline vertical.
 */

export interface ItemActividad {
  id: string;
  action: string;
  module: string;
  created_at: string;
}

/** Traduce "modulo.accion" técnico a frase legible. */
function fraseActividad(item: ItemActividad): string {
  const modulo = item.module?.trim() ?? "";
  const accion = item.action?.trim() ?? "";
  if (modulo && accion) return `${accion} · ${modulo}`;
  return accion || modulo || "Actividad registrada";
}

export function FeedActividad({ items }: { items: ItemActividad[] }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-[#F97316]" />
        <h2 className="font-serif text-base font-bold text-[#1A2A44]">Actividad reciente</h2>
      </div>

      {items.length === 0 ? (
        <p className="text-slate-400 text-xs italic">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <ol className="relative border-l-2 border-slate-100 ml-1.5 flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="ml-4 relative">
              <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-[#F97316] ring-4 ring-[#F97316]/10" />
              <p className="text-xs font-semibold text-[#1A2A44] leading-snug">
                {fraseActividad(item)}
              </p>
              <p className="text-[10px] text-slate-400">
                {new Date(item.created_at).toLocaleString("es-AR", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZone: "America/Argentina/Ushuaia",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
