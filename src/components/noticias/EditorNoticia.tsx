"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Globe,
  CalendarClock,
  Image as ImageIcon,
  Images,
  Video,
  Play,
  Star,
  X,
  Loader2,
  Link2,
  Eye,
} from "lucide-react";
import type { CategoriaNoticiaUI, NoticiaAdminUI } from "@/lib/actions/noticias.actions";
import { guardarNoticia, subirArchivoNoticia, eliminarArchivoNoticia } from "@/lib/actions/noticias.actions";
import {
  slugify,
  esSlugValido,
  validarNoticia,
  extraerYoutubeId,
  GALERIA_MAX,
  type TipoVideoNoticia,
} from "@/lib/core/rules/noticiasRules";
import { EditorTextoEnriquecido } from "@/components/mensajeria/EditorTextoEnriquecido";

type AccionGuardado = "borrador" | "publicar" | "programar";

function aInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function desdeInputLocal(valor: string): string | null {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function Subidor({
  etiqueta,
  acepta,
  tipo,
  newsId,
  onSubido,
  deshabilitado,
  id,
}: {
  etiqueta: string;
  acepta: string;
  tipo: "imagen" | "video";
  newsId: string;
  onSubido: (path: string, url: string) => void;
  deshabilitado?: boolean;
  id: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function alElegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    const fd = new FormData();
    fd.append("archivo", archivo);
    fd.append("tipo", tipo);
    fd.append("newsId", newsId);
    const r = await subirArchivoNoticia(fd);
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!r.ok || !r.path) {
      alert(r.error ?? "No se pudo subir el archivo.");
      return;
    }
    onSubido(r.path, r.url ?? "");
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={acepta}
        className="hidden"
        onChange={alElegir}
        disabled={deshabilitado || subiendo}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={deshabilitado || subiendo}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition disabled:opacity-50"
      >
        {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        {subiendo ? "Subiendo…" : etiqueta}
      </button>
    </div>
  );
}

export function EditorNoticia({
  categorias,
  noticia,
}: {
  categorias: CategoriaNoticiaUI[];
  noticia?: NoticiaAdminUI;
}) {
  const router = useRouter();
  const editando = Boolean(noticia);

  // --- Estado del formulario ---
  const [titulo, setTitulo] = useState(noticia?.titulo ?? "");
  const [slugManual, setSlugManual] = useState<string | null>(noticia ? noticia.slug : null);
  const [resumen, setResumen] = useState(noticia?.resumen ?? "");
  const [contenido, setContenido] = useState(noticia?.contenido ?? "");
  const [categoriaId, setCategoriaId] = useState(noticia?.categoriaId ?? "");
  const [portada, setPortada] = useState<{ path: string; url: string } | null>(
    noticia?.portadaPath ? { path: noticia.portadaPath, url: noticia.portadaUrl ?? "" } : null
  );
  const [galeria, setGaleria] = useState<Array<{ path: string; url: string }>>(noticia?.galeria ?? []);
  const [videoTipo, setVideoTipo] = useState<TipoVideoNoticia | "ninguno">(noticia?.videoTipo ?? "ninguno");
  const [videoUrl, setVideoUrl] = useState(noticia?.videoUrl ?? "");
  const [videoMp4, setVideoMp4] = useState<{ path: string; url: string } | null>(
    noticia?.videoPath ? { path: noticia.videoPath, url: noticia.videoPublicUrl ?? "" } : null
  );
  const [destacada, setDestacada] = useState(noticia?.destacada ?? false);
  const [accion, setAccion] = useState<AccionGuardado>(
    noticia?.estado === "programada" ? "programar" : "borrador"
  );
  const [publicarAt, setPublicarAt] = useState(aInputLocal(noticia?.publicarAt ?? null));
  const [venceAt, setVenceAt] = useState(aInputLocal(noticia?.venceAt ?? null));
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});

  const slug = useMemo(() => {
    if (slugManual !== null) return slugManual;
    return slugify(titulo);
  }, [slugManual, titulo]);

  const youtubeId = useMemo(() => extraerYoutubeId(videoUrl), [videoUrl]);
  const newsIdParaArchivos = noticia?.id ?? "sin-asignar";

  async function quitarPortada() {
    if (portada) await eliminarArchivoNoticia(portada.path);
    setPortada(null);
  }

  async function quitarFotoGaleria(path: string) {
    await eliminarArchivoNoticia(path);
    setGaleria((g) => g.filter((f) => f.path !== path));
  }

  async function quitarVideo() {
    if (videoMp4) await eliminarArchivoNoticia(videoMp4.path);
    setVideoMp4(null);
    setVideoUrl("");
  }

  async function guardar() {
    if (guardando) return;

    const input = {
      id: noticia?.id,
      titulo,
      slug: slug || undefined,
      resumen,
      contenido,
      categoriaId: categoriaId || null,
      portadaPath: portada?.path ?? null,
      galeria: galeria.map((g) => g.path),
      videoTipo: videoTipo === "ninguno" ? null : videoTipo,
      videoUrl: videoTipo === "youtube" ? videoUrl : null,
      videoPath: videoTipo === "mp4" ? videoMp4?.path ?? null : null,
      destacada,
      accion,
      publicarAt: accion === "programar" ? desdeInputLocal(publicarAt) : null,
      venceAt: desdeInputLocal(venceAt),
    };

    // Validación de negocio (la misma regla valida otra vez en el servidor)
    const errs = validarNoticia({
      titulo: input.titulo,
      slug: input.slug,
      resumen: input.resumen,
      contenido: input.contenido,
      galeria: input.galeria,
      videoTipo: input.videoTipo,
      videoUrl: input.videoUrl,
      videoPath: input.videoPath,
      estado: accion === "publicar" ? "publicada" : accion === "programar" ? "programada" : "borrador",
      publicarAt: input.publicarAt,
      venceAt: input.venceAt,
    });
    setErrores(errs);
    if (Object.keys(errs).length > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setGuardando(true);
    const r = await guardarNoticia(input);
    setGuardando(false);
    if (!r.ok) {
      setErrores({ general: r.error ?? "No se pudo guardar." });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push("/admin/noticias");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/noticias"
            className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a Noticias
          </Link>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">
            {editando ? "Editar noticia" : "Nueva noticia"}
          </h2>
        </div>
      </div>

      {errores.general && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-rose-700 text-sm font-semibold">
          {errores.general}
        </div>
      )}

      {/* Título + slug */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div>
          <label htmlFor="input-noticia-titulo" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Título <span className="text-rose-500">*</span>
          </label>
          <input
            id="input-noticia-titulo"
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ej.: Comienza la Copa de Campeones LFS 2026"
            maxLength={140}
            className="w-full px-4 py-3 rounded-xl border border-slate-300 font-serif text-lg font-bold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
          />
          {errores.titulo && <p className="text-xs text-rose-600 font-semibold mt-1">{errores.titulo}</p>}
        </div>

        <div>
          <label htmlFor="input-noticia-slug" className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> URL amigable (SEO)
          </label>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <span className="text-xs text-slate-400 shrink-0">/noticias/</span>
            <input
              id="input-noticia-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlugManual(e.target.value.toLowerCase())}
              className="flex-1 bg-transparent text-sm text-[#1A2A44] focus:outline-none"
            />
            {slugManual !== null && (
              <button
                type="button"
                onClick={() => setSlugManual(null)}
                className="text-[10px] font-bold text-slate-400 hover:text-[#F97316] transition shrink-0"
              >
                AUTOMÁTICA
              </button>
            )}
          </div>
          {slug && !esSlugValido(slug) && (
            <p className="text-xs text-rose-600 font-semibold mt-1">
              La URL solo puede tener letras minúsculas, números y guiones.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="input-noticia-resumen" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Resumen <span className="text-rose-500">*</span>{" "}
            <span className="text-slate-400 normal-case font-medium">(aparece en las tarjetas y al compartir)</span>
          </label>
          <textarea
            id="input-noticia-resumen"
            value={resumen}
            onChange={(e) => setResumen(e.target.value)}
            rows={2}
            maxLength={280}
            placeholder="Un adelanto breve y atractivo de la noticia…"
            className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316] resize-none"
          />
          <div className="flex justify-between mt-1">
            {errores.resumen ? (
              <p className="text-xs text-rose-600 font-semibold">{errores.resumen}</p>
            ) : (
              <span />
            )}
            <span className={`text-[10px] font-bold ${resumen.length > 260 ? "text-rose-500" : "text-slate-400"}`}>
              {resumen.length}/280
            </span>
          </div>
        </div>
      </section>

      {/* Contenido */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">
          Contenido <span className="text-rose-500">*</span>
        </span>
        <EditorTextoEnriquecido
          valorInicial={noticia?.contenido ?? ""}
          onChange={setContenido}
          placeholder="Escribí la noticia completa…"
          alturaMinima={320}
        />
        {errores.contenido && <p className="text-xs text-rose-600 font-semibold mt-2">{errores.contenido}</p>}
      </section>

      {/* Multimedia */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-5">
        <h3 className="font-serif font-bold text-[#1A2A44] flex items-center gap-2">
          <Images className="w-4 h-4 text-[#F97316]" /> Multimedia
        </h3>

        {/* Portada */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">
            Imagen de portada <span className="text-slate-400 normal-case font-medium">(si no ponés, usamos el logo LFS)</span>
          </span>
          {portada ? (
            <div className="relative w-full max-w-md h-44 rounded-xl overflow-hidden bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={portada.url} alt="Portada" className="w-full h-full object-cover" />
              <button
                type="button"
                id="btn-quitar-portada"
                onClick={quitarPortada}
                className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition"
                title="Quitar portada"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Subidor
              id="input-portada"
              etiqueta="Subir portada (JPG, PNG, WebP)"
              acepta="image/jpeg,image/png,image/webp"
              tipo="imagen"
              newsId={newsIdParaArchivos}
              onSubido={(path, url) => setPortada({ path, url })}
            />
          )}
        </div>

        {/* Galería */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">
            Galería de fotos{" "}
            <span className="text-slate-400 normal-case font-medium">
              ({galeria.length}/{GALERIA_MAX})
            </span>
          </span>
          <div className="flex flex-wrap gap-3 items-start">
            {galeria.map((foto) => (
              <div key={foto.path} className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={foto.url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  id={`btn-quitar-foto-${foto.path.slice(-8)}`}
                  onClick={() => quitarFotoGaleria(foto.path)}
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-black/80 text-white rounded-md transition"
                  title="Quitar"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {galeria.length < GALERIA_MAX && (
              <Subidor
                id="input-galeria"
                etiqueta="+ Agregar foto"
                acepta="image/jpeg,image/png,image/webp"
                tipo="imagen"
                newsId={newsIdParaArchivos}
                onSubido={(path, url) => setGaleria((g) => [...g, { path, url }])}
              />
            )}
          </div>
          {errores.galeria && <p className="text-xs text-rose-600 font-semibold mt-2">{errores.galeria}</p>}
        </div>

        {/* Video */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">
            Video <span className="text-slate-400 normal-case font-medium">(opcional, uno solo)</span>
          </span>
          <div className="flex gap-2 flex-wrap mb-3">
            {(
              [
                { id: "ninguno", nombre: "Sin video", icono: X },
                { id: "youtube", nombre: "YouTube", icono: Play },
                { id: "mp4", nombre: "Archivo MP4", icono: Video },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                id={`btn-video-${op.id}`}
                onClick={() => {
                  setVideoTipo(op.id);
                  if (op.id === "ninguno") quitarVideo();
                }}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition ${
                  videoTipo === op.id
                    ? "bg-[#1A2A44] text-white shadow"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <op.icono className="w-3.5 h-3.5" />
                {op.nombre}
              </button>
            ))}
          </div>

          {videoTipo === "youtube" && (
            <div className="flex flex-col gap-2">
              <input
                id="input-video-youtube"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
              />
              {videoUrl && youtubeId && (
                <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
                    alt="Vista previa del video"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <Play className="w-10 h-10 text-white drop-shadow-lg" />
                  </span>
                </div>
              )}
              {errores.video && <p className="text-xs text-rose-600 font-semibold">{errores.video}</p>}
            </div>
          )}

          {videoTipo === "mp4" && (
            <div>
              {videoMp4 ? (
                <div className="relative w-full max-w-md rounded-xl overflow-hidden bg-black">
                  <video src={videoMp4.url} controls className="w-full" />
                  <button
                    type="button"
                    id="btn-quitar-video"
                    onClick={quitarVideo}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition"
                    title="Quitar video"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Subidor
                  id="input-video-mp4"
                  etiqueta="Subir video MP4 (máx. 100 MB)"
                  acepta="video/mp4"
                  tipo="video"
                  newsId={newsIdParaArchivos}
                  onSubido={(path, url) => setVideoMp4({ path, url })}
                />
              )}
            </div>
          )}
        </div>
      </section>

      {/* Configuración de publicación */}
      <section className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-5">
        <h3 className="font-serif font-bold text-[#1A2A44] flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#F97316]" /> Publicación
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="select-categoria" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Categoría
            </label>
            <select
              id="select-categoria"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316] bg-white"
            >
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                id="check-destacada"
                type="checkbox"
                checked={destacada}
                onChange={(e) => setDestacada(e.target.checked)}
                className="w-4 h-4 rounded accent-[#F97316]"
              />
              <span className="text-sm font-semibold text-[#1A2A44] flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500" />
                Noticia destacada <span className="text-slate-400 font-normal text-xs">(solo una; aparece primera y más grande)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Acción */}
        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-2">¿Qué hacemos al guardar?</span>
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { id: "borrador", nombre: "Guardar borrador", icono: Save },
                { id: "publicar", nombre: "Publicar ahora", icono: Globe },
                { id: "programar", nombre: "Programar", icono: CalendarClock },
              ] as const
            ).map((op) => (
              <button
                key={op.id}
                type="button"
                id={`btn-accion-${op.id}`}
                onClick={() => setAccion(op.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition ${
                  accion === op.id
                    ? "bg-[#F97316] text-white shadow-lg shadow-orange-500/25"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                <op.icono className="w-4 h-4" />
                {op.nombre}
              </button>
            ))}
          </div>
        </div>

        {accion === "programar" && (
          <div>
            <label htmlFor="input-publicar-at" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
              Fecha y hora de publicación <span className="text-rose-500">*</span>
            </label>
            <input
              id="input-publicar-at"
              type="datetime-local"
              value={publicarAt}
              onChange={(e) => setPublicarAt(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
            />
            {errores.publicarAt && <p className="text-xs text-rose-600 font-semibold mt-1">{errores.publicarAt}</p>}
          </div>
        )}

        <div>
          <label htmlFor="input-vence-at" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Vencimiento <span className="text-slate-400 normal-case font-medium">(opcional: se archiva sola en esa fecha)</span>
          </label>
          <input
            id="input-vence-at"
            type="datetime-local"
            value={venceAt}
            onChange={(e) => setVenceAt(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
          />
          {errores.venceAt && <p className="text-xs text-rose-600 font-semibold mt-1">{errores.venceAt}</p>}
        </div>
      </section>

      {/* Botonera final */}
      <div className="sticky bottom-4 flex flex-col sm:flex-row gap-3 bg-white/90 backdrop-blur border border-slate-200 rounded-2xl p-4 shadow-xl">
        <button
          type="button"
          id="btn-guardar-noticia"
          onClick={guardar}
          disabled={guardando}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-orange-500/25 disabled:opacity-50"
        >
          {guardando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {guardando
            ? "Guardando…"
            : accion === "publicar"
              ? "Publicar noticia"
              : accion === "programar"
                ? "Programar publicación"
                : "Guardar borrador"}
        </button>
        {editando && noticia?.estado === "publicada" && (
          <Link
            href={`/noticias/${noticia.slug}`}
            target="_blank"
            id="btn-ver-publicada"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
          >
            <Eye className="w-5 h-5" />
            Ver publicada
          </Link>
        )}
        <Link
          href="/admin/noticias"
          id="btn-cancelar-noticia"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
        >
          Cancelar
        </Link>
      </div>
    </div>
  );
}
