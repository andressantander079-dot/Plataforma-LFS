import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import { obtenerNoticiasPublicas } from "@/lib/actions/noticias.actions";
import { TarjetaNoticia } from "@/components/noticias/TarjetaNoticia";

export const metadata: Metadata = {
  title: "Noticias — Liga de Fútsal de Ushuaia",
  description:
    "Todas las novedades de la Liga de Fútsal de Ushuaia: competencias, anuncios institucionales, tribunal y vida social de los clubes.",
};

/**
 * NOTICIAS (público, Paso 17A) — portada del noticiero de la liga.
 * La noticia destacada abre la grilla a doble ancho; el resto sigue
 * en orden cronológico. Solo contenido publicado y vigente (RPC pública).
 */
export default async function NoticiasPage() {
  const noticias = await obtenerNoticiasPublicas();

  const destacada = noticias.find((n) => n.destacada);
  const resto = noticias.filter((n) => n.id !== destacada?.id);

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl md:text-3xl font-black text-[#1A2A44] flex items-center gap-2">
          <Newspaper className="w-7 h-7 text-[#F97316]" />
          Noticias
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Novedades oficiales de la Liga de Fútsal de Ushuaia.
        </p>
      </div>

      {noticias.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
          <Newspaper className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            Todavía no hay noticias publicadas. ¡Volvé pronto!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {destacada && <TarjetaNoticia noticia={destacada} grande />}
          {resto.map((n) => (
            <TarjetaNoticia key={n.id} noticia={n} />
          ))}
        </div>
      )}
    </div>
  );
}
