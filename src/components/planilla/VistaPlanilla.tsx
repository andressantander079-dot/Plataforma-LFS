import { CheckCircle2, Clock, FileText, ShieldCheck, Star } from "lucide-react";
import type { PlanillaCompleta, EventoPlanilla } from "@/lib/actions/planilla.actions";

/**
 * VISTA DE LA PLANILLA OFICIAL — presentación e impresión.
 * La usan el club (descarga), el árbitro y la federación.
 */

function fechaLinda(iso: string | null): string {
  if (!iso) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const ETIQUETA_EVENTO: Record<EventoPlanilla["tipo"], string> = {
  gol: "Gol",
  gol_en_contra: "Gol en contra",
  amarilla: "Tarjeta amarilla",
  roja: "Tarjeta roja",
  cambio: "Cambio",
};

export function descripcionEvento(e: EventoPlanilla): string {
  if (e.tipo === "cambio") {
    return `Entra ${e.jugadorNombre} por ${e.relacionadoNombre ?? "otro jugador"}`;
  }
  return `${ETIQUETA_EVENTO[e.tipo]} — ${e.jugadorNombre}`;
}

export function EstadoPlanillaBadge({ status }: { status: string | null }) {
  if (status === "aprobada") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700">
        <ShieldCheck className="w-3.5 h-3.5" /> Planilla aprobada
      </span>
    );
  }
  if (status === "confirmada") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
        <CheckCircle2 className="w-3.5 h-3.5" /> Confirmada por ambos clubes
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
      <Clock className="w-3.5 h-3.5" /> {status === "borrador" ? "En carga" : "Sin planilla"}
    </span>
  );
}

function ColumnaEquipo({
  titulo,
  convocados,
  teamId,
}: {
  titulo: string;
  convocados: PlanillaCompleta["convocados"];
  teamId: string;
}) {
  const mios = convocados.filter((c) => c.teamId === teamId);
  const titulares = mios.filter((c) => c.esTitular);
  const suplentes = mios.filter((c) => !c.esTitular);

  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:border-slate-400">
      <p className="px-4 py-2.5 bg-[#1A2A44] text-white font-bold text-sm print:bg-slate-200 print:text-black">
        {titulo} ({mios.length})
      </p>
      {mios.length === 0 && (
        <p className="text-xs text-slate-400 px-4 py-4">Sin jugadores cargados.</p>
      )}
      {titulares.length > 0 && (
        <div className="px-4 pt-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-[#F97316] mb-1.5">
            Titulares
          </p>
          <ul className="flex flex-col divide-y divide-slate-100">
            {titulares.map((c) => (
              <li key={c.id} className="py-1.5 flex items-center gap-2 text-sm">
                <Star className="w-3 h-3 text-[#F97316] shrink-0" fill="currentColor" />
                <span className="font-bold text-[#1A2A44] flex-1">{c.nombre}</span>
                <span className="text-[10px] text-slate-400">DNI {c.dni}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {suplentes.length > 0 && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
            Suplentes
          </p>
          <ul className="flex flex-col divide-y divide-slate-100">
            {suplentes.map((c) => (
              <li key={c.id} className="py-1.5 flex items-center gap-2 text-sm">
                <span className="w-3 shrink-0" />
                <span className="font-bold text-[#1A2A44] flex-1">{c.nombre}</span>
                <span className="text-[10px] text-slate-400">DNI {c.dni}</span>
                {c.agregadoPor !== "club" && (
                  <span className="text-[9px] font-bold text-sky-600 bg-sky-50 rounded px-1.5 py-0.5">
                    {c.agregadoPor === "arbitro" ? "Agregado por el árbitro" : "Agregado por la federación"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function VistaPlanilla({ planilla }: { planilla: PlanillaCompleta }) {
  const hayResultado = planilla.homeScore !== null && planilla.awayScore !== null;

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado oficial */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 print:border-slate-400">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-[#F97316]" />
          <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Liga de Fútsal de Ushuaia · Planilla oficial de partido
          </p>
          <span className="ml-auto print:hidden">
            <EstadoPlanillaBadge status={planilla.sheet?.status ?? null} />
          </span>
        </div>
        <h1 className="font-serif text-xl font-black text-[#1A2A44]">
          {planilla.torneo} · {planilla.categoria}
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Temporada {planilla.temporada}
          {planilla.matchday !== null && ` · Fecha ${planilla.matchday}`} ·{" "}
          {fechaLinda(planilla.scheduledAt)} · Cancha: {planilla.cancha ?? "A definir"} · Árbitro:{" "}
          {planilla.arbitro ?? "A definir"}
        </p>

        <div className="mt-4 flex items-center gap-3">
          <span className="flex-1 text-right font-serif text-lg font-black text-[#1A2A44] truncate">
            {planilla.local}
          </span>
          <span className="shrink-0 font-black text-xl bg-[#1A2A44] text-white rounded-xl px-4 py-1.5 print:bg-slate-200 print:text-black">
            {hayResultado ? `${planilla.homeScore} - ${planilla.awayScore}` : "VS"}
          </span>
          <span className="flex-1 font-serif text-lg font-black text-[#1A2A44] truncate">
            {planilla.visitante}
          </span>
        </div>
      </div>

      {/* Jugadores por equipo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
        <ColumnaEquipo titulo={planilla.local} convocados={planilla.convocados} teamId={planilla.homeTeamId} />
        <ColumnaEquipo titulo={planilla.visitante} convocados={planilla.convocados} teamId={planilla.awayTeamId} />
      </div>

      {/* Eventos */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden print:border-slate-400">
        <p className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#1A2A44] uppercase tracking-wider">
          Goles, tarjetas y cambios ({planilla.eventos.length})
        </p>
        {planilla.eventos.length === 0 && (
          <p className="text-xs text-slate-400 px-4 py-4">Todavía no hay eventos cargados.</p>
        )}
        <ul className="divide-y divide-slate-100">
          {planilla.eventos.map((e) => (
            <li key={e.id} className="px-4 py-2 flex items-center gap-3 text-sm">
              <span className="w-10 text-center shrink-0 text-[11px] font-black text-[#F97316]">
                {e.minuto !== null ? `${e.minuto}'` : "—"}
              </span>
              <span className="font-bold text-[#1A2A44]">{descripcionEvento(e)}</span>
              <span className="ml-auto text-[10px] font-bold text-slate-400">
                {e.teamId === planilla.homeTeamId ? planilla.local : planilla.visitante}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Firmas (solo impresión) */}
      <div className="hidden print:grid grid-cols-3 gap-6 mt-8 text-center text-xs text-slate-600">
        <div className="border-t border-slate-400 pt-2">Firma árbitro</div>
        <div className="border-t border-slate-400 pt-2">Capitán {planilla.local}</div>
        <div className="border-t border-slate-400 pt-2">Capitán {planilla.visitante}</div>
      </div>
    </div>
  );
}
