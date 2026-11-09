"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Radio, Trophy, Clock } from "lucide-react";
import { obtenerSeccionEnVivo } from "@/lib/actions/planilla-en-vivo.actions";

/**
 * SECCIÓN EN VIVO DE LA HOME — Paso 17C
 * La pelota que pica invita a entrar; al lado, las tarjetas de los
 * partidos en vivo (categoría, cancha y árbitros), los próximos de hoy
 * y los últimos resultados. Se actualiza sola cada 30 segundos.
 */

export interface PartidoEnVivoHome {
  id: string;
  status: string;
  live_status: string;
  scheduled_at: string | null;
  home_score: number | null;
  away_score: number | null;
  local: string;
  visitante: string;
  categoria: string | null;
  torneo: string | null;
  cancha: string | null;
  arbitro: string | null;
}

export interface DatosSeccion {
  enVivo: PartidoEnVivoHome[];
  proximosHoy: PartidoEnVivoHome[];
  ultimosResultados: PartidoEnVivoHome[];
}

/** Pelota de futsal que pica (animación CSS pura). */
function PelotaQuePica() {
  return (
    <div className="relative h-24 w-24 mx-auto" aria-hidden>
      <div
        className="w-16 h-16 rounded-full mx-auto shadow-xl border-4 border-slate-800"
        style={{
          background:
            "radial-gradient(circle at 32px 28px, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)",
          animation: "lfs-pelota-pica 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite alternate",
        }}
      >
        {/* Gajos de la pelota */}
        <div className="w-full h-full rounded-full overflow-hidden opacity-80 flex items-center justify-center">
          <div className="w-5 h-5 bg-slate-800 rotate-45 rounded-sm" />
        </div>
      </div>
      {/* Sombra que crece y achica */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2 rounded-full bg-black/30 blur-sm"
        style={{ animation: "lfs-pelota-sombra 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite alternate" }}
      />
      <style jsx>{`
        @keyframes lfs-pelota-pica {
          0% {
            transform: translateY(-52px) scale(1);
          }
          92% {
            transform: translateY(6px) scale(1.02, 0.98);
          }
          100% {
            transform: translateY(8px) scale(1.06, 0.9);
          }
        }
        @keyframes lfs-pelota-sombra {
          0% {
            width: 28px;
            opacity: 0.25;
          }
          100% {
            width: 58px;
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}

function TarjetaPartido({ p, vivo }: { p: PartidoEnVivoHome; vivo: boolean }) {
  const hora = p.scheduled_at
    ? new Date(p.scheduled_at).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Ushuaia",
      })
    : null;

  return (
    <Link
      href={`/en-vivo/${p.id}`}
      className={`flex flex-col gap-2 rounded-2xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        vivo
          ? "border-red-300 bg-gradient-to-br from-red-50 to-white"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {p.categoria ?? p.torneo ?? "LFS"}
        </span>
        {vivo ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            EN VIVO
          </span>
        ) : (
          hora && (
            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-400">
              <Clock className="w-3 h-3" /> {hora} hs
            </span>
          )
        )}
      </div>

      <div className="grid grid-cols-3 items-center">
        <span className="font-bold text-sm text-[#1A2A44] text-right truncate">{p.local}</span>
        <span className="font-mono text-xl font-black text-center text-[#1A2A44] tabular-nums">
          {p.home_score ?? 0} - {p.away_score ?? 0}
        </span>
        <span className="font-bold text-sm text-[#1A2A44] truncate">{p.visitante}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
        {p.cancha && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {p.cancha}
          </span>
        )}
        {p.arbitro && <span>Árbitro: {p.arbitro}</span>}
      </div>
    </Link>
  );
}

export function SeccionEnVivo({ datosIniciales }: { datosIniciales: DatosSeccion }) {
  const [datos, setDatos] = useState(datosIniciales);

  useEffect(() => {
    const refrescar = async () => {
      const res = await obtenerSeccionEnVivo();
      if (res.data) setDatos(res.data as unknown as DatosSeccion);
    };
    const id = setInterval(refrescar, 30_000);
    return () => clearInterval(id);
  }, []);

  const hayAlgo =
    datos.enVivo.length > 0 || datos.proximosHoy.length > 0 || datos.ultimosResultados.length > 0;
  if (!hayAlgo) return null;

  return (
    <section className="bg-gradient-to-br from-slate-900 via-[#1A2A44] to-slate-900 rounded-2xl p-6 md:p-8 text-white border border-slate-700 shadow-xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/en-vivo" title="Ver todos los partidos en vivo" className="shrink-0">
          <PelotaQuePica />
        </Link>
        <div>
          <h3 className="font-serif text-2xl md:text-3xl font-black flex items-center gap-2">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            Fútsal en vivo
          </h3>
          <p className="text-slate-300 text-sm">
            Seguí los partidos minuto a minuto: goles con papelitos, tarjetas, cambios y más.
          </p>
        </div>
      </div>

      {datos.enVivo.length > 0 && (
        <div className="mb-6">
          <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-3">
            Jugándose ahora
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {datos.enVivo.map((p) => (
              <TarjetaPartido key={p.id} p={p} vivo />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {datos.proximosHoy.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
              Hoy en las canchas
            </p>
            <div className="flex flex-col gap-2">
              {datos.proximosHoy.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
                >
                  <span className="font-mono text-sm font-black text-[#F97316] w-14 shrink-0">
                    {p.scheduled_at
                      ? new Date(p.scheduled_at).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Argentina/Ushuaia",
                        })
                      : "—"}
                  </span>
                  <span className="flex-1 text-sm font-semibold truncate">
                    {p.local} vs {p.visitante}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">{p.cancha}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {datos.ultimosResultados.length > 0 && (
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Últimos resultados
            </p>
            <div className="flex flex-col gap-2">
              {datos.ultimosResultados.map((p) => (
                <Link
                  key={p.id}
                  href={`/en-vivo/${p.id}`}
                  className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 hover:bg-white/10 transition-colors"
                >
                  <span className="flex-1 text-sm font-semibold truncate">
                    {p.local} vs {p.visitante}
                  </span>
                  <span className="font-mono text-sm font-black tabular-nums">
                    {p.home_score ?? 0} - {p.away_score ?? 0}
                  </span>
                  <span className="text-[10px] text-slate-400">{p.categoria}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
