"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, MessageSquare, Users, Flag, Megaphone, PenSquare } from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import {
  obtenerPanelMensajeriaAdmin,
  obtenerOCrearConversacion,
  obtenerOCrearConversacionArbitro,
  obtenerMensajes,
  type ConversacionResumen,
} from "@/lib/actions/mensajeria.actions";
import { VentanaChat, type Mensaje } from "./VentanaChat";
import { PanelRedactarComunicado } from "./PanelRedactarComunicado";
import { PanelComunicadosAdmin } from "./PanelComunicadosAdmin";

/**
 * PANEL DE MENSAJERÍA DEL ADMIN (federación)
 * Híbrido premium: lista estilo mail (clubes y árbitros, con no leídos en
 * negrita) + chat con burbujas. Pestañas: Conversaciones / Comunicados.
 * Botón "Redactar": comunicado oficial a uno, varios o todos.
 * En móvil: lista ↔ chat con botón volver. Todo en tiempo real.
 */

interface MensajeriaAdminProps {
  conversacionesIniciales: ConversacionResumen[];
  usuarioActualId: string;
}

type Pestaña = "conversaciones" | "comunicados";

function horaLista(iso: string | null) {
  if (!iso) return "";
  const fecha = new Date(iso);
  const hoy = new Date();
  if (fecha.toDateString() === hoy.toDateString()) {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(fecha);
  }
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(fecha);
}

function inicialesDe(nombre: string) {
  return (
    nombre
      .split(" ")
      .filter((p) => p.length > 2)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || nombre.slice(0, 2).toUpperCase()
  );
}

/** Paleta estable por nombre (avatar con identidad propia). */
function colorAvatar(nombre: string) {
  const paletas = [
    "bg-[#1A2A44]",
    "bg-[#0F766E]",
    "bg-[#7C2D12]",
    "bg-[#4C1D95]",
    "bg-[#9D174D]",
    "bg-[#1E40AF]",
  ];
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) | 0;
  return paletas[Math.abs(hash) % paletas.length];
}

export function MensajeriaAdmin({
  conversacionesIniciales,
  usuarioActualId,
}: MensajeriaAdminProps) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [pestaña, setPestaña] = useState<Pestaña>("conversaciones");
  const [seleccionada, setSeleccionada] = useState<ConversacionResumen | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargandoChat, setCargandoChat] = useState(false);
  const [redactando, setRedactando] = useState(false);
  const [refrescoComunicados, setRefrescoComunicados] = useState(0);

  const refrescarLista = useCallback(async () => {
    const frescas = await obtenerPanelMensajeriaAdmin();
    setConversaciones(frescas);
    setSeleccionada((sel) =>
      sel ? (frescas.find((c) => c.destinoId === sel.destinoId && c.tipoDestino === sel.tipoDestino) ?? sel) : sel
    );
  }, []);

  // Tiempo real: cualquier mensaje nuevo actualiza la lista (preview + contador)
  useEffect(() => {
    const supabase = createLfsClient();
    const canal = supabase
      .channel("lista-conversaciones-admin")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        refrescarLista();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        refrescarLista();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [refrescarLista]);

  async function abrirConversacion(item: ConversacionResumen) {
    setRedactando(false);
    setSeleccionada(item);
    setCargandoChat(true);
    try {
      // Si todavía no tiene chat, se crea acá mismo
      const conv =
        item.tipoDestino === "club"
          ? await obtenerOCrearConversacion(item.destinoId)
          : await obtenerOCrearConversacionArbitro(item.destinoId);
      const historial = await obtenerMensajes(conv.id);
      setConversacionId(conv.id);
      setMensajes(historial as Mensaje[]);
    } finally {
      setCargandoChat(false);
    }
  }

  const filtradas = useMemo(
    () =>
      conversaciones.filter((c) =>
        c.nombre.toLowerCase().includes(busqueda.toLowerCase())
      ),
    [conversaciones, busqueda]
  );

  const clubesFiltrados = filtradas.filter((c) => c.tipoDestino === "club");
  const arbitrosFiltrados = filtradas.filter((c) => c.tipoDestino === "arbitro");
  const totalNoLeidos = conversaciones.reduce((acc, c) => acc + c.noLeidos, 0);

  function FilaContacto({ item }: { item: ConversacionResumen }) {
    const activo =
      seleccionada?.destinoId === item.destinoId &&
      seleccionada?.tipoDestino === item.tipoDestino;
    const hayNoLeidos = item.noLeidos > 0;
    return (
      <button
        type="button"
        onClick={() => abrirConversacion(item)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 transition hover:bg-orange-50/40 ${
          activo ? "bg-orange-50/70 border-l-4 border-l-[#F97316]" : "border-l-4 border-l-transparent"
        }`}
      >
        <div
          className={`w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${colorAvatar(
            item.nombre
          )}`}
        >
          {inicialesDe(item.nombre)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-sm truncate ${
                hayNoLeidos ? "font-black text-[#1A2A44]" : "font-semibold text-[#1A2A44]"
              }`}
            >
              {item.nombre}
            </span>
            <span
              className={`text-[10px] shrink-0 ${
                hayNoLeidos ? "font-bold text-[#EA580C]" : "text-slate-400"
              }`}
            >
              {horaLista(item.ultimoMensajeFecha)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={`text-xs truncate ${
                hayNoLeidos ? "font-semibold text-[#1A2A44]" : "text-slate-500"
              }`}
            >
              {item.ultimoMensaje ?? "Iniciar conversación…"}
            </span>
            {hayNoLeidos && (
              <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center shadow-sm">
                {item.noLeidos}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  }

  function SeccionLista({
    titulo,
    icono,
    items,
  }: {
    titulo: string;
    icono: React.ReactNode;
    items: ConversacionResumen[];
  }) {
    if (!items.length) return null;
    return (
      <div>
        <p className="flex items-center gap-1.5 px-4 pt-3 pb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400 bg-slate-50/80">
          {icono} {titulo}
        </p>
        {items.map((item) => (
          <FilaContacto key={`${item.tipoDestino}-${item.destinoId}`} item={item} />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-7rem)] flex flex-col">
      {/* Barra superior: pestañas + redactar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-200 bg-slate-50/60 shrink-0">
        <div className="flex bg-white rounded-xl border border-slate-200 p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setPestaña("conversaciones")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              pestaña === "conversaciones"
                ? "bg-[#1A2A44] text-white shadow"
                : "text-slate-500 hover:text-[#1A2A44]"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Conversaciones
            {totalNoLeidos > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#F97316] text-white text-[10px] font-bold flex items-center justify-center">
                {totalNoLeidos}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setPestaña("comunicados");
              setRedactando(false);
              setSeleccionada(null);
            }}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              pestaña === "comunicados"
                ? "bg-[#1A2A44] text-white shadow"
                : "text-slate-500 hover:text-[#1A2A44]"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            Comunicados
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setPestaña("conversaciones");
            setRedactando(true);
            setSeleccionada(null);
          }}
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-xs font-black px-3.5 py-2 shadow-md shadow-orange-500/25 hover:brightness-105 transition"
        >
          <PenSquare className="w-4 h-4" />
          <span className="hidden sm:inline">Redactar comunicado</span>
          <span className="sm:hidden">Redactar</span>
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Lista de conversaciones */}
        <aside
          className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex-col shrink-0 ${
            seleccionada || redactando || pestaña === "comunicados" ? "hidden md:flex" : "flex"
          }`}
        >
          <div className="p-3 border-b border-slate-200">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar club o árbitro…"
                className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filtradas.length === 0 && (
              <div className="flex flex-col items-center gap-2 text-slate-400 text-sm py-12 px-4 text-center">
                <Users className="w-6 h-6" />
                {busqueda
                  ? "Nadie coincide con la búsqueda."
                  : "Todavía no hay clubes ni árbitros registrados."}
              </div>
            )}

            <SeccionLista
              titulo={`Clubes (${clubesFiltrados.length})`}
              icono={<Users className="w-3 h-3" />}
              items={clubesFiltrados}
            />
            <SeccionLista
              titulo={`Árbitros (${arbitrosFiltrados.length})`}
              icono={<Flag className="w-3 h-3" />}
              items={arbitrosFiltrados}
            />
          </div>
        </aside>

        {/* Zona derecha: chat / compositor / comunicados */}
        <section
          className={`flex-1 min-w-0 ${
            seleccionada || redactando || pestaña === "comunicados" ? "flex" : "hidden md:flex"
          } flex-col`}
        >
          {pestaña === "comunicados" && !redactando && (
            <PanelComunicadosAdmin refresco={refrescoComunicados} />
          )}

          {pestaña === "conversaciones" && redactando && (
            <PanelRedactarComunicado
              destinatarios={conversaciones}
              onCerrar={() => setRedactando(false)}
              onEnviado={() => {
                setRedactando(false);
                setRefrescoComunicados((n) => n + 1);
                refrescarLista();
              }}
            />
          )}

          {pestaña === "conversaciones" && !redactando && !seleccionada && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-[#F4F6FA] p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-slate-200 flex items-center justify-center">
                <MessageSquare className="w-7 h-7" />
              </div>
              <p className="font-serif text-lg font-bold text-[#1A2A44]">
                Mensajería de la federación
              </p>
              <p className="text-xs max-w-xs">
                Elegí un club o árbitro de la lista para chatear, o usá{" "}
                <span className="font-bold text-[#EA580C]">Redactar</span> para enviar un
                comunicado oficial a varios destinatarios a la vez.
              </p>
            </div>
          )}

          {pestaña === "conversaciones" && !redactando && seleccionada && cargandoChat && (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              Cargando conversación…
            </div>
          )}

          {pestaña === "conversaciones" && !redactando && seleccionada && !cargandoChat && conversacionId && (
            <VentanaChat
              key={conversacionId}
              conversacionId={conversacionId}
              mensajesIniciales={mensajes}
              usuarioActualId={usuarioActualId}
              titulo={seleccionada.nombre}
              subtitulo={
                seleccionada.tipoDestino === "club"
                  ? "Club afiliado — Liga de Fútsal de Ushuaia"
                  : "Árbitro oficial — Colegio de Árbitros LFS"
              }
              iniciales={inicialesDe(seleccionada.nombre)}
              esAdmin
              onVolver={() => setSeleccionada(null)}
            />
          )}
        </section>
      </div>
    </div>
  );
}
