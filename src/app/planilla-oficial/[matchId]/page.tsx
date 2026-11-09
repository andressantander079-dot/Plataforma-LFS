import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obtenerPlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import { BotonImprimir } from "@/components/planilla/BotonImprimir";
import { QrValidacion } from "@/components/planilla-vivo/QrValidacion";
import { ETIQUETA_ROL, type MapaFirmas, type RolFirma } from "@/lib/core/rules/firmasRules";
import { formatearMinuto } from "@/lib/core/rules/planillaPremiumRules";

export const dynamic = "force-dynamic";

/**
 * PLANILLA OFICIAL IMPRIMIBLE — Paso 17C
 * Hoja A4 premium: equipos, resultado, goleadores con asistencias,
 * disciplina, faltas, cambios, cuerpo técnico, observaciones, FIRMAS
 * digitales con nombre y el QR de validación que abre la planilla
 * digital pública. Acceso: federación, clubes del partido y oficiales.
 */

const ORDEN_FIRMAS: RolFirma[] = [
  "capitan_local",
  "capitan_visitante",
  "dt_local",
  "dt_visitante",
  "principal",
  "segundo_arbitro",
  "planillero",
];

export default async function PlanillaOficialPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const res = await obtenerPlanillaEnVivo(matchId);
  if (res.error || !res.data) redirect("/");

  const p = res.data;
  const esInvolucrado =
    p.esAdmin ||
    p.esPrincipal ||
    p.esSegundo ||
    p.esPlanillero ||
    (p.miClubId !== null && (p.miClubId === p.clubLocalId || p.miClubId === p.clubVisitanteId));
  if (!esInvolucrado) redirect("/");

  // Firmas: URLs firmadas (bucket privado) con vencimiento corto
  const firmas = (p.firmas ?? {}) as MapaFirmas;
  const urlsFirmas: Partial<Record<RolFirma, string>> = {};
  const admin = createLfsAdminClient();
  for (const rol of ORDEN_FIRMAS) {
    const firma = firmas[rol];
    if (firma?.firmo && firma.path) {
      const { data } = await admin.storage
        .from("firmas-planillas")
        .createSignedUrl(firma.path, 60 * 30);
      if (data?.signedUrl) urlsFirmas[rol] = data.signedUrl;
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://liga-futsal-ushuaia.app";
  const urlValidacion = `${siteUrl}/en-vivo/${matchId}`;

  const fecha = p.scheduledAt
    ? new Date(p.scheduledAt).toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Ushuaia",
      })
    : "—";

  const goles = p.eventos.filter((e) => e.tipo === "gol" || e.tipo === "gol_en_contra");
  const tarjetas = p.eventos.filter((e) => e.tipo === "amarilla" || e.tipo === "roja");
  const faltas = p.eventos.filter((e) => e.tipo === "falta");
  const cambios = p.eventos.filter((e) => e.tipo === "cambio");
  const tiempos = p.eventos.filter((e) => e.tipo === "tiempo_muerto");

  const nombreEquipo = (teamId: string) => (teamId === p.homeTeamId ? p.local : p.visitante);

  const estadoTxt =
    p.statusPartido === "wo"
      ? `AUSENCIA (gana el rival) — no se presentó ${p.ausenteTeamId === p.homeTeamId ? p.local : p.visitante}`
      : p.statusPartido === "suspendido"
        ? "PARTIDO SUSPENDIDO"
        : null;

  return (
    <main className="min-h-screen bg-slate-200 print:bg-white py-6 print:py-0">
      <div className="max-w-3xl mx-auto px-4 mb-4 flex items-center gap-3 print:hidden">
        <Link
          href={p.esAdmin ? `/admin/planillas/${matchId}` : `/arbitro/planillas/${matchId}`}
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#1A2A44] text-xs font-bold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver
        </Link>
        <div className="ml-auto">
          <BotonImprimir />
        </div>
      </div>

      {/* HOJA A4 */}
      <div className="max-w-3xl mx-auto bg-white shadow-2xl print:shadow-none px-8 py-8 text-slate-800">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b-4 border-[#1A2A44] pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#1A2A44] rounded-xl flex items-center justify-center text-[#F97316] font-black text-lg">
              LFS
            </div>
            <div>
              <h1 className="font-serif text-xl font-black text-[#1A2A44] leading-tight">
                Planilla Oficial de Partido
              </h1>
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">
                Liga de Fútsal de Ushuaia
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-slate-500">
            <p className="capitalize font-bold text-slate-700">{fecha}</p>
            <p>{p.torneo} · {p.categoria}</p>
            {p.cancha && <p>{p.cancha}</p>}
          </div>
        </div>

        {estadoTxt && (
          <div className="bg-red-50 border border-red-300 rounded-lg px-4 py-2 mb-4 text-center">
            <p className="text-xs font-black text-red-700 uppercase">{estadoTxt}</p>
            {p.motivoEstado && <p className="text-[11px] text-red-600">{p.motivoEstado}</p>}
          </div>
        )}

        {/* Marcador */}
        <div className="grid grid-cols-3 items-center bg-[#1A2A44] text-white rounded-xl px-6 py-4 mb-5">
          <div className="text-center">
            <p className="font-black text-sm leading-tight">{p.local}</p>
            <p className="text-[10px] text-slate-300 uppercase">Local</p>
          </div>
          <p className="font-mono text-4xl font-black text-center tabular-nums">
            {p.homeScore ?? 0} - {p.awayScore ?? 0}
          </p>
          <div className="text-center">
            <p className="font-black text-sm leading-tight">{p.visitante}</p>
            <p className="text-[10px] text-slate-300 uppercase">Visitante</p>
          </div>
        </div>

        {/* Goles */}
        <section className="mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-2">
            Goles ({goles.length})
          </h2>
          {goles.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin goles.</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {goles.map((e) => (
                  <tr key={e.id} className="border-b border-slate-100">
                    <td className="py-1 font-bold w-14">{formatearMinuto(e.minuto, e.tiempo)}</td>
                    <td className="py-1">
                      {e.jugadorNombre}
                      {e.tipo === "gol_en_contra" && <span className="text-red-600 font-bold"> (en contra)</span>}
                      {e.asistenteNombre && (
                        <span className="text-slate-400"> · asist. {e.asistenteNombre}</span>
                      )}
                    </td>
                    <td className="py-1 text-right font-bold">{nombreEquipo(e.teamId)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Disciplina + faltas */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Disciplina ({tarjetas.length})
            </h2>
            {tarjetas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Sin tarjetas.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {tarjetas.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100">
                      <td className="py-1 w-8">{e.tipo === "amarilla" ? "🟨" : "🟥"}</td>
                      <td className="py-1">{e.jugadorNombre}</td>
                      <td className="py-1 text-right text-slate-500 w-14">
                        {formatearMinuto(e.minuto, e.tiempo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <section>
            <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-2">
              Otros registros
            </h2>
            <div className="text-xs flex flex-col gap-1">
              <p>
                <b>Faltas:</b> {faltas.filter((f) => f.teamId === p.homeTeamId).length} ({p.local})
                · {faltas.filter((f) => f.teamId === p.awayTeamId).length} ({p.visitante})
              </p>
              <p>
                <b>Cambios:</b> {cambios.filter((c) => c.teamId === p.homeTeamId).length} ({p.local})
                · {cambios.filter((c) => c.teamId === p.awayTeamId).length} ({p.visitante})
              </p>
              <p>
                <b>Tiempos pedidos:</b> {tiempos.filter((t) => t.teamId === p.homeTeamId).length} (
                {p.local}) · {tiempos.filter((t) => t.teamId === p.awayTeamId).length} ({p.visitante})
              </p>
            </div>
          </section>
        </div>

        {/* Cuerpo técnico */}
        <section className="mb-4">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-2">
            Cuerpos técnicos
          </h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <p>
              <b>{p.local}:</b> DT {p.cuerpoTecnico.dtLocal || "—"}
              {p.cuerpoTecnico.ayudanteLocal && ` · Ay. ${p.cuerpoTecnico.ayudanteLocal}`}
            </p>
            <p>
              <b>{p.visitante}:</b> DT {p.cuerpoTecnico.dtVisitante || "—"}
              {p.cuerpoTecnico.ayudanteVisitante && ` · Ay. ${p.cuerpoTecnico.ayudanteVisitante}`}
            </p>
          </div>
        </section>

        {/* Observaciones */}
        <section className="mb-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-2">
            Observaciones del árbitro
          </h2>
          <p className="text-xs italic text-slate-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 min-h-10">
            {p.observaciones || "Sin observaciones."}
          </p>
        </section>

        {/* Firmas */}
        <section className="mb-5">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-300 pb-1 mb-3">
            Firmas
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {ORDEN_FIRMAS.map((rol) => {
              if (
                (rol === "segundo_arbitro" || rol === "planillero") &&
                !firmas[rol] &&
                !p.oficiales.some((o) => o.rol === rol)
              ) {
                return null;
              }
              const firma = firmas[rol];
              const url = urlsFirmas[rol];
              return (
                <div key={rol} className="text-center">
                  <div className="h-14 border-b border-slate-400 flex items-end justify-center pb-1 mb-1">
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={`Firma ${ETIQUETA_ROL[rol]}`} className="max-h-12 object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-400 italic pb-1">
                        {firma && !firma.firmo ? "No firmó" : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] font-black uppercase text-slate-500 leading-tight">
                    {ETIQUETA_ROL[rol]}
                  </p>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    {firma?.nombre ??
                      (rol === "principal" ? p.arbitroPrincipalNombre : "") ??
                      ""}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pie: oficiales + QR */}
        <div className="flex items-end justify-between border-t border-slate-200 pt-3">
          <div className="text-[10px] text-slate-500">
            <p>
              Árbitro principal: <b>{p.arbitroPrincipalNombre ?? "—"}</b>
            </p>
            {p.oficiales
              .filter((o) => o.estado === "aceptada")
              .map((o) => (
                <p key={o.id}>
                  {o.rol === "segundo_arbitro" ? "2do árbitro" : "Planillero"}: <b>{o.nombre}</b>
                </p>
              ))}
          </div>
          <div className="flex items-center gap-2">
            <QrValidacion url={urlValidacion} />
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-700 uppercase">Validación digital</p>
              <p className="text-[8px] text-slate-400">Escaneá para verificar la planilla</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
