import { puntosSparkline } from "@/lib/core/rules/dashboardRules";

/**
 * SPARKLINE — Mini-gráfico SVG nativo (0 KB de librerías, vuela en celulares).
 * Muestra la tendencia de una serie de números (ej.: partidos por día).
 */
export function Sparkline({
  valores,
  ancho = 120,
  alto = 36,
  color = "#F97316",
  id,
}: {
  valores: number[];
  ancho?: number;
  alto?: number;
  color?: string;
  id: string;
}) {
  const puntos = puntosSparkline(valores, ancho, alto);
  const areaId = `spark-area-${id}`;

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="w-full h-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {puntos !== "" && (
        <>
          <polygon points={`0,${alto} ${puntos} ${ancho},${alto}`} fill={`url(#${areaId})`} />
          <polyline
            points={puntos}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}
    </svg>
  );
}
