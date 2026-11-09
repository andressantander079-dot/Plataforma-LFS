import Link from "next/link";
import { Newspaper, ArrowRight } from "lucide-react";
import type { NoticiaPublicaUI } from "@/lib/actions/noticias.actions";
import { TarjetaNoticia } from "./TarjetaNoticia";

/**
 * Sección "Últimas noticias" de la home pública.
 * Muestra hasta 3 noticias (la destacada ocupa doble ancho) y solo se
 * renderiza si hay contenido publicado.
 */
export function SeccionNoticiasHome({ noticias }: { noticias: NoticiaPublicaUI[] }) {
  if (noticias.length === 0) return null;

  const destacada = noticias.find((n) => n.destacada);
  const resto = noticias.filter((n) => n.id !== destacada?.id);
  const visibles = (destacada ? [destacada, ...resto] : resto).slice(0, 3);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-[#F97316]" />
          Últimas noticias
        </h3>
        <Link
          href="/noticias"
          id="link-todas-noticias"
          className="text-xs font-bold text-[#F97316] hover:underline flex items-center gap-1"
        >
          Ver todas <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibles.map((n, i) => (
          <TarjetaNoticia key={n.id} noticia={n} grande={i === 0 && n.destacada} />
        ))}
      </div>
    </section>
  );
}
