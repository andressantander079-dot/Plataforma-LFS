import { Scale } from "lucide-react";
import { obtenerReglamento } from "@/lib/actions/reglamento.actions";
import { GestionReglamento } from "@/components/reglamento/GestionReglamento";

export const metadata = {
  title: "Reglamento Oficial | Admin LFS",
  description: "Control de versiones y publicación del reglamento oficial de la liga.",
};

/**
 * REGLAMENTO OFICIAL (Paso 17B): historial dedicado con notas de cambios
 * obligatorias y una sola versión vigente. Cada versión nueva se publica
 * sola en /descargas (espejo automático en el módulo Descargas).
 */
export default async function ReglamentoAdminPage() {
  const panel = await obtenerReglamento();

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Scale className="w-7 h-7 text-[#F97316]" />
          Reglamento Oficial LFS
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Historial de versiones con notas de cambios. Al publicar una versión nueva se actualiza
          sola en las Descargas públicas.
        </p>
      </div>

      <GestionReglamento panel={panel} />
    </div>
  );
}
