"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, MessageSquare, Users } from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import {
  obtenerPanelMensajeriaAdmin,
  obtenerOCrearConversacion,
  obtenerMensajes,
  type ConversacionResumen,
} from "@/lib/actions/mensajeria.actions";
import { VentanaChat, type Mensaje } from "./VentanaChat";

/**
 * PANEL DE MENSAJERÍA DEL ADMIN (federación)
 * Lista de clubes a la izquierda (con no leídos y último mensaje),
 * chat a la derecha. En móvil: lista ↔ chat con botón volver.
 * La lista se actualiza en tiempo real cuando llegan mensajes.
 */

interface MensajeriaAdminProps {
  conversacionesIniciales: ConversacionResumen[];
  usuarioActualId: string;
}

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
  return nombre
    .split(" ")
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || nombre.slice(0, 2).toUpperCase();
}

export function MensajeriaAdmin({
  conversacionesIniciales,
  usuarioActualId,
}: MensajeriaAdminProps) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<ConversacionResumen | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargandoChat, setCargandoChat] = useState(false);

  const refrescarLista = useCallback(async () => {
    const frescas = await obtenerPanelMensajeriaAdmin();
    setConversaciones(frescas);
    setSeleccionada((sel) =>
      sel ? (frescas.find((c) => c.clubId === sel.clubId) ?? sel) : sel
    );
  }, []);

  // Tiempo real: cualquier mensaje nuevo actualiza la lista (preview + contador)
  useEffect(() => {
    const supabase = createLfsClient();
    const canal = supabase
      .channel("lista-conversaciones-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        () => {
          refrescarLista();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          refrescarLista();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [refrescarLista]);

  async function abrirConversacion(item: ConversacionResumen) {
    setSeleccionada(item);
    setCargandoChat(true);
    try {
      // Si el club todavía no tiene chat, se crea acá mismo
      const conv = await obtenerOCrearConversacion(item.clubId);
      const historial = await obtenerMensajes(conv.id);
      setConversacionId(conv.id);
      setMensajes(historial as Mensaje[]);
    } finally {
      setCargandoChat(false);
    }
  }

  const filtradas = conversaciones.filter((c) =>
    c.clubNombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-7rem)] flex">
      {/* Lista de conversaciones */}
      <aside
        className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col shrink-0 ${
          seleccionada ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar club…"
              className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtradas.length === 0 && (
            <div className="flex flex-col items-center gap-2 text-slate-400 text-sm py-12 px-4 text-center">
              <Users className="w-6 h-6" />
              {busqueda
                ? "Ningún club coincide con la búsqueda."
                : "Todavía no hay clubes registrados."}
            </div>
          )}

          {filtradas.map((item) => (
            <button
              key={item.clubId}
              type="button"
              onClick={() => abrirConversacion(item)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 transition hover:bg-slate-50 ${
                seleccionada?.clubId === item.clubId ? "bg-orange-50/60" : ""
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-[#1A2A44] text-white flex items-center justify-center font-bold text-sm shrink-0">
                {inicialesDe(item.clubNombre)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-sm text-[#1A2A44] truncate">
                    {item.clubNombre}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    {horaLista(item.ultimoMensajeFecha)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500 truncate">
                    {item.ultimoMensaje ?? "Iniciar conversación…"}
                  </span>
                  {item.noLeidos > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center">
                      {item.noLeidos}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Zona del chat */}
      <section
        className={`flex-1 min-w-0 ${seleccionada ? "flex" : "hidden md:flex"} flex-col`}
      >
        {!seleccionada && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 bg-slate-50 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-200/70 flex items-center justify-center">
              <MessageSquare className="w-7 h-7" />
            </div>
            <p className="font-serif text-lg font-bold text-[#1A2A44]">
              Mensajería con los clubes
            </p>
            <p className="text-xs max-w-xs">
              Elegí un club de la lista para ver la conversación o empezar una nueva.
              Los mensajes llegan en tiempo real.
            </p>
          </div>
        )}

        {seleccionada && cargandoChat && (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Cargando conversación…
          </div>
        )}

        {seleccionada && !cargandoChat && conversacionId && (
          <VentanaChat
            key={conversacionId}
            conversacionId={conversacionId}
            mensajesIniciales={mensajes}
            usuarioActualId={usuarioActualId}
            titulo={seleccionada.clubNombre}
            subtitulo="Club afiliado — Liga de Fútsal de Ushuaia"
            iniciales={inicialesDe(seleccionada.clubNombre)}
            onVolver={() => setSeleccionada(null)}
          />
        )}
      </section>
    </div>
  );
}
