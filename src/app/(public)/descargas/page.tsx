import type { Metadata } from "next";
import { Download } from "lucide-react";
import { obtenerDescargasPublicas } from "@/lib/actions/descargas.actions";
import { ListaDescargas } from "@/components/descargas/ListaDescargas";

export const metadata: Metadata = {
  title: "Descargas — Liga de Fútsal de Ushuaia",
  description:
    "Reglamentos, boletines oficiales, formularios y planillas de la Liga de Fútsal de Ushuaia, con historial de versiones siempre disponible.",
};

/**
 * DESCARGAS (público, Paso 17A) — documentos oficiales de la liga con
 * historial completo de versiones: cualquiera puede ver y bajar tanto la
 * versión vigente como todas las anteriores.
 */
export default async function DescargasPublicasPage() {
  const documentos = await obtenerDescargasPublicas();

  return (
    <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl md:text-3xl font-black text-[#1A2A44] flex items-center gap-2">
          <Download className="w-7 h-7 text-[#F97316]" />
          Descargas
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Reglamentos, boletines, formularios y planillas oficiales. El historial de versiones es público.
        </p>
      </div>

      <ListaDescargas documentos={documentos} />
    </div>
  );
}
