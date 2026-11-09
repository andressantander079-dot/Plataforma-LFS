import Link from "next/link";
import { MapPin, Radio, ArrowLeft, Clock } from "lucide-react";
import { obtenerSeccionEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import type { PartidoEnVivoHome } from "@/components/transmision/SeccionEnVivo";

export const dynamic = "force-dynamic";

/**
 * EN VIVO — Paso 17C
 * Lista pública de los partidos que se están jugando (puede haber
 * varios a la vez, en distintas canchas), con categoría, cancha y
 * árbitros. Sin login: la vive todo el mundo.
 */
export default async function EnVivoPage() {
  const res = await obtenerSeccionEnVivo();
  const datos = (res.data ?? { enVivo: [], proximosHoy: [], ultimosResultados: [] }) as unknown as {
    enVivo: PartidoEnVivoHome[];
    proximosHoy: PartidoEnVivoHome[];
    ultimosResultados: PartidoEnVivoHome[];
  };

  const hora = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "America/Argentina/Ushuaia",
        })
      : null;

  const renderTarjeta = (p: PartidoEnVivoHome, vivo: boolean) => (
    <Link
      key={p.id}
      href={`/en-vivo/${p.id}`}
      className={`block rounded-2xl border-2 p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 ${
        vivo ? "border-red-300 bg-gradient-to-br from-red-50 to-white" : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {p.categoria ?? p.torneo ?? "LFS"}
        </span>
        {vivo ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-600">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
            </span>
            EN VIVO
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-black text-slate-400">
            <Clock className="w-3.5 h-3.5" /> {hora(p.scheduled_at)} hs
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 items-center mb-2">
        <span className="font-bold text-[#1A2A44] text-right truncate">{p.local}</span>
        <span className="font-mono text-2xl font-black text-center text-[#1A2A44] tabular-nums">
          {p.home_score ?? 0} - {p.away_score ?? 0}
        </span>
        <span className="font-bold text-[#1A2A44] truncate">{p.visitante}</span>
      </div>
      <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
        {p.cancha && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {p.cancha}
          </span>
        )}
        {p.arbitro && <span>Árbitro: {p.arbitro}</span>}
      </div>
    </Link>
  );

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="bg-[#1A2A44] border-b-4 border-[#F97316]">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white text-xs font-bold transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al inicio
          </Link>
          <h1 className="font-serif text-3xl font-black text-white flex items-center gap-3">
            <Radio className="w-8 h-8 text-red-500 animate-pulse" />
            Fútsal en vivo
          </h1>
          <p className="text-slate-300 text-sm mt-1">
            Liga de Fútsal de Ushuaia · Transmisión minuto a minuto
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section>
          <h2 className="text-xs font-black uppercase tracking-widest text-red-600 mb-3">
            Jugándose ahora
          </h2>
          {datos.enVivo.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-4xl mb-2">🏟️</p>
              <p className="font-bold text-slate-600">Ahora mismo no hay partidos en juego.</p>
              <p className="text-sm text-slate-400">
                Cuando arranque uno, aparece acá automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datos.enVivo.map((p) => renderTarjeta(p, true))}
            </div>
          )}
        </section>

        {datos.proximosHoy.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
              Hoy en las canchas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datos.proximosHoy.map((p) => renderTarjeta(p, false))}
            </div>
          </section>
        )}

        {datos.ultimosResultados.length > 0 && (
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">
              Últimos resultados
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {datos.ultimosResultados.map((p) => renderTarjeta(p, false))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
