import Link from "next/link";
import { AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";
import { ordenarPorUrgencia, type ItemAtencion } from "@/lib/core/rules/dashboardRules";

/**
 * LISTA "REQUIERE ATENCIÓN" — Semáforo de pendientes.
 * 🔴 rojo = vencido (+48 hs) · 🟡 amarillo = próximo a vencer (<48 hs) · ⚪ info.
 * Cada alerta lleva DIRECTO a la pantalla donde se resuelve.
 */

const NIVEL_UI = {
  rojo: {
    borde: "border-red-200 bg-red-50",
    icono: "text-red-600",
    badge: "bg-red-600 text-white",
    Icono: AlertCircle,
    etiqueta: "Urgente",
  },
  amarillo: {
    borde: "border-amber-200 bg-amber-50",
    icono: "text-amber-600",
    badge: "bg-amber-500 text-white",
    Icono: AlertTriangle,
    etiqueta: "Próximo a vencer",
  },
  info: {
    borde: "border-slate-200 bg-white",
    icono: "text-slate-400",
    badge: "bg-slate-200 text-slate-600",
    Icono: Info,
    etiqueta: "Info",
  },
} as const;

export function ListaAtencion({ items }: { items: ItemAtencion[] }) {
  const ordenados = ordenarPorUrgencia(items);

  if (ordenados.length === 0) {
    return (
      <section className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
          <Info className="w-4 h-4 text-green-600" />
        </span>
        <div>
          <p className="font-bold text-sm text-green-800">Nada pendiente por ahora</p>
          <p className="text-[11px] text-green-600">Cuando algo necesite tu atención, aparece acá.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
        Requiere tu atención
      </h2>
      <div className="flex flex-col gap-2">
        {ordenados.map((item, i) => {
          const ui = NIVEL_UI[item.nivel];
          return (
            <Link
              key={`${item.href}-${i}`}
              href={item.href}
              className={`rounded-2xl border p-3.5 flex items-center gap-3 shadow-sm transition hover:shadow-md active:scale-[0.99] ${ui.borde}`}
            >
              <span className="shrink-0">
                <ui.Icono className={`w-5 h-5 ${ui.icono}`} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-[#1A2A44] leading-snug">{item.titulo}</p>
                <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{item.detalle}</p>
              </div>
              <span className={`hidden sm:inline-flex text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ui.badge}`}>
                {ui.etiqueta}
              </span>
              <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-[#F97316]">
                {item.accion}
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
