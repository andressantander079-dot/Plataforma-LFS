"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Paperclip,
  Check,
  CheckCheck,
  FileText,
  X,
  ArrowLeft,
  MessageSquare,
  Loader2,
  Megaphone,
  Lock,
  Search,
  ChevronUp,
} from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import {
  enviarMensaje,
  marcarLeidos,
  obtenerUrlAdjunto,
  buscarMensajes,
} from "@/lib/actions/mensajeria.actions";
import {
  leerMetadata,
  esComunicado,
  bloqueaRespuestas,
  textoPlanoDeHtml,
} from "@/lib/core/rules/mensajeriaRules";

/**
 * VENTANA DE CHAT — Mensajería premium LFS
 * Tiempo real (Supabase Realtime), doble tilde de lectura, adjuntos,
 * buscador dentro de la conversación y tarjetas de Comunicado Oficial.
 * Si el último mensaje es un comunicado "sin respuestas", el canal queda
 * en solo lectura para el club/árbitro (la federación siempre puede).
 */

export interface Mensaje {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  read_at: string | null;
  created_at: string;
  metadata: unknown;
}

interface VentanaChatProps {
  conversacionId: string;
  mensajesIniciales: Mensaje[];
  usuarioActualId: string;
  titulo: string;
  subtitulo: string;
  iniciales: string;
  esAdmin?: boolean;
  onVolver?: () => void; // solo se usa en móvil (panel admin)
}

function horaCorta(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function fechaCompleta(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function etiquetaFecha(iso: string) {
  const fecha = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const misma = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (misma(fecha, hoy)) return "Hoy";
  if (misma(fecha, ayer)) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(fecha);
}

/** Adjunto: imagen en miniatura o chip descargable (PDF). */
function AdjuntoMensaje({
  ruta,
  nombre,
  tipo,
  esMio,
}: {
  ruta: string;
  nombre: string;
  tipo: string | null;
  esMio: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerUrlAdjunto(ruta).then((res) => {
      if (activo && "url" in res && res.url) setUrl(res.url);
    });
    return () => {
      activo = false;
    };
  }, [ruta]);

  if (tipo?.startsWith("image/")) {
    return url ? (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={nombre}
          className="rounded-xl max-w-[240px] max-h-[240px] object-cover border border-black/10"
        />
      </a>
    ) : (
      <div className="w-[240px] h-[140px] rounded-xl bg-slate-300/40 animate-pulse" />
    );
  }

  return (
    <button
      type="button"
      onClick={() => url && window.open(url, "_blank")}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
        esMio
          ? "bg-white/10 text-white hover:bg-white/20"
          : "bg-slate-100 text-[#1A2A44] hover:bg-slate-200"
      }`}
    >
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate max-w-[180px]">{nombre}</span>
    </button>
  );
}

/** Tarjeta destacada de Comunicado Oficial dentro del chat. */
function TarjetaComunicado({ mensaje, esMio }: { mensaje: Mensaje; esMio: boolean }) {
  const meta = leerMetadata(mensaje.metadata);
  return (
    <div className="w-full max-w-[92%] sm:max-w-[80%]">
      <div className="rounded-2xl overflow-hidden border border-orange-200 shadow-md bg-white">
        {/* Franja oficial */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#1A2A44] to-[#2A3D5F] text-white">
          <Megaphone className="w-4 h-4 text-[#F97316] shrink-0" />
          <span className="text-[10px] font-black uppercase tracking-[0.14em]">
            Comunicado Oficial
          </span>
          {meta.sin_respuestas && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-orange-200 shrink-0">
              <Lock className="w-3 h-3" /> Sin respuestas
            </span>
          )}
        </div>
        <div className="px-4 py-3 flex flex-col gap-2">
          <h3 className="font-serif text-base font-black text-[#1A2A44] leading-snug">
            {meta.asunto}
          </h3>
          {mensaje.body && (
            <div
              className="prose-lfs text-sm text-slate-700 leading-relaxed"
              // El HTML ya viene sanitizado del servidor (sanitizarHtml)
              dangerouslySetInnerHTML={{ __html: mensaje.body }}
            />
          )}
          {mensaje.attachment_path && mensaje.attachment_name && (
            <AdjuntoMensaje
              ruta={mensaje.attachment_path}
              nombre={mensaje.attachment_name}
              tipo={mensaje.attachment_type}
              esMio={false}
            />
          )}
          <div className="flex items-center justify-end gap-1 text-slate-400">
            <span className="text-[10px]">{fechaCompleta(mensaje.created_at)}</span>
            {esMio &&
              (mensaje.read_at ? (
                <CheckCheck className="w-3.5 h-3.5 text-[#F97316]" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VentanaChat({
  conversacionId,
  mensajesIniciales,
  usuarioActualId,
  titulo,
  subtitulo,
  iniciales,
  esAdmin = false,
  onVolver,
}: VentanaChatProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>(mensajesIniciales);
  const [texto, setTexto] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [buscadorAbierto, setBuscadorAbierto] = useState(false);
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [resultados, setResultados] = useState<Mensaje[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [resaltadoId, setResaltadoId] = useState<string | null>(null);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  // Solo lectura: último mensaje = comunicado sin respuestas (admin excepto)
  const ultimoMensaje = mensajes[mensajes.length - 1];
  const soloLectura =
    !esAdmin && !!ultimoMensaje && bloqueaRespuestas(ultimoMensaje.metadata);

  const irAlFinal = useCallback((suave = true) => {
    const el = contenedorRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: suave ? "smooth" : "auto" });
  }, []);

  // Marcar como leído al abrir la conversación
  useEffect(() => {
    marcarLeidos(conversacionId);
    irAlFinal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversacionId]);

  // Suscripción en tiempo real: mensajes nuevos y lecturas (doble tilde)
  useEffect(() => {
    const supabase = createLfsClient();
    const canal = supabase
      .channel(`chat-${conversacionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversacionId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          setMensajes((prev) =>
            prev.some((m) => m.id === nuevo.id) ? prev : [...prev, nuevo]
          );
          if (nuevo.sender_id !== usuarioActualId) {
            marcarLeidos(conversacionId); // lo estoy viendo → doble tilde al otro
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversacionId}`,
        },
        (payload) => {
          const actualizado = payload.new as Mensaje;
          setMensajes((prev) =>
            prev.map((m) => (m.id === actualizado.id ? actualizado : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [conversacionId, usuarioActualId]);

  useEffect(() => {
    if (!resaltadoId) irAlFinal();
  }, [mensajes, irAlFinal, resaltadoId]);

  // Búsqueda (con pequeño debounce)
  useEffect(() => {
    const termino = terminoBusqueda.trim();
    if (termino.length < 2) {
      setResultados(null);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(async () => {
      try {
        const encontrados = await buscarMensajes(conversacionId, termino);
        setResultados(encontrados as Mensaje[]);
      } catch {
        setResultados([]);
      } finally {
        setBuscando(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [terminoBusqueda, conversacionId]);

  function saltarAMensaje(id: string) {
    const existe = mensajes.some((m) => m.id === id);
    if (!existe) {
      setErrorEnvio("Ese mensaje es anterior al historial cargado en pantalla.");
      setTimeout(() => setErrorEnvio(null), 4000);
      return;
    }
    setResaltadoId(id);
    setBuscadorAbierto(false);
    setResultados(null);
    setTerminoBusqueda("");
    requestAnimationFrame(() => {
      document
        .getElementById(`mensaje-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    setTimeout(() => setResaltadoId(null), 2200);
  }

  async function manejarEnvio() {
    if (enviando || soloLectura) return;
    const cuerpo = texto.trim();
    if (!cuerpo && !archivo) return;

    setEnviando(true);
    setErrorEnvio(null);

    const formData = new FormData();
    formData.set("conversacionId", conversacionId);
    formData.set("body", cuerpo);
    if (archivo) formData.set("archivo", archivo);

    const resultado = await enviarMensaje(formData);

    if ("error" in resultado && resultado.error) {
      setErrorEnvio(resultado.error);
    } else if ("mensaje" in resultado && resultado.mensaje) {
      const enviado = resultado.mensaje as Mensaje;
      setMensajes((prev) =>
        prev.some((m) => m.id === enviado.id) ? prev : [...prev, enviado]
      );
      setTexto("");
      setArchivo(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
    }
    setEnviando(false);
  }

  const hayComunicados = useMemo(
    () => mensajes.some((m) => esComunicado(m.metadata)),
    [mensajes]
  );

  // Agrupar mensajes por día para los separadores
  let ultimaEtiqueta = "";

  return (
    <div className="flex flex-col h-full bg-[#F4F6FA]">
      {/* Encabezado del chat */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#1A2A44] to-[#24344F] text-white shrink-0 shadow-md z-10">
        {onVolver && (
          <button
            type="button"
            onClick={onVolver}
            className="md:hidden p-1.5 -ml-1 text-slate-300 hover:text-white"
            aria-label="Volver a la lista"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="w-10 h-10 rounded-full bg-white/10 ring-2 ring-[#F97316]/70 text-white flex items-center justify-center font-bold text-sm shrink-0">
          {iniciales}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif font-bold truncate leading-tight">{titulo}</h2>
          <p className="text-[11px] text-slate-300 truncate">{subtitulo}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setBuscadorAbierto((v) => !v);
            setResultados(null);
            setTerminoBusqueda("");
          }}
          className={`p-2 rounded-xl transition shrink-0 ${
            buscadorAbierto ? "bg-[#F97316] text-white" : "text-slate-300 hover:text-white hover:bg-white/10"
          }`}
          aria-label="Buscar en la conversación"
        >
          <Search className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </button>
      </div>

      {/* Buscador dentro de la conversación */}
      {buscadorAbierto && (
        <div className="bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 z-10">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={terminoBusqueda}
              onChange={(e) => setTerminoBusqueda(e.target.value)}
              placeholder="Buscar en esta conversación…"
              className="w-full rounded-xl border border-slate-300 pl-9 pr-9 py-2 text-sm text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
            />
            {buscando && (
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>
          {resultados && (
            <div className="mt-2 max-h-52 overflow-y-auto flex flex-col divide-y divide-slate-100">
              {resultados.length === 0 && (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No se encontraron mensajes con “{terminoBusqueda.trim()}”.
                </p>
              )}
              {resultados.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => saltarAMensaje(m.id)}
                  className="flex items-start gap-2 py-2 text-left hover:bg-slate-50 rounded-lg px-2 transition"
                >
                  <ChevronUp className="w-3.5 h-3.5 text-[#F97316] mt-0.5 shrink-0 rotate-45" />
                  <div className="min-w-0">
                    <p className="text-xs text-[#1A2A44] truncate">
                      {m.body ? textoPlanoDeHtml(m.body, 90) : `📎 ${m.attachment_name ?? "Adjunto"}`}
                    </p>
                    <p className="text-[10px] text-slate-400">{fechaCompleta(m.created_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensajes */}
      <div
        ref={contenedorRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 flex flex-col gap-2"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(26,42,68,0.05) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      >
        {mensajes.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 text-slate-400 py-10">
            <div className="w-14 h-14 rounded-full bg-slate-200/70 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-[#1A2A44]">Todavía no hay mensajes</p>
            <p className="text-xs max-w-xs">
              Escribí el primero para iniciar la conversación. Los mensajes llegan en tiempo real.
            </p>
          </div>
        )}

        {hayComunicados && mensajes.length > 0 && (
          <p className="text-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">
            Historial de la conversación
          </p>
        )}

        {mensajes.map((mensaje) => {
          const esMio = mensaje.sender_id === usuarioActualId;
          const etiqueta = etiquetaFecha(mensaje.created_at);
          const mostrarSeparador = etiqueta !== ultimaEtiqueta;
          ultimaEtiqueta = etiqueta;
          const meta = leerMetadata(mensaje.metadata);
          const comunicado = meta.tipo === "comunicado";

          return (
            <div key={mensaje.id} className="contents">
              {mostrarSeparador && (
                <div className="flex justify-center my-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/90 shadow-sm border border-slate-200/80 rounded-full px-3 py-1">
                    {etiqueta}
                  </span>
                </div>
              )}

              <div
                id={`mensaje-${mensaje.id}`}
                className={`flex ${esMio ? "justify-end" : "justify-start"} ${
                  resaltadoId === mensaje.id
                    ? "rounded-2xl ring-2 ring-[#F97316] ring-offset-2 ring-offset-[#F4F6FA] transition"
                    : ""
                }`}
              >
                {comunicado ? (
                  <TarjetaComunicado mensaje={mensaje} esMio={esMio} />
                ) : (
                  <div
                    className={`max-w-[78%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm flex flex-col gap-1.5 ${
                      esMio
                        ? "bg-gradient-to-br from-[#1A2A44] to-[#22334E] text-white rounded-br-md"
                        : "bg-white text-[#1A2A44] border border-slate-200 rounded-bl-md"
                    }`}
                  >
                    {mensaje.attachment_path && mensaje.attachment_name && (
                      <AdjuntoMensaje
                        ruta={mensaje.attachment_path}
                        nombre={mensaje.attachment_name}
                        tipo={mensaje.attachment_type}
                        esMio={esMio}
                      />
                    )}
                    {mensaje.body &&
                      (meta.html ? (
                        <div
                          className={`prose-lfs text-sm leading-snug ${esMio ? "prose-lfs-inverso" : ""}`}
                          dangerouslySetInnerHTML={{ __html: mensaje.body }}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words leading-snug">
                          {mensaje.body}
                        </p>
                      ))}
                    <div
                      className={`flex items-center gap-1 self-end -mb-0.5 ${
                        esMio ? "text-slate-300" : "text-slate-400"
                      }`}
                    >
                      <span className="text-[10px]">{horaCorta(mensaje.created_at)}</span>
                      {esMio &&
                        (mensaje.read_at ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#F97316]" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Vista previa del adjunto seleccionado */}
      {archivo && !soloLectura && (
        <div className="px-4 pt-2 bg-white border-t border-slate-200">
          <div className="inline-flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44]">
            <FileText className="w-4 h-4 text-[#F97316]" />
            <span className="truncate max-w-[220px]">{archivo.name}</span>
            <button
              type="button"
              onClick={() => {
                setArchivo(null);
                if (inputArchivoRef.current) inputArchivoRef.current.value = "";
              }}
              className="text-slate-400 hover:text-red-500"
              aria-label="Quitar adjunto"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error de envío */}
      {errorEnvio && (
        <div className="px-4 pt-2 bg-white">
          <p className="text-xs font-semibold text-red-600">{errorEnvio}</p>
        </div>
      )}

      {/* Caja de escritura o aviso de solo lectura */}
      {soloLectura ? (
        <div className="px-4 py-3.5 bg-[#1A2A44] shrink-0">
          <div className="flex items-center justify-center gap-2 text-slate-300">
            <Lock className="w-4 h-4 text-[#F97316]" />
            <p className="text-xs font-semibold">
              Comunicado oficial de solo lectura — la federación te va a responder por este medio.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="px-3 sm:px-4 py-3 bg-white border-t border-slate-200 shrink-0"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-end gap-2">
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputArchivoRef.current?.click()}
              className="p-2.5 rounded-xl text-slate-500 hover:text-[#F97316] hover:bg-orange-50 transition"
              aria-label="Adjuntar archivo"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  manejarEnvio();
                }
              }}
              placeholder="Escribí un mensaje…"
              rows={1}
              className="flex-1 resize-none rounded-2xl border border-slate-300 px-4 py-2.5 text-sm text-[#1A2A44] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316] bg-slate-50/60"
            />
            <button
              type="button"
              onClick={manejarEnvio}
              disabled={enviando || (!texto.trim() && !archivo)}
              className="p-2.5 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-orange-500/25"
              aria-label="Enviar mensaje"
            >
              {enviando ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="hidden sm:block text-[10px] text-slate-400 mt-1.5 px-1">
            Enter para enviar · Shift + Enter para salto de línea · Fotos o PDF hasta 10 MB
          </p>
        </div>
      )}
    </div>
  );
}
