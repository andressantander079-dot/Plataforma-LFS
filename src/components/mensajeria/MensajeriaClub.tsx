"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  PenSquare,
  CalendarClock,
  FileEdit,
  Trash2,
  Clock,
  Loader2,
  Send,
  XCircle,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { VentanaChat, type Mensaje } from "./VentanaChat";
import { PanelRedactarComunicado } from "./PanelRedactarComunicado";
import {
  obtenerBorradoresClub,
  eliminarBorradorClub,
  obtenerComunicadosProgramadosClub,
  cancelarComunicadoProgramadoClub,
  reprogramarComunicadoClub,
  enviarAhoraComunicadoProgramadoClub,
  type BorradorComunicado,
  type ComunicadoProgramado,
} from "@/lib/actions/mensajeria.actions";
import { PRIORIDADES_MENSAJE, textoPlanoDeHtml } from "@/lib/core/rules/mensajeriaRules";

/**
 * PANEL DE MENSAJERÍA OFICIAL DEL CLUB (Portal Club LFS)
 * Pestañas:
 *  - Chat Oficial (Conversación privada en tiempo real con la Federación LFS)
 *  - Programados (Mensajes oficiales agendados para salir en una fecha/hora)
 *  - Borradores (Notas y solicitudes guardadas automáticamente o de forma manual)
 * Botón destacado "Redactar mensaje": abre el compositor empresarial de notas oficiales hacia la liga.
 */

interface MensajeriaClubProps {
  conversacionId: string;
  mensajesIniciales: Mensaje[];
  usuarioActualId: string;
  clubId: string;
  clubNombre: string;
}

type PestañaClub = "chat" | "programados" | "borradores";

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

export function MensajeriaClub({
  conversacionId,
  mensajesIniciales,
  usuarioActualId,
  clubId,
  clubNombre,
}: MensajeriaClubProps) {
  const [pestaña, setPestaña] = useState<PestañaClub>("chat");
  const [redactando, setRedactando] = useState(false);
  const [borradorParaEditar, setBorradorParaEditar] = useState<BorradorComunicado | null>(null);

  // Estados de Programados y Borradores
  const [programados, setProgramados] = useState<ComunicadoProgramado[]>([]);
  const [cargandoProgramados, setCargandoProgramados] = useState(false);
  const [borradores, setBorradores] = useState<BorradorComunicado[]>([]);
  const [cargandoBorradores, setCargandoBorradores] = useState(false);
  const [accionEnCursoId, setAccionEnCursoId] = useState<string | null>(null);

  // Reprogramación modal/inline
  const [reprogramandoId, setReprogramandoId] = useState<string | null>(null);
  const [nuevaFechaProg, setNuevaFechaProg] = useState("");
  const [nuevaHoraProg, setNuevaHoraProg] = useState("");

  async function cargarBorradores() {
    setCargandoBorradores(true);
    const lista = await obtenerBorradoresClub();
    setBorradores(lista);
    setCargandoBorradores(false);
  }

  async function cargarProgramados() {
    setCargandoProgramados(true);
    const lista = await obtenerComunicadosProgramadosClub();
    setProgramados(lista);
    setCargandoProgramados(false);
  }

  useEffect(() => {
    cargarBorradores();
    cargarProgramados();
  }, []);

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
    await eliminarBorradorClub(id);
    setAccionEnCursoId(null);
    cargarBorradores();
  }

  async function manejarCancelarProgramado(id: string) {
    setAccionEnCursoId(id);
    await cancelarComunicadoProgramadoClub(id);
    setAccionEnCursoId(null);
    cargarProgramados();
  }

  async function manejarEnviarAhoraProgramado(id: string) {
    setAccionEnCursoId(id);
    await enviarAhoraComunicadoProgramadoClub(id);
    setAccionEnCursoId(null);
    cargarProgramados();
    setPestaña("chat");
  }

  async function manejarConfirmarReprogramacion(id: string) {
    if (!nuevaFechaProg || !nuevaHoraProg) return;
    setAccionEnCursoId(id);
    const iso = `${nuevaFechaProg}T${nuevaHoraProg}:00-03:00`;
    const res = await reprogramarComunicadoClub(id, iso);
    setAccionEnCursoId(null);
    if (res.ok) {
      setReprogramandoId(null);
      cargarProgramados();
    }
  }

  const programadosPendientes = useMemo(
    () => programados.filter((p) => p.estado === "pendiente").length,
    [programados]
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-[calc(100vh-7rem)] flex flex-col">
      {/* BARRA SUPERIOR DEL CLUB: PESTAÑAS + BOTÓN "REDACTAR MENSAJE" */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-50 border-b border-slate-200 shrink-0 flex-wrap">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setRedactando(false);
              setPestaña("chat");
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
              !redactando && pestaña === "chat"
                ? "bg-[#1A2A44] text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-200/70"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Oficial</span>
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

        {/* BOTÓN PRINCIPAL: REDACTAR MENSAJE A LA FEDERACIÓN */}
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
            key={borradorParaEditar?.id ?? "nuevo-mensaje-club"}
            destinatarios={[]}
            borradorInicial={borradorParaEditar}
            modoClub={true}
            clubNombre={clubNombre}
            onCerrar={() => {
              setRedactando(false);
              cargarBorradores();
            }}
            onBorradorActualizado={cargarBorradores}
            onEnviado={(fueProgramado) => {
              setRedactando(false);
              cargarBorradores();
              cargarProgramados();
              setPestaña(fueProgramado ? "programados" : "chat");
            }}
          />
        </div>
      ) : pestaña === "chat" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <VentanaChat
            conversacionId={conversacionId}
            mensajesIniciales={mensajesIniciales}
            usuarioActualId={usuarioActualId}
            titulo="Federación LFS"
            subtitulo="Administración de la liga — respuesta oficial en tiempo real"
            iniciales="LFS"
          />
        </div>
      ) : pestaña === "programados" ? (
        /* PESTAÑA: MENSAJES PROGRAMADOS DEL CLUB */
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#F4F6FA] flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-black text-[#1A2A44] flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-[#F97316]" />
                Mensajes oficiales programados
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mensajes agendados para ser entregados automáticamente a la Federación LFS.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarProgramados}
              disabled={cargandoProgramados}
              className="text-xs font-bold text-slate-600 hover:text-[#1A2A44] px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              {cargandoProgramados ? "Actualizando…" : "Refrescar"}
            </button>
          </div>

          {cargandoProgramados ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
              Cargando mensajes programados…
            </div>
          ) : programados.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <CalendarClock className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-[#1A2A44]">No tenés mensajes programados</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Al redactar podés activar la opción “Programar envío” para enviarlo en un horario específico.
              </p>
              <button
                type="button"
                onClick={iniciarRedaccionNueva}
                className="mt-2 text-xs font-bold text-[#F97316] hover:underline"
              >
                Redactar un mensaje ahora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {programados.map((item) => {
                const cfgPri = PRIORIDADES_MENSAJE[item.prioridad];
                const estaAccionando = accionEnCursoId === item.id;
                const estaReprogramando = reprogramandoId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfgPri.badgeClase}`}
                        >
                          {cfgPri.etiqueta}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#F97316]" />
                          {item.categoria}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.estado === "pendiente"
                              ? "bg-amber-100 text-amber-800"
                              : item.estado === "enviado"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {item.estado === "pendiente"
                            ? "Pendiente de despacho"
                            : item.estado === "enviado"
                              ? "Enviado"
                              : "Cancelado"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#1A2A44] bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-xl">
                        <Clock className="w-3.5 h-3.5 text-[#F97316]" />
                        <span>Programado: {fechaHoraCompleta(item.scheduled_for)}</span>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-serif text-sm font-black text-[#1A2A44]">{item.asunto}</h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {textoPlanoDeHtml(item.cuerpo_html, 150)}
                      </p>
                    </div>

                    {item.adjuntos?.length > 0 && (
                      <p className="text-[11px] font-bold text-slate-500">
                        📎 {item.adjuntos.length} archivo{item.adjuntos.length === 1 ? "" : "s"} adjunto{item.adjuntos.length === 1 ? "" : "s"}
                      </p>
                    )}

                    {estaReprogramando && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Nueva fecha
                          </label>
                          <input
                            type="date"
                            value={nuevaFechaProg}
                            onChange={(e) => setNuevaFechaProg(e.target.value)}
                            className="w-full text-xs font-bold text-[#1A2A44] rounded-lg border border-slate-300 p-2 bg-white"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                            Nueva hora
                          </label>
                          <input
                            type="time"
                            value={nuevaHoraProg}
                            onChange={(e) => setNuevaHoraProg(e.target.value)}
                            className="w-full text-xs font-bold text-[#1A2A44] rounded-lg border border-slate-300 p-2 bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => manejarConfirmarReprogramacion(item.id)}
                            disabled={estaAccionando || !nuevaFechaProg || !nuevaHoraProg}
                            className="px-3 py-2 rounded-lg bg-[#1A2A44] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setReprogramandoId(null)}
                            className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}

                    {item.estado === "pendiente" && !estaReprogramando && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setReprogramandoId(item.id);
                            setNuevaFechaProg(item.scheduled_for.slice(0, 10));
                            setNuevaHoraProg(item.scheduled_for.slice(11, 16));
                          }}
                          disabled={estaAccionando}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition"
                        >
                          Reprogramar
                        </button>
                        <button
                          type="button"
                          onClick={() => manejarEnviarAhoraProgramado(item.id)}
                          disabled={estaAccionando}
                          className="px-3 py-1.5 rounded-lg bg-[#1A2A44] text-white text-xs font-bold hover:brightness-110 transition flex items-center gap-1"
                        >
                          <Send className="w-3 h-3 text-[#F97316]" />
                          Enviar ahora
                        </button>
                        <button
                          type="button"
                          onClick={() => manejarCancelarProgramado(item.id)}
                          disabled={estaAccionando}
                          className="px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-50 text-xs font-bold transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancelar envío
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* PESTAÑA: BORRADORES DEL CLUB */
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-[#F4F6FA] flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-black text-[#1A2A44] flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-[#F97316]" />
                Borradores guardados
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Continuá redactando tus notas y solicitudes oficiales donde las dejaste.
              </p>
            </div>
            <button
              type="button"
              onClick={cargarBorradores}
              disabled={cargandoBorradores}
              className="text-xs font-bold text-slate-600 hover:text-[#1A2A44] px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
            >
              {cargandoBorradores ? "Actualizando…" : "Refrescar"}
            </button>
          </div>

          {cargandoBorradores ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />
              Cargando borradores…
            </div>
          ) : borradores.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2">
              <FileEdit className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-bold text-[#1A2A44]">No tenés borradores guardados</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Cualquier mensaje que empieces a escribir se guarda automáticamente para evitar pérdidas de contenido.
              </p>
              <button
                type="button"
                onClick={iniciarRedaccionNueva}
                className="mt-2 text-xs font-bold text-[#F97316] hover:underline"
              >
                Empezar a redactar un mensaje
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {borradores.map((b) => {
                const cfgPri = PRIORIDADES_MENSAJE[b.prioridad];
                const estaAccionando = accionEnCursoId === b.id;

                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-orange-300 transition"
                  >
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${cfgPri.badgeClase}`}
                        >
                          {cfgPri.etiqueta}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#F97316]" />
                          {b.categoria}
                        </span>
                        {b.es_autoguardado && (
                          <span className="text-[10px] font-bold text-slate-400 italic">
                            (Autoguardado)
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-auto">
                          <Clock className="w-3 h-3" /> Modificado: {fechaHoraCompleta(b.updated_at)}
                        </span>
                      </div>
                      <h3 className="font-serif text-sm font-black text-[#1A2A44] truncate">
                        {b.asunto || "Borrador sin asunto"}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-1">
                        {textoPlanoDeHtml(b.cuerpo_html, 120) || "Sin contenido todavía…"}
                      </p>
                      {b.adjuntos?.length > 0 && (
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          📎 {b.adjuntos.length} adjunto{b.adjuntos.length === 1 ? "" : "s"} guardado{b.adjuntos.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <button
                        type="button"
                        onClick={() => retomarBorrador(b)}
                        className="px-3.5 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:brightness-110 transition flex items-center gap-1.5"
                      >
                        <PenSquare className="w-3.5 h-3.5 text-[#F97316]" />
                        Retomar redacción
                      </button>
                      <button
                        type="button"
                        onClick={() => manejarEliminarBorrador(b.id)}
                        disabled={estaAccionando}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Eliminar borrador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
