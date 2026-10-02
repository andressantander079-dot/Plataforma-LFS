import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Sparkline } from "./Sparkline";

/**
 * TARJETA KPI — Métrica principal del dashboard.
 * Número grande, etiqueta, ícono con acento de color, detalle opcional
 * y mini-gráfico de tendencia opcional. Si recibe `href`, toda la tarjeta
 * es clicable (touch-friendly, mínimo 44px de alto — regla iOS/Android).
 */

const ACENTOS = {
  naranja: "bg-[#F97316]/10 text-[#F97316]",
  azul: "bg-[#1A2A44]/10 text-[#1A2A44]",
  rojo: "bg-red-500/10 text-red-600",
  verde: "bg-green-500/10 text-green-600",
  violeta: "bg-purple-500/10 text-purple-600",
} as const;

export type AcentoKpi = keyof typeof ACENTOS;

export function TarjetaKpi({
  titulo,
  valor,
  detalle,
  icono: Icono,
  acento = "naranja",
  href,
  sparkline,
  sparklineColor,
}: {
  titulo: string;
  valor: string | number;
  detalle?: string;
  icono: LucideIcon;
  acento?: AcentoKpi;
  href?: string;
  sparkline?: number[];
  sparklineColor?: string;
}) {
  const contenido = (
    <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col gap-2 min-h-[96px] transition hover:shadow-md hover:-translate-y-0.5 h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider leading-tight">
          {titulo}
        </span>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${ACENTOS[acento]}`}>
          <Icono className="w-4 h-4" />
        </span>
      </div>
      <span className="text-2xl md:text-3xl font-serif font-black text-[#1A2A44] leading-none">
        {valor}
      </span>
      <div className="flex items-end justify-between gap-2 mt-auto">
        {detalle ? (
          <span className="text-slate-400 text-[10px] font-medium leading-tight">{detalle}</span>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length > 1 && (
          <span className="w-20 h-8 shrink-0">
            <Sparkline valores={sparkline} id={`kpi-${titulo}`} color={sparklineColor ?? "#F97316"} />
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 rounded-2xl">
        {contenido}
      </Link>
    );
  }
  return contenido;
}
