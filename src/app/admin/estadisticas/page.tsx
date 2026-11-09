import { BarChart3 } from "lucide-react";
import {
  obtenerEstadisticasGlobales,
  obtenerFiltrosEstadisticas,
} from "@/lib/actions/estadisticas-globales.actions";
import { EstadisticasGlobalesPanel } from "@/components/estadisticas/EstadisticasGlobalesPanel";

export const metadata = {
  title: "Estadísticas Globales | Admin LFS",
  description: "Indicadores generales de rendimiento, goles y conducta en el torneo.",
};

/**
 * ESTADÍSTICAS GLOBALES (Paso 17B): KPIs reales, evolución de 6 meses,
 * rankings de jugadores y clubes, filtro por torneo/temporada y exportación
 * a Excel con hojas separadas.
 */
export default async function EstadisticasAdminPage() {
  const [filtros, datosIniciales] = await Promise.all([
    obtenerFiltrosEstadisticas(),
    obtenerEstadisticasGlobales({ competitionId: null, temporada: null }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Estadísticas Globales LFS
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Números reales de la liga: rendimiento, goles, disciplina y finanzas. Filtrá por
          torneo o temporada y exportá todo a Excel.
        </p>
      </div>

      <EstadisticasGlobalesPanel filtros={filtros} datosIniciales={datosIniciales} />
    </div>
  );
}
