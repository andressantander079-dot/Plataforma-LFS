import Link from "next/link";
import { Eye, Heart, Star } from "lucide-react";
import type { NoticiaPublicaUI } from "@/lib/actions/noticias.actions";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Imagen de portada o fallback elegante con la marca LFS. */
function Portada({ url, titulo, grande }: { url: string | null; titulo: string; grande?: boolean }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={titulo}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
      />
    );
  }
  return (
    <div className="w-full h-full bg-gradient-to-br from-[#1A2A44] to-slate-900 flex flex-col items-center justify-center gap-2">
      <span
        className={`font-black text-white/90 bg-[#F97316] rounded-full flex items-center justify-center ${
          grande ? "w-14 h-14 text-xl" : "w-10 h-10 text-sm"
        }`}
      >
        LFS
      </span>
      <span className="text-[10px] text-slate-400 uppercase tracking-widest">Liga de Fútsal · Ushuaia</span>
    </div>
  );
}

/** Tarjeta de noticia para listados públicos (grilla y home). */
export function TarjetaNoticia({ noticia, grande = false }: { noticia: NoticiaPublicaUI; grande?: boolean }) {
  return (
    <Link
      href={`/noticias/${noticia.slug}`}
      id={`tarjeta-noticia-${noticia.slug}`}
      className={`group bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 flex ${
        grande ? "flex-col md:flex-row md:col-span-2" : "flex-col"
      }`}
    >
      <div className={`relative overflow-hidden shrink-0 ${grande ? "h-56 md:h-auto md:w-1/2" : "h-44"}`}>
        <Portada url={noticia.portadaUrl} titulo={noticia.titulo} grande={grande} />
        {noticia.destacada && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide bg-amber-400 text-amber-950 shadow">
            <Star className="w-3 h-3" /> Destacada
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          {noticia.categoria && (
            <span
              className="px-2 py-0.5 rounded-full font-bold uppercase tracking-wide text-white text-[10px]"
              style={{ backgroundColor: noticia.categoria.color }}
            >
              {noticia.categoria.nombre}
            </span>
          )}
          <span>{formatearFecha(noticia.publicadaAt)}</span>
        </div>

        <h3
          className={`font-serif font-bold text-[#1A2A44] mt-2 leading-snug group-hover:text-[#F97316] transition-colors ${
            grande ? "text-2xl" : "text-lg line-clamp-2"
          }`}
        >
          {noticia.titulo}
        </h3>
        <p className={`text-sm text-slate-500 mt-2 ${grande ? "line-clamp-3" : "line-clamp-2"}`}>
          {noticia.resumen}
        </p>

        <div className="mt-auto pt-4 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> {noticia.vistas.toLocaleString("es-AR")}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" /> {noticia.likes.toLocaleString("es-AR")}
          </span>
          <span className="ml-auto font-bold text-[#F97316] group-hover:translate-x-1 transition-transform">
            Leer →
          </span>
        </div>
      </div>
    </Link>
  );
}
