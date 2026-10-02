import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * QUICK ACTIONS — Botones grandes touch-friendly (mínimo 56px de alto)
 * con las acciones más frecuentes de cada rol.
 */

export interface AccionRapida {
  href: string;
  label: string;
  icono: LucideIcon;
}

export function QuickActions({ acciones }: { acciones: AccionRapida[] }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Acciones rápidas
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {acciones.map((a) => (
          <Link
            key={a.href + a.label}
            href={a.href}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-col items-center justify-center gap-2 min-h-[88px] text-center transition hover:shadow-md hover:border-[#F97316]/40 active:scale-[0.98]"
          >
            <span className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center">
              <a.icono className="w-5 h-5 text-[#F97316]" />
            </span>
            <span className="text-[11px] font-bold text-[#1A2A44] leading-tight">{a.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
