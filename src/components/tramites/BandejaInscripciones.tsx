"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Inbox,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  ExternalLink,
  Loader2,
  FileText,
  Clock,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import type {
  BandejaInscripcionesData,
  InscripcionJugadorTramite,
} from "@/lib/actions/tramites.actions";
import { cambiarEstadoInscripcionJugador } from "@/lib/actions/tramites.actions";
import { obtenerUrlDocumento } from "@/lib/actions/documentos.actions";
import { DOCUMENTOS_INSCRIPCION, calcularEdad } from "@/lib/core/rules/jugadoresRules";

type FiltroTab = "todos" | "pendiente" | "en_deuda" | "activo" | "denegado";

export function BandejaInscripciones({ data }: { data: BandejaInscripcionesData }) {
  const router = useRouter();
  const [tab, setTab] = useState<FiltroTab>(
    data.kpis.pendientes > 0 ? "pendiente" : "todos"
  );
  const [busqueda, setBusqueda] = useState("");
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [abriendoDoc, setAbriendoDoc] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.inscripciones.filter((item) => {
      if (tab !== "todos" && item.status !== tab) return false;
      if (q) {
        const blob = `${item.nombreCompleto} ${item.dni} ${item.clubNombre} ${item.categoriaNombre}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [data.inscripciones, tab, busqueda]);

  async function handleVerDocumento(ruta: string, claveDoc: string, playerId: string) {
    const key = `${playerId}-${claveDoc}`;
    setAbriendoDoc(key);
    setError(null);
    try {
      const res = await obtenerUrlDocumento(ruta);
      if (res.ok && res.url) {
        window.open(res.url, "_blank");
      } else {
        setError(res.error ?? "No se pudo abrir el documento.");
      }
    } catch {
      setError("Error al solicitar el enlace al archivo.");
    } finally {
      setAbriendoDoc(null);
    }
  }

  function handleCambiarEstado(
    jugador: InscripcionJugadorTramite,
    nuevoEstado: "activo" | "en_deuda" | "denegado" | "pendiente"
  ) {
    if (jugador.status === nuevoEstado) return;
    setProcesandoId(jugador.playerId);
    setError(null);
    setMensaje(null);

    startTransition(async () => {
      const res = await cambiarEstadoInscripcionJugador(jugador.playerId, nuevoEstado);
      setProcesandoId(null);
      if (!res.ok) {
        setError(res.error ?? "Error al actualizar estado.");
      } else {
        const nombresAccion: Record<string, string> = {
          activo: "aprobado (activo)",
          en_deuda: "puesto en deuda (activo temporal)",
          denegado: "denegado",
          pendiente: "puesto en revisión",
        };
        setMensaje(`✅ ${jugador.nombreCompleto} fue ${nombresAccion[nuevoEstado]}.`);
        router.refresh();
      }
    });
  }

  const KPIS = [
    {
      id: "pendiente" as FiltroTab,
      label: "Pendientes de revisión",
      sublabel: "Esperando decisión de la federación",
      valor: data.kpis.pendientes,
      icono: Clock,
      color: "text-amber-800 bg-amber-50 border-amber-200",
      activoColor: "ring-2 ring-amber-500",
    },
    {
      id: "en_deuda" as FiltroTab,
      label: "En deuda (temporal)",
      sublabel: "Habilitados hasta cierre de período",
      valor: data.kpis.enDeuda,
      icono: AlertTriangle,
      color: "text-orange-800 bg-orange-50 border-orange-200",
      activoColor: "ring-2 ring-orange-500",
    },
    {
      id: "activo" as FiltroTab,
      label: "Aprobados (activos)",
      sublabel: "Habilitados para planillas de juego",
      valor: data.kpis.activos,
      icono: UserCheck,
      color: "text-green-800 bg-green-50 border-green-200",
      activoColor: "ring-2 ring-green-600",
    },
    {
      id: "denegado" as FiltroTab,
      label: "Denegados",
      sublabel: "Rechazados por la federación",
      valor: data.kpis.denegados,
      icono: XCircle,
      color: "text-red-800 bg-red-50 border-red-200",
      activoColor: "ring-2 ring-red-500",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs superiores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPIS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setTab(k.id)}
            className={`text-left p-4 rounded-2xl border transition shadow-sm flex flex-col justify-between ${
              k.color
            } ${tab === k.id ? `${k.activoColor} shadow-md` : "hover:shadow"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">{k.label}</span>
              <k.icono className="w-4 h-4 shrink-0 opacity-80" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black">{k.valor}</span>
              <p className="text-[10px] opacity-75 mt-0.5 line-clamp-1">{k.sublabel}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Alertas */}
      {mensaje && (
        <div className="p-3 bg-green-50 text-green-800 border border-green-200 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{mensaje}</span>
          <button
            type="button"
            onClick={() => setMensaje(null)}
            className="text-green-600 hover:text-green-800 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-bold flex items-center justify-between animate-in fade-in">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Barra de pestañas y búsqueda */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setTab("todos")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === "todos"
                ? "bg-[#1A2A44] text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Todos ({data.kpis.total})
          </button>
          <button
            type="button"
            onClick={() => setTab("pendiente")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === "pendiente"
                ? "bg-amber-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Pendientes ({data.kpis.pendientes})
          </button>
          <button
            type="button"
            onClick={() => setTab("en_deuda")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === "en_deuda"
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            En deuda ({data.kpis.enDeuda})
          </button>
          <button
            type="button"
            onClick={() => setTab("activo")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === "activo"
                ? "bg-green-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Aprobados ({data.kpis.activos})
          </button>
          <button
            type="button"
            onClick={() => setTab("denegado")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              tab === "denegado"
                ? "bg-red-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Denegados ({data.kpis.denegados})
          </button>
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por jugador, DNI o club…"
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>
      </div>

      {/* Lista de inscripciones */}
      {filtradas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2 shadow-sm">
          <Inbox className="w-8 h-8 opacity-40" />
          <p className="font-bold text-sm text-[#1A2A44]">
            No hay trámites de inscripción en esta sección
          </p>
          <p className="text-xs max-w-sm">
            {busqueda
              ? "No se encontraron jugadores que coincidan con la búsqueda."
              : "Cuando los clubes inscriban jugadores, aparecerán acá para su revisión."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtradas.map((item) => {
            const edad = item.fechaNacimiento ? calcularEdad(item.fechaNacimiento) : null;
            const esProcesando = procesandoId === item.playerId;

            return (
              <div
                key={item.playerId}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col gap-4"
              >
                {/* Cabecera del jugador */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.fotoUrl ?? "/jugador-default.png"}
                      alt={`Foto de ${item.nombreCompleto}`}
                      className="w-12 h-12 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif text-base font-bold text-[#1A2A44]">
                          {item.nombreCompleto}
                        </h3>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                          DNI {item.dni}
                        </span>
                        {item.status === "pendiente" && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            PENDIENTE LFS
                          </span>
                        )}
                        {item.status === "en_deuda" && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-orange-100 text-orange-900 border border-orange-200">
                            EN DEUDA (TEMPORAL)
                          </span>
                        )}
                        {item.status === "activo" && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-green-100 text-green-800 border border-green-200">
                            HABILITADO / ACTIVO
                          </span>
                        )}
                        {item.status === "denegado" && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-red-100 text-red-800 border border-red-200">
                            DENEGADO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="font-bold text-slate-700">{item.clubNombre}</span> ·
                        Plantel {item.categoriaNombre}
                        {edad !== null ? ` · ${edad} años` : ""}
                        {item.createdAt && (
                          <span className="text-slate-400">
                            {" "}
                            · Inscrito el {new Date(item.createdAt).toLocaleDateString("es-AR")}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Estado resumen de documentación */}
                  <div className="text-right">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-xl inline-flex items-center gap-1 ${
                        item.documentosCargados >= 4
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {item.documentosCargados}/4 documentos
                    </span>
                  </div>
                </div>

                {/* Revisión de documentos que subió el club */}
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                    Documentos del jugador para revisión federativa:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {DOCUMENTOS_INSCRIPCION.map((doc) => {
                      const ruta = item.documents[doc.clave];
                      const estaAbriendo = abriendoDoc === `${item.playerId}-${doc.clave}`;

                      return (
                        <div
                          key={doc.clave}
                          className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 ${
                            ruta
                              ? "bg-white border-green-200 text-green-950"
                              : "bg-white/60 border-amber-200 text-amber-900"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[11px] font-bold leading-tight">
                              {doc.nombre}
                            </span>
                            {ruta ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            )}
                          </div>

                          {ruta ? (
                            <button
                              type="button"
                              disabled={estaAbriendo}
                              onClick={() => handleVerDocumento(ruta, doc.clave, item.playerId)}
                              className="text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-[#1A2A44] hover:text-white px-2 py-1 rounded-lg transition flex items-center justify-center gap-1 self-start mt-1 disabled:opacity-60"
                            >
                              {estaAbriendo ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" /> Abriendo…
                                </>
                              ) : (
                                <>
                                  <ExternalLink className="w-3 h-3" /> Ver documento
                                </>
                              )}
                            </button>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded self-start mt-1">
                              Pendiente de carga
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Acciones de la administración */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-500">
                    {item.status === "pendiente" && (
                      <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Esperando decisión de la federación para habilitar en planillas.
                      </span>
                    )}
                    {item.status === "en_deuda" && (
                      <span className="text-orange-800 font-semibold flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                        Habilitado temporalmente en planillas hasta que se cierre el período de inscripción.
                      </span>
                    )}
                    {item.status === "activo" && (
                      <span className="text-green-800 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        Habilitado reglamentariamente. Puede disputar partidos.
                      </span>
                    )}
                    {item.status === "denegado" && (
                      <span className="text-red-800 font-semibold flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-600" />
                        Inscripción denegada. Bloqueado para planillas de juego.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Botón Aprobar */}
                    <button
                      type="button"
                      disabled={esProcesando || item.status === "activo"}
                      onClick={() => handleCambiarEstado(item, "activo")}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                        item.status === "activo"
                          ? "bg-green-100 text-green-800 border border-green-300 opacity-60 cursor-default"
                          : "bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow"
                      }`}
                      title="Aprobar jugador para que pueda jugar en planillas"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {item.status === "activo" ? "Aprobado" : "Aprobar"}
                    </button>

                    {/* Botón En deuda */}
                    <button
                      type="button"
                      disabled={esProcesando || item.status === "en_deuda"}
                      onClick={() => handleCambiarEstado(item, "en_deuda")}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                        item.status === "en_deuda"
                          ? "bg-orange-100 text-orange-900 border border-orange-300 opacity-60 cursor-default"
                          : "bg-orange-500 hover:bg-orange-600 text-white shadow-sm hover:shadow"
                      }`}
                      title="Habilitar temporalmente con deuda hasta el cierre del período"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {item.status === "en_deuda" ? "En deuda" : "Colocar en deuda"}
                    </button>

                    {/* Botón Denegar */}
                    <button
                      type="button"
                      disabled={esProcesando || item.status === "denegado"}
                      onClick={() => handleCambiarEstado(item, "denegado")}
                      className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition ${
                        item.status === "denegado"
                          ? "bg-red-100 text-red-800 border border-red-300 opacity-60 cursor-default"
                          : "bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow"
                      }`}
                      title="Denegar inscripción del jugador (no podrá jugar)"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {item.status === "denegado" ? "Denegado" : "Denegar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
