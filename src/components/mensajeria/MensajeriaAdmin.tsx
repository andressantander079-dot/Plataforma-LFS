"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  MessageSquare,
  Users,
  Flag,
  Megaphone,
  PenSquare,
  CalendarClock,
  FileEdit,
  Trash2,
  Send,
  XCircle,
  Loader2,
  Clock,
  CheckCircle2,
  Tag,
} from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import {
  obtenerPanelMensajeriaAdmin,
  obtenerOCrearConversacion,
  obtenerOCrearConversacionArbitro,
  obtenerMensajes,
  obtenerBorradoresAdmin,
  eliminarBorradorAdmin,
  obtenerComunicadosProgramadosAdmin,
  cancelarComunicadoProgramadoAdmin,
  reprogramarComunicadoAdmin,
  enviarAhoraComunicadoProgramadoAdmin,
  type ConversacionResumen,
  type BorradorComunicado,
  type ComunicadoProgramado,
} from "@/lib/actions/mensajeria.actions";
import { PRIORIDADES_MENSAJE, textoPlanoDeHtml } from "@/lib/core/rules/mensajeriaRules";
import { VentanaChat, type Mensaje } from "./VentanaChat";
import { PanelRedactarComunicado } from "./PanelRedactarComunicado";
import { PanelComunicadosAdmin } from "./PanelComunicadosAdmin";

/**
 * PANEL EMPRESARIAL DE MENSAJERÍA DEL ADMIN (Federación LFS)
 * Pestañas:
 *  - Conversaciones (Clubes y Árbitros en tiempo real)
 *  - Comunicados (Historial enviado y seguimiento individual de lectura)
 *  - Programados (Cola de envíos programados con reprogramación, envío inmediato o cancelación)
 *  - Borradores (Borradores automáticos y manuales listos para retomar)
 * Botón destacado "Redactar mensaje": abre el compositor empresarial completo.
 */

interface MensajeriaAdminProps {
  conversacionesIniciales: ConversacionResumen[];
  usuarioActualId: string;
}

type Pestaña = "conversaciones" | "comunicados" | "programados" | "borradores";
type FiltroDestinatario = "todos" | "club" | "arbitro";

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

function fechaHoraCompleta(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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

export function MensajeriaAdmin({
  conversacionesIniciales,
  usuarioActualId,
}: MensajeriaAdminProps) {
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [pestaña, setPestaña] = useState<Pestaña>("conversaciones");
  const [filtroTipo, setFiltroTipo] = useState<FiltroDestinatario>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionada, setSeleccionada] = useState<ConversacionResumen | null>(null);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargandoChat, setCargandoChat] = useState(false);

  // Estado del compositor "Redactar mensaje"
  const [redactando, setRedactando] = useState(false);
  const [borradorParaEditar, setBorradorParaEditar] = useState<BorradorComunicado | null>(null);
  const [refrescoComunicados, setRefrescoComunicados] = useState(0);

  // Estado de Borradores y Programados
  const [borradores, setBorradores] = useState<BorradorComunicado[]>([]);
  const [cargandoBorradores, setCargandoBorradores] = useState(false);
  const [programados, setProgramados] = useState<ComunicadoProgramado[]>([]);
  const [cargandoProgramados, setCargandoProgramados] = useState(false);
  const [reprogramandoId, setReprogramandoId] = useState<string | null>(null);
  const [nuevaFechaProg, setNuevaFechaProg] = useState("");
  const [nuevaHoraProg, setNuevaHoraProg] = useState("10:00");
  const [accionEnCursoId, setAccionEnCursoId] = useState<string | null>(null);

  const refrescarLista = useCallback(async () => {
    const frescas = await obtenerPanelMensajeriaAdmin();
    setConversaciones(frescas);
    setSeleccionada((sel) =>
      sel
        ? (frescas.find(
            (c) => c.destinoId === sel.destinoId && c.tipoDestino === sel.tipoDestino
          ) ?? sel)
        : sel
    );
  }, []);

  const cargarBorradores = useCallback(async () => {
    setCargandoBorradores(true);
    try {
      const lista = await obtenerBorradoresAdmin();
      setBorradores(lista);
    } finally {
      setCargandoBorradores(false);
    }
  }, []);

  const cargarProgramados = useCallback(async () => {
    setCargandoProgramados(true);
    try {
      const lista = await obtenerComunicadosProgramadosAdmin();
      setProgramados(lista);
    } finally {
      setCargandoProgramados(false);
    }
  }, []);

  // Cargar contadores iniciales de borradores y programados
  useEffect(() => {
    cargarBorradores();
    cargarProgramados();
  }, [cargarBorradores, cargarProgramados]);

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
    setRedactando(false);
    setSeleccionada(item);
    setCargandoChat(true);
    try {
      const conv =
        item.tipoDestino === "arbitro"
          ? await obtenerOCrearConversacionArbitro(item.destinoId)
          : await obtenerOCrearConversacion(item.destinoId);
      const historial = await obtenerMensajes(conv.id);
      setConversacionId(conv.id);
      setMensajes(historial as Mensaje[]);
    } finally {
      setCargandoChat(false);
    }
  }

  function iniciarRedaccionNueva() {
    setBorradorParaEditar(null);
    setRedactando(true);
  }

  function retomarBorrador(b: BorradorComunicado) {
    setBorradorParaEditar(b);
    setRedactando(true);
  }

  async function manejarEliminarBorrador(id: string) {
    setAccionEnCursoId(id);
    await eliminarBorradorAdmin(id);
    setAccionEnCursoId(null);
    cargarBorradores();
  }

  async function manejarCancelarProgramado(id: string) {
    setAccionEnCursoId(id);
    await cancelarComunicadoProgramadoAdmin(id);
    setAccionEnCursoId(null);
    cargarProgramados();
  }

  async function manejarEnviarAhoraProgramado(id: string) {
    setAccionEnCursoId(id);
    await enviarAhoraComunicadoProgramadoAdmin(id);
    setAccionEnCursoId(null);
    await Promise.all([cargarProgramados(), refrescarLista()]);
    setRefrescoComunicados((n) => n + 1);
  }

  async function manejarConfirmarReprogramacion(id: string) {
    if (!nuevaFechaProg || !nuevaHoraProg) return;
    setAccionEnCursoId(id);
    const iso = `${nuevaFechaProg}T${nuevaHoraProg}:00-03:00`;
    const res = await reprogramarComunicadoAdmin(id, iso);
    setAccionEnCursoId(null);
    if (res.ok) {
      setReprogramandoId(null);
      cargarProgramados();
    }
  }

  const totalNoLeidos = useMemo(
    () => conversaciones.reduce((acc, c) => acc + c.noLeidos, 0),
    [conversaciones]
  );

  const programadosPendientes = useMemo(
    () => programados.filter((p) => p.estado === "pendiente").length,
    [programados]
  );

  const filtradas = useMemo(
    () =>
      conversaciones.filter((c) => {
        if (filtroTipo !== "todos" && c.tipoDestino !== filtroTipo) return false;
        return c.nombre.toLowerCase().includes(busqueda.toLowerCase());
      }),
    [conversaciones, filtroTipo, busqueda]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-7rem)] flex flex-col">
      {/* BARRA SUPERIOR EMPRESARIAL: PESTAÑAS + BOTÓN "REDACTAR MENSAJE" */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setRedactando(false);
              setPestaña("conversaciones");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              !redactando && pestaña === "conversaciones"
                ? "bg-[#1A2A44] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Conversaciones</span>
            {totalNoLeidos > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-[#F97316] text-white text-[10px] font-black">
                {totalNoLeidos}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setRedactando(false);
              setPestaña("comunicados");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              !redactando && pestaña === "comunicados"
                ? "bg-[#1A2A44] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" />
            <span>Comunicados enviados</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRedactando(false);
              setPestaña("programados");
              cargarProgramados();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              !redactando && pestaña === "programados"
                ? "bg-[#1A2A44] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Programados</span>
            {programadosPendientes > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {programadosPendientes}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setRedactando(false);
              setPestaña("borradores");
              cargarBorradores();
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              !redactando && pestaña === "borradores"
                ? "bg-[#1A2A44] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Borradores</span>
            {borradores.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-300 text-[#1A2A44] text-[10px] font-black">
                {borradores.length}
              </span>
            )}
          </button>
        </div>

        {/* BOTÓN PRINCIPAL RESTAURADO: REDACTAR MENSAJE */}
        <button
          type="button"
          onClick={iniciarRedaccionNueva}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white px-4 py-2 text-xs font-black shadow-md shadow-orange-500/20 hover:brightness-105 transition shrink-0"
        >
          <PenSquare className="w-4 h-4" />
          <span>Redactar mensaje</span>
        </button>
      </header>

      {/* CONTENIDO PRINCIPAL SEGÚN MODO ACTIVO */}
      {redactando ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <PanelRedactarComunicado
            key={borradorParaEditar?.id ?? "nuevo-comunicado"}
            destinatarios={conversaciones}
            borradorInicial={borradorParaEditar}
            onCerrar={() => {
              setRedactando(false);
              cargarBorradores();
            }}
            onBorradorActualizado={cargarBorradores}
            onEnviado={(fueProgramado) => {
              setRedactando(false);
              refrescarLista();
              cargarBorradores();
              cargarProgramados();
              setRefrescoComunicados((n) => n + 1);
              setPestaña(fueProgramado ? "programados" : "comunicados");
            }}
          />
        </div>
      ) : pestaña === "comunicados" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <PanelComunicadosAdmin refresco={refrescoComunicados} />
        </div>
      ) : pestaña === "programados" ? (
        <div className="flex-1 overflow-y-auto p-4 bg-[#F4F6FA] flex flex-col gap-3">
          {cargandoProgramados ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando envíos programados…
            </div>
          ) : programados.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-200/70 flex items-center justify-center">
                <CalendarClock className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1A2A44]">
                No hay comunicados programados
              </p>
              <p className="text-xs max-w-xs">
                Al redactar un mensaje podés activar la opción “Programar envío” para agendarlo en una fecha y hora futuras.
              </p>
            </div>
          ) : (
            programados.map((item) => {
              const cfgPrioridad = PRIORIDADES_MENSAJE[item.prioridad ?? "normal"];
              const cantDest =
                (item.destinatarios.todosClubes
                  ? "Todos los clubes"
                  : `${item.destinatarios.clubes?.length ?? 0} clubes`) +
                " · " +
                (item.destinatarios.todosArbitros
                  ? "Todos los árbitros"
                  : `${item.destinatarios.arbitros?.length ?? 0} árbitros`);

              return (
                <article
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                          <Tag className="w-2.5 h-2.5 text-[#F97316]" /> {item.categoria}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase rounded-full px-2 py-0.5 border ${cfgPrioridad.badgeClase}`}
                        >
                          {cfgPrioridad.etiqueta}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase rounded-full px-2.5 py-0.5 ${
                            item.estado === "pendiente"
                              ? "bg-amber-100 text-amber-800"
                              : item.estado === "enviado"
                                ? "bg-emerald-100 text-emerald-800"
                                : item.estado === "cancelado"
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-red-100 text-red-700"
                          }`}
                        >
                          {item.estado}
                        </span>
                      </div>

                      <h3 className="font-serif font-bold text-[#1A2A44] mt-1">{item.asunto}</h3>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {textoPlanoDeHtml(item.cuerpo_html, 120)}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
                        <span className="font-bold text-[#1A2A44] flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                          Programado para: {fechaHoraCompleta(item.scheduled_for)} ({item.timezone})
                        </span>
                        <span>Alcance: {cantDest}</span>
                      </div>
                    </div>

                    {item.estado === "pendiente" && (
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        <button
                          type="button"
                          disabled={accionEnCursoId === item.id}
                          onClick={() => manejarEnviarAhoraProgramado(item.id)}
                          className="flex items-center gap-1 rounded-xl bg-[#1A2A44] text-white px-3 py-1.5 text-xs font-bold hover:brightness-110 transition disabled:opacity-50"
                        >
                          <Send className="w-3.5 h-3.5" /> Enviar ahora
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReprogramandoId(
                              reprogramandoId === item.id ? null : item.id
                            );
                            const f = new Date(item.scheduled_for);
                            setNuevaFechaProg(f.toISOString().slice(0, 10));
                            setNuevaHoraProg(f.toTimeString().slice(0, 5));
                          }}
                          className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-[#1A2A44] hover:bg-slate-50 transition"
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Modificar hora
                        </button>
                        <button
                          type="button"
                          disabled={accionEnCursoId === item.id}
                          onClick={() => manejarCancelarProgramado(item.id)}
                          className="flex items-center gap-1 rounded-xl bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 text-xs font-bold hover:bg-red-100 transition disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Cancelar
                        </button>
                      </div>
                    )}

                    {item.estado === "enviado" && item.enviado_at && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" /> Despachado el{" "}
                        {fechaHoraCompleta(item.enviado_at)}
                      </span>
                    )}
                  </div>

                  {reprogramandoId === item.id && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2 flex-wrap">
                      <input
                        type="date"
                        value={nuevaFechaProg}
                        onChange={(e) => setNuevaFechaProg(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-[#1A2A44]"
                      />
                      <input
                        type="time"
                        value={nuevaHoraProg}
                        onChange={(e) => setNuevaHoraProg(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-[#1A2A44]"
                      />
                      <button
                        type="button"
                        onClick={() => manejarConfirmarReprogramacion(item.id)}
                        className="rounded-lg bg-[#F97316] text-white px-3 py-1.5 text-xs font-bold hover:brightness-105"
                      >
                        Guardar nueva programación
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      ) : pestaña === "borradores" ? (
        <div className="flex-1 overflow-y-auto p-4 bg-[#F4F6FA] flex flex-col gap-3">
          {cargandoBorradores ? (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando borradores…
            </div>
          ) : borradores.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-400 p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-200/70 flex items-center justify-center">
                <FileEdit className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-[#1A2A44]">No tenés borradores guardados</p>
              <p className="text-xs max-w-xs">
                Mientras redactás un comunicado, el sistema guarda automáticamente tu progreso para evitar pérdidas accidentales.
              </p>
            </div>
          ) : (
            borradores.map((b) => (
              <article
                key={b.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 rounded-full px-2 py-0.5">
                      {b.categoria}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {b.es_autoguardado ? "Guardado automático" : "Guardado manual"} · Última modificación:{" "}
                      {fechaHoraCompleta(b.updated_at)}
                    </span>
                  </div>
                  <h3 className="font-serif font-bold text-[#1A2A44] mt-1">
                    {b.asunto || "(Borrador sin asunto)"}
                  </h3>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    {textoPlanoDeHtml(b.cuerpo_html, 110) || "(Sin contenido en el cuerpo)"}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => retomarBorrador(b)}
                    className="flex items-center gap-1.5 rounded-xl bg-[#1A2A44] text-white px-3.5 py-2 text-xs font-bold hover:brightness-110 transition"
                  >
                    <PenSquare className="w-3.5 h-3.5" /> Continuar editando
                  </button>
                  <button
                    type="button"
                    disabled={accionEnCursoId === b.id}
                    onClick={() => manejarEliminarBorrador(b.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                    aria-label="Eliminar borrador"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      ) : (
        /* VISTA DE CONVERSACIONES (CLUBES Y ÁRBITROS) */
        <div className="flex-1 min-h-0 flex">
          <aside
            className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col shrink-0 ${
              seleccionada ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-3 border-b border-slate-200 flex flex-col gap-2">
              <button
                type="button"
                onClick={iniciarRedaccionNueva}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white px-3.5 py-2.5 text-xs font-black shadow-md shadow-orange-500/20 hover:brightness-105 transition"
              >
                <PenSquare className="w-4 h-4" />
                <span>Redactar mensaje</span>
              </button>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar club o árbitro…"
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
                />
              </div>

              {/* Filtro rápido por tipo de destinatario */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {(
                  [
                    { id: "todos", label: "Todos" },
                    { id: "club", label: "Clubes" },
                    { id: "arbitro", label: "Árbitros" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setFiltroTipo(t.id)}
                    className={`py-1 rounded-lg text-[11px] font-bold transition ${
                      filtroTipo === t.id
                        ? "bg-white text-[#1A2A44] shadow-2xs"
                        : "text-slate-500 hover:text-[#1A2A44]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filtradas.length === 0 && (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-sm py-12 px-4 text-center">
                  <Users className="w-6 h-6" />
                  {busqueda
                    ? "Ningún destinatario coincide con la búsqueda."
                    : "Todavía no hay destinatarios registrados."}
                </div>
              )}

              {filtradas.map((item) => {
                const esActivo =
                  seleccionada?.destinoId === item.destinoId &&
                  seleccionada?.tipoDestino === item.tipoDestino;
                return (
                  <button
                    key={`${item.tipoDestino}-${item.destinoId}`}
                    type="button"
                    onClick={() => abrirConversacion(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-slate-100 transition hover:bg-slate-50 ${
                      esActivo ? "bg-orange-50/60" : ""
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-full text-white flex items-center justify-center font-bold text-sm shrink-0 ${
                        item.tipoDestino === "arbitro" ? "bg-[#4A5D7A]" : "bg-[#1A2A44]"
                      }`}
                    >
                      {inicialesDe(item.nombre)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={`text-sm text-[#1A2A44] truncate ${
                            item.noLeidos > 0 ? "font-black" : "font-bold"
                          }`}
                        >
                          {item.nombre}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {horaLista(item.ultimoMensajeFecha)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span
                          className={`text-xs truncate ${
                            item.noLeidos > 0 ? "text-[#1A2A44] font-semibold" : "text-slate-500"
                          }`}
                        >
                          {item.ultimoMensaje ?? "Iniciar conversación…"}
                        </span>
                        {item.noLeidos > 0 ? (
                          <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-[#F97316] text-white text-[11px] font-bold flex items-center justify-center">
                            {item.noLeidos}
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase text-slate-400 shrink-0">
                            {item.tipoDestino === "arbitro" ? "Árbitro" : "Club"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
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
                  Centro de Comunicación Oficial LFS
                </p>
                <p className="text-xs max-w-xs">
                  Elegí un club o árbitro de la lista para abrir su canal directo, o usá el botón
                  “Redactar mensaje” para difundir un comunicado oficial.
                </p>
                <button
                  type="button"
                  onClick={iniciarRedaccionNueva}
                  className="mt-2 flex items-center gap-2 rounded-xl bg-[#1A2A44] text-white px-4 py-2.5 text-xs font-bold hover:brightness-110 transition"
                >
                  <PenSquare className="w-4 h-4 text-[#F97316]" /> Redactar nuevo comunicado
                </button>
              </div>
            )}

            {seleccionada && cargandoChat && (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando conversación…
              </div>
            )}

            {seleccionada && !cargandoChat && conversacionId && (
              <VentanaChat
                key={conversacionId}
                conversacionId={conversacionId}
                mensajesIniciales={mensajes}
                usuarioActualId={usuarioActualId}
                titulo={seleccionada.nombre}
                subtitulo={
                  seleccionada.tipoDestino === "arbitro"
                    ? "Cuerpo arbitral — Liga de Fútsal de Ushuaia"
                    : "Club afiliado — Liga de Fútsal de Ushuaia"
                }
                iniciales={inicialesDe(seleccionada.nombre)}
                esAdmin={true}
                onVolver={() => setSeleccionada(null)}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
