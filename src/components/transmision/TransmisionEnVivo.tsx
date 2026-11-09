"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  Eye,
  Share2,
  Star,
  Radio,
  Volume2,
  VolumeX,
  MapPin,
  Users,
} from "lucide-react";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import { obtenerTransmision } from "@/lib/actions/planilla-en-vivo.actions";
import { formatoReloj, segundosRestantes, type EstadoReloj } from "@/lib/core/rules/relojRules";
import { sonarGol, sonarSilbato, sonarTarjeta } from "@/components/transmision/sonidos";
import { etiquetaFase } from "@/lib/core/rules/relojRules";

/**
 * TRANSMISIÓN EN VIVO — Paso 17C (vista pública)
 * El partido se vive acá: marcador al instante, papelitos en los goles,
 * sonido de gol y silbato, modales animados que anuncian cada evento,
 * banner de cambio de tiempo, reacciones del público, contador de
 * espectadores y botón de compartir por WhatsApp.
 */

interface EventoPublico {
  id: string;
  tipo: string;
  minuto: number | null;
  tiempo: "PT" | "ST" | null;
  minutoTotal: number | null;
  teamId: string;
  jugador: string | null;
  relacionado: string | null;
  asistente: string | null;
  createdAt: string;
}

interface ConvocadoPublico {
  playerId: string;
  nombre: string;
  teamId: string;
  esTitular: boolean;
  numero: number | null;
}

interface DatosTransmision {
  partido: {
    id: string;
    estado: string;
    liveStatus: EstadoReloj["fase"];
    relojCorriendo: boolean;
    relojIniciadoAt: string | null;
    relojSegundosBase: number;
    duracionTiempoMin: number;
    duracionEntretiempoMin: number;
    homeScore: number | null;
    awayScore: number | null;
    scheduledAt: string | null;
    colorLocal: string | null;
    colorVisitante: string | null;
    local: string;
    visitante: string;
    categoria: string | null;
    torneo: string | null;
    cancha: string | null;
    arbitroPrincipal: string | null;
    oficiales: { rol: string; nombre: string }[];
    motivoEstado: string | null;
  };
  eventos: EventoPublico[];
  convocados: ConvocadoPublico[];
  figura: string | null;
}

interface Anuncio {
  clave: number;
  titulo: string;
  detalle: string;
  tipo: "gol" | "tarjeta" | "cambio" | "tiempo" | "estado" | "falta";
}

const EMOJIS_REACCION = ["⚽", "🔥", "👏", "😮", "❤️"];

export function TransmisionEnVivo({
  matchId,
  datosIniciales,
}: {
  matchId: string;
  datosIniciales: DatosTransmision;
}) {
  const [datos, setDatos] = useState(datosIniciales);
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [reacciones, setReacciones] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [espectadores, setEspectadores] = useState(1);
  const [mute, setMute] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const eventosVistosRef = useRef<Set<string>>(new Set(datosIniciales.eventos.map((e) => e.id)));
  const faseAnteriorRef = useRef(datosIniciales.partido.liveStatus);
  const muteRef = useRef(false);
  const contadorReaccion = useRef(0);

  useEffect(() => {
    muteRef.current = mute;
  }, [mute]);

  const { homeTeamIdDetectado, awayTeamIdDetectado } = useMemo(() => {
    // El RPC no expone ids de equipos al público; los inferimos de los eventos/convocados.
    const equiposConvocados = [...new Set(datos.convocados.map((c) => c.teamId))];
    return {
      homeTeamIdDetectado: equiposConvocados[0] ?? null,
      awayTeamIdDetectado: equiposConvocados[1] ?? null,
    };
  }, [datos.convocados]);

  const anunciar = useCallback((a: Omit<Anuncio, "clave">) => {
    setAnuncio({ ...a, clave: Date.now() });
    setTimeout(() => setAnuncio((actual) => (actual?.titulo === a.titulo ? null : actual)), 4500);
  }, []);

  const lanzarPapelitos = useCallback(() => {
    const colores = ["#F97316", "#1A2A44", "#FFD700", "#ffffff"];
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.65 }, colors: colores });
    setTimeout(
      () => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: colores }),
      250
    );
    setTimeout(
      () => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: colores }),
      400
    );
  }, []);

  const refrescar = useCallback(async () => {
    const res = await obtenerTransmision(matchId);
    if (res.data) setDatos(res.data as unknown as DatosTransmision);
  }, [matchId]);

  // Reloj local
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Realtime: eventos + estado del partido + reacciones + presencia
  useEffect(() => {
    const supabase = createLfsClient();
    const canal = supabase
      .channel(`transmision-${matchId}`, { config: { presence: { key: crypto.randomUUID() } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `match_id=eq.${matchId}` },
        () => void refrescar()
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
        () => void refrescar()
      )
      .on("broadcast", { event: "reaccion" }, ({ payload }) => {
        const emoji = (payload as { emoji?: string })?.emoji;
        if (emoji) agregarReaccionFlotante(emoji);
      })
      .on("presence", { event: "sync" }, () => {
        const estado = canal.presenceState();
        setEspectadores(Math.max(1, Object.keys(estado).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await canal.track({ mirando: true });
      });

    canalRef.current = canal;
    return () => {
      void supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, refrescar]);

  const canalRef = useRef<ReturnType<ReturnType<typeof createLfsClient>["channel"]> | null>(null);

  // Detectar eventos NUEVOS para anunciarlos con modal + sonido + confetti
  useEffect(() => {
    for (const e of datos.eventos) {
      if (eventosVistosRef.current.has(e.id)) continue;
      eventosVistosRef.current.add(e.id);

      const minutoTxt = e.minuto ? `${e.minuto}' ${e.tiempo ?? "PT"}` : "";
      if (e.tipo === "gol") {
        anunciar({
          titulo: "¡GOOOOL!",
          detalle: `${e.jugador ?? ""} ${e.asistente ? `(asist. ${e.asistente})` : ""} ${minutoTxt}`.trim(),
          tipo: "gol",
        });
        lanzarPapelitos();
        if (!muteRef.current) sonarGol();
      } else if (e.tipo === "gol_en_contra") {
        anunciar({ titulo: "¡GOL EN CONTRA!", detalle: `${e.jugador ?? ""} ${minutoTxt}`.trim(), tipo: "gol" });
        lanzarPapelitos();
        if (!muteRef.current) sonarGol();
      } else if (e.tipo === "amarilla") {
        anunciar({ titulo: "🟨 Amarilla", detalle: `${e.jugador ?? ""} ${minutoTxt}`.trim(), tipo: "tarjeta" });
        if (!muteRef.current) sonarTarjeta();
      } else if (e.tipo === "roja") {
        anunciar({ titulo: "🟥 ¡EXPULSADO!", detalle: `${e.jugador ?? ""} ${minutoTxt}`.trim(), tipo: "tarjeta" });
        if (!muteRef.current) sonarTarjeta();
      } else if (e.tipo === "cambio") {
        anunciar({
          titulo: "🔁 Cambio",
          detalle: `Entra ${e.jugador ?? "—"} por ${e.relacionado ?? "—"}`,
          tipo: "cambio",
        });
      } else if (e.tipo === "tiempo_muerto") {
        anunciar({ titulo: "⏱️ Tiempo pedido", detalle: "60 segundos de descanso", tipo: "tiempo" });
      }
    }
  }, [datos.eventos, anunciar, lanzarPapelitos]);

  // Banner de cambio de tiempo
  useEffect(() => {
    const anterior = faseAnteriorRef.current;
    const actual = datos.partido.liveStatus;
    if (anterior === actual) return;
    faseAnteriorRef.current = actual;
    if (actual === "entretiempo") {
      anunciar({ titulo: "☕ ENTRETIEMPO", detalle: "Descanso de los equipos", tipo: "estado" });
      if (!muteRef.current) sonarSilbato();
    } else if (actual === "segundo_tiempo") {
      anunciar({ titulo: "▶️ ¡SEGUNDO TIEMPO!", detalle: "Se reanuda el partido", tipo: "estado" });
      if (!muteRef.current) sonarSilbato();
    } else if (actual === "finalizado") {
      anunciar({ titulo: "🏁 ¡FINAL DEL PARTIDO!", detalle: "Gracias por seguir la transmisión", tipo: "estado" });
      lanzarPapelitos();
      if (!muteRef.current) sonarSilbato();
    }
  }, [datos.partido.liveStatus, anunciar, lanzarPapelitos]);

  function agregarReaccionFlotante(emoji: string) {
    contadorReaccion.current += 1;
    const id = contadorReaccion.current;
    const x = 10 + Math.random() * 80;
    setReacciones((prev) => [...prev.slice(-15), { id, emoji, x }]);
    setTimeout(() => setReacciones((prev) => prev.filter((r) => r.id !== id)), 3500);
  }

  const reaccionar = (emoji: string) => {
    agregarReaccionFlotante(emoji);
    void canalRef.current?.send({ type: "broadcast", event: "reaccion", payload: { emoji } });
  };

  const compartirWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const texto = `⚽ ¡Mirá el partido EN VIVO! ${datos.partido.local} vs ${datos.partido.visitante} — Liga de Fútsal de Ushuaia`;
    window.open(`https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`, "_blank");
  };

  const estadoReloj: EstadoReloj = {
    fase: datos.partido.liveStatus,
    corriendo: datos.partido.relojCorriendo,
    iniciadoAt: datos.partido.relojIniciadoAt,
    segundosBase: datos.partido.relojSegundosBase,
    duracionTiempoMin: datos.partido.duracionTiempoMin,
    duracionEntretiempoMin: datos.partido.duracionEntretiempoMin,
  };
  const mostrarReloj =
    datos.partido.liveStatus === "primer_tiempo" ||
    datos.partido.liveStatus === "segundo_tiempo" ||
    datos.partido.liveStatus === "entretiempo";

  // Marcador en vivo desde eventos
  const marcadorEventos = useMemo(() => {
    let local = 0;
    let visitante = 0;
    for (const e of datos.eventos) {
      const esLocal = homeTeamIdDetectado ? e.teamId === homeTeamIdDetectado : false;
      if (e.tipo === "gol") {
        if (esLocal) local += 1;
        else visitante += 1;
      } else if (e.tipo === "gol_en_contra") {
        if (esLocal) visitante += 1;
        else local += 1;
      }
    }
    return { local, visitante };
  }, [datos.eventos, homeTeamIdDetectado]);

  const finalizado = datos.partido.liveStatus === "finalizado";
  const golesL = finalizado ? (datos.partido.homeScore ?? 0) : marcadorEventos.local;
  const golesV = finalizado ? (datos.partido.awayScore ?? 0) : marcadorEventos.visitante;

  const iconoEvento = (tipo: string) =>
    tipo === "gol" ? "⚽" : tipo === "gol_en_contra" ? "😅" : tipo === "amarilla" ? "🟨" : tipo === "roja" ? "🟥" : tipo === "cambio" ? "🔁" : tipo === "falta" ? "🛑" : "⏱️";

  const textoEvento = (e: EventoPublico) => {
    switch (e.tipo) {
      case "gol":
        return `¡Gol de ${e.jugador}!${e.asistente ? ` (asist. ${e.asistente})` : ""}`;
      case "gol_en_contra":
        return `Gol en contra de ${e.jugador}`;
      case "amarilla":
        return `Amarilla a ${e.jugador}`;
      case "roja":
        return `¡Roja a ${e.jugador}!`;
      case "cambio":
        return `Entra ${e.jugador} por ${e.relacionado ?? "—"}`;
      case "falta":
        return `Falta de ${e.jugador}`;
      case "tiempo_muerto":
        return "Tiempo pedido";
      default:
        return e.tipo;
    }
  };

  return (
    <div className="min-h-screen bg-[#0d1526] text-white relative overflow-hidden">
      {/* ANUNCIO ANIMADO (modal de evento) */}
      {anuncio && (
        <div
          key={anuncio.clave}
          className="fixed inset-x-0 top-20 z-50 flex justify-center px-4 pointer-events-none"
        >
          <div
            className={`rounded-3xl px-8 py-5 shadow-2xl text-center animate-bounce border-2 ${
              anuncio.tipo === "gol"
                ? "bg-green-600 border-green-300"
                : anuncio.tipo === "tarjeta"
                  ? "bg-red-600 border-red-300"
                  : anuncio.tipo === "estado"
                    ? "bg-[#F97316] border-orange-300"
                    : "bg-[#1A2A44] border-slate-400"
            }`}
          >
            <p className="font-black text-2xl md:text-4xl tracking-tight">{anuncio.titulo}</p>
            <p className="font-bold text-sm md:text-base opacity-90">{anuncio.detalle}</p>
          </div>
        </div>
      )}

      {/* Reacciones flotantes */}
      {reacciones.map((r) => (
        <span
          key={r.id}
          className="fixed bottom-24 text-4xl pointer-events-none animate-ping z-40"
          style={{ left: `${r.x}%`, animationDuration: "3s" }}
        >
          {r.emoji}
        </span>
      ))}

      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="font-black text-sm uppercase tracking-widest text-red-400">
              {finalizado ? "Finalizado" : "En vivo"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-300">
              <Eye className="w-3.5 h-3.5" /> {espectadores}
            </span>
            <button
              type="button"
              onClick={() => setMute((m) => !m)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              title={mute ? "Activar sonido" : "Silenciar"}
            >
              {mute ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={compartirWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-600 hover:bg-green-700 px-3 py-1.5 text-xs font-black transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </button>
          </div>
        </div>

        {/* Info del partido */}
        <div className="text-center flex flex-col gap-1">
          <p className="text-xs font-bold text-slate-400">
            {datos.partido.torneo}
            {datos.partido.categoria ? ` · ${datos.partido.categoria}` : ""}
          </p>
          {datos.partido.cancha && (
            <p className="text-[11px] text-slate-500 inline-flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3" /> {datos.partido.cancha}
            </p>
          )}
        </div>

        {/* MARCADOR GIGANTE */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur">
          <div className="grid grid-cols-3 items-center">
            <div className="flex flex-col items-center gap-2">
              <span
                className="w-14 h-14 rounded-2xl shadow-lg border-2 border-white/20"
                style={{ backgroundColor: datos.partido.colorLocal ?? "#1A2A44" }}
              />
              <span className="font-black text-sm text-center leading-tight">{datos.partido.local}</span>
            </div>
            <div className="text-center flex flex-col items-center gap-1">
              <span className="font-mono text-6xl md:text-7xl font-black tabular-nums tracking-tight">
                {golesL} - {golesV}
              </span>
              <span
                className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                  datos.partido.liveStatus === "entretiempo"
                    ? "bg-amber-400/20 text-amber-300"
                    : finalizado
                      ? "bg-slate-500/30 text-slate-300"
                      : "bg-green-400/20 text-green-300"
                }`}
              >
                {etiquetaFase(datos.partido.liveStatus)}
              </span>
              {mostrarReloj && (
                <span className="font-mono text-2xl font-black text-slate-300 tabular-nums">
                  {formatoReloj(segundosRestantes(estadoReloj, ahora))}
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <span
                className="w-14 h-14 rounded-2xl shadow-lg border-2 border-white/20"
                style={{ backgroundColor: datos.partido.colorVisitante ?? "#F97316" }}
              />
              <span className="font-black text-sm text-center leading-tight">{datos.partido.visitante}</span>
            </div>
          </div>
          {datos.partido.motivoEstado && finalizado && datos.partido.estado !== "jugado" && (
            <p className="text-center text-xs text-red-300 font-bold mt-3">
              {datos.partido.estado === "wo" ? "Ausencia (gana el rival)" : "Suspendido"}:{" "}
              {datos.partido.motivoEstado}
            </p>
          )}
        </div>

        {/* FIGURA DEL PARTIDO */}
        {finalizado && datos.figura && (
          <div className="bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-400/40 rounded-2xl p-4 flex items-center gap-3">
            <Star className="w-8 h-8 text-amber-400 shrink-0" />
            <div>
              <p className="text-[10px] font-black text-amber-300 uppercase tracking-widest">
                Figura del partido
              </p>
              <p className="font-black text-lg text-amber-100">{datos.figura}</p>
            </div>
          </div>
        )}

        {/* REACCIONES */}
        <div className="flex justify-center gap-3">
          {EMOJIS_REACCION.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => reaccionar(emoji)}
              className="text-2xl bg-white/10 hover:bg-white/25 rounded-full w-12 h-12 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* TIMELINE */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col gap-3">
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-300 flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-400" /> Minuto a minuto
          </h3>
          {datos.eventos.length === 0 ? (
            <p className="text-xs text-slate-500 italic text-center py-4">
              Todavía no pasó nada... ¡quedate que arranca!
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {[...datos.eventos].reverse().map((e) => (
                <div key={e.id} className="flex items-center gap-3 text-sm border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black text-slate-500 w-12 shrink-0 tabular-nums">
                    {e.minuto ? `${e.minuto}'` : "—"}
                  </span>
                  <span className="shrink-0 text-base">{iconoEvento(e.tipo)}</span>
                  <span className="flex-1 text-slate-200">{textoEvento(e)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FORMACIONES */}
        {datos.convocados.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-3xl p-5 flex flex-col gap-3">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> Formaciones
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { nombre: datos.partido.local, teamId: homeTeamIdDetectado },
                { nombre: datos.partido.visitante, teamId: awayTeamIdDetectado },
              ].map((equipo) => (
                <div key={equipo.nombre} className="flex flex-col gap-1">
                  <p className="text-xs font-black text-slate-400 mb-1">{equipo.nombre}</p>
                  {datos.convocados
                    .filter((c) => c.teamId === equipo.teamId && c.esTitular)
                    .map((c) => (
                      <p key={c.playerId} className="text-xs text-slate-300 truncate">
                        <span className="font-black text-slate-500 mr-1.5">{c.numero ?? "—"}</span>
                        {c.nombre}
                      </p>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OFICIALES */}
        <div className="text-center text-[11px] text-slate-500 flex flex-col gap-0.5">
          {datos.partido.arbitroPrincipal && <p>Árbitro: {datos.partido.arbitroPrincipal}</p>}
          {datos.partido.oficiales.map((o) => (
            <p key={o.rol}>
              {o.rol === "segundo_arbitro" ? "2do árbitro" : "Planillero"}: {o.nombre}
            </p>
          ))}
          <p className="mt-2 text-slate-600">Liga de Fútsal de Ushuaia · Transmisión oficial</p>
        </div>
      </div>
    </div>
  );
}
