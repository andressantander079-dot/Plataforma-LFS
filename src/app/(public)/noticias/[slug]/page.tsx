import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Eye, CalendarDays } from "lucide-react";
import { obtenerNoticiaPublica } from "@/lib/actions/noticias.actions";
import { tiempoLecturaMin, urlEmbedYoutube, extraerYoutubeId } from "@/lib/core/rules/noticiasRules";
import { BotonLike, RegistradorVista } from "@/components/noticias/InteraccionesNoticia";
import { BotonesCompartir } from "@/components/noticias/BotonesCompartir";
import { GaleriaNoticia } from "@/components/noticias/GaleriaNoticia";
import { TarjetaNoticia } from "@/components/noticias/TarjetaNoticia";

interface Props {
  params: Promise<{ slug: string }>;
}

/** SEO por noticia: título, descripción y Open Graph con la portada. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const datos = await obtenerNoticiaPublica(slug);
  if (!datos) {
    return { title: "Noticia no encontrada — Liga de Fútsal de Ushuaia" };
  }
  const { noticia } = datos;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return {
    title: `${noticia.titulo} — Liga de Fútsal de Ushuaia`,
    description: noticia.resumen,
    openGraph: {
      title: noticia.titulo,
      description: noticia.resumen,
      type: "article",
      url: `${base}/noticias/${noticia.slug}`,
      publishedTime: noticia.publicadaAt,
      images: noticia.portadaUrl
        ? [{ url: noticia.portadaUrl, width: 1200, height: 630, alt: noticia.titulo }]
        : undefined,
    },
    twitter: {
      card: noticia.portadaUrl ? "summary_large_image" : "summary",
      title: noticia.titulo,
      description: noticia.resumen,
      images: noticia.portadaUrl ? [noticia.portadaUrl] : undefined,
    },
  };
}

function formatearFechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * DETALLE DE NOTICIA (público) — lectura premium: portada, categoría con
 * color, tiempo de lectura, vistas reales, galería con visor, video
 * (YouTube o MP4), me gusta por dispositivo y compartir en redes.
 */
export default async function DetalleNoticiaPage({ params }: Props) {
  const { slug } = await params;
  const datos = await obtenerNoticiaPublica(slug);
  if (!datos) notFound();

  const { noticia, relacionadas } = datos;
  const minutos = tiempoLecturaMin(noticia.contenido);
  const youtubeId = noticia.videoTipo === "youtube" ? extraerYoutubeId(noticia.videoUrl ?? "") : null;
  const youtubeEmbed = youtubeId ? urlEmbedYoutube(youtubeId) : null;

  return (
    <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      <RegistradorVista newsId={noticia.id} />

      {/* Volver */}
      <Link
        href="/noticias"
        id="link-volver-noticias"
        className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition inline-flex items-center gap-1 w-fit"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a Noticias
      </Link>

      {/* Encabezado */}
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          {noticia.categoria && (
            <span
              className="px-2.5 py-1 rounded-full font-bold uppercase tracking-wide text-white text-[10px]"
              style={{ backgroundColor: noticia.categoria.color }}
            >
              {noticia.categoria.nombre}
            </span>
          )}
          <span className="flex items-center gap-1 capitalize">
            <CalendarDays className="w-3.5 h-3.5" />
            {formatearFechaLarga(noticia.publicadaAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {minutos} min de lectura
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" />
            {noticia.vistas.toLocaleString("es-AR")} lecturas
          </span>
        </div>

        <h1 className="font-serif text-3xl md:text-4xl font-black text-[#1A2A44] leading-tight">
          {noticia.titulo}
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">{noticia.resumen}</p>
      </header>

      {/* Portada */}
      {noticia.portadaUrl && (
        <div className="rounded-2xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={noticia.portadaUrl} alt={noticia.titulo} className="w-full object-cover max-h-[480px]" />
        </div>
      )}

      {/* Contenido */}
      <article
        className="prose prose-slate max-w-none text-[#1A2A44] leading-relaxed
          prose-headings:font-serif prose-headings:text-[#1A2A44]
          prose-a:text-[#F97316] prose-strong:text-[#1A2A44]
          bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm"
        dangerouslySetInnerHTML={{ __html: noticia.contenido }}
      />

      {/* Galería */}
      <GaleriaNoticia fotos={noticia.galeria} titulo={noticia.titulo} />

      {/* Video */}
      {youtubeEmbed && (
        <div className="rounded-2xl overflow-hidden shadow-lg aspect-video bg-black">
          <iframe
            src={youtubeEmbed}
            title={`Video: ${noticia.titulo}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
      {noticia.videoTipo === "mp4" && noticia.videoPublicUrl && (
        <div className="rounded-2xl overflow-hidden shadow-lg bg-black">
          <video src={noticia.videoPublicUrl} controls className="w-full" preload="metadata" />
        </div>
      )}

      {/* Interacciones */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-200 pt-6">
        <BotonLike newsId={noticia.id} likesIniciales={noticia.likes} />
        <BotonesCompartir titulo={noticia.titulo} slug={noticia.slug} />
      </div>

      {/* Relacionadas */}
      {relacionadas.length > 0 && (
        <section className="flex flex-col gap-4 border-t border-slate-200 pt-8">
          <h2 className="font-serif text-xl font-black text-[#1A2A44]">También te puede interesar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {relacionadas.map((r) => (
              <TarjetaNoticia
                key={r.slug}
                noticia={{
                  id: r.slug,
                  titulo: r.titulo,
                  slug: r.slug,
                  resumen: r.resumen,
                  portadaUrl: r.portadaUrl,
                  destacada: false,
                  publicadaAt: r.publicadaAt,
                  likes: 0,
                  vistas: 0,
                  categoria: noticia.categoria,
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
