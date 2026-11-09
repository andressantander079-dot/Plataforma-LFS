import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRightLeft,
  Award,
  Banknote,
  BarChart3,
  BellRing,
  Calendar,
  CircleCheck,
  FileWarning,
  ShieldAlert,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { contarDocumentosRequeridos, DOCUMENTOS_INSCRIPCION } from "@/lib/core/rules/jugadoresRules";

interface MatchRow {
  id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result_confirmed: boolean;
}

interface PlayerRow {
  player_id: string;
  players: {
    first_name: string;
    last_name: string;
    documents: Record<string, string> | null;
  } | null;
}

const dinero = (n: number) =>
  n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/**
 * ESTADÍSTICAS DEL CLUB (extendido en Paso 17B):
 *  · Deportivo: PJ/PG/PE/PP, goles, efectividad (ya existía).
 *  · Disciplina: amarillas y rojas del club desde match_events reales.
 *  · Finanzas: estado de cuenta resumido desde treasury_charges.
 *  · Panel de alertas: documentación incompleta y deuda vencida.
 * Solo datos PROPIOS del club (spec: sin comparativa con el promedio).
 */
export default async function ClubEstadisticasPage() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  const clubId = profile?.club_id;
  if (!clubId) redirect("/club/dashboard");

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", clubId)
    .single();

  if (!club) redirect("/club/dashboard");

  const hoy = new Date().toISOString().slice(0, 10);

  // 1. Equipos del club
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("club_id", clubId);
  const teamIds = (teams ?? []).map((t) => t.id);

  // 2. Jugadores y documentación (claves actuales del Paso 10B)
  const { data: playerRows } = await supabase
    .from("player_categories")
    .select("player_id, players ( first_name, last_name, documents )")
    .eq("club_id", clubId);

  const jugadores = (playerRows ?? []) as unknown as PlayerRow[];
  const totalJugadores = jugadores.length;
  const DOCS_REQUERIDOS = DOCUMENTOS_INSCRIPCION.length;
  const listos = jugadores.filter(
    (r) => contarDocumentosRequeridos(r.players?.documents) >= DOCS_REQUERIDOS
  ).length;
  const docsIncompletos = totalJugadores - listos;

  // 3. Pases completados
  const [{ count: pasesRecibidos }, { count: pasesCedidos }] = await Promise.all([
    supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("to_club_id", clubId)
      .eq("status", "7_COMPLETED"),
    supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("from_club_id", clubId)
      .eq("status", "7_COMPLETED"),
  ]);

  // 4. Partidos (rendimiento deportivo)
  let pj = 0;
  let pg = 0;
  let pe = 0;
  let pp = 0;
  let gf = 0;
  let gc = 0;

  if (teamIds.length > 0) {
    const { data: matches } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, home_score, away_score, status, result_confirmed")
      .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`);

    const filas = (matches ?? []) as MatchRow[];

    for (const m of filas) {
      if (!m.result_confirmed || m.home_score === null || m.away_score === null) continue;
      if (m.status !== "jugado" && m.status !== "wo") continue;

      pj++;
      const soyHome = teamIds.includes(m.home_team_id);
      const golesFavor = soyHome ? m.home_score : m.away_score;
      const golesContra = soyHome ? m.away_score : m.home_score;

      gf += golesFavor;
      gc += golesContra;

      if (golesFavor > golesContra) {
        pg++;
      } else if (golesFavor === golesContra) {
        pe++;
      } else {
        pp++;
      }
    }
  }

  const efectividad = pj > 0 ? ((pg * 3 + pe) / (pj * 3)) * 100 : 0;

  // 5. DISCIPLINA (Paso 17B): tarjetas del club desde match_events
  let amarillas = 0;
  let rojas = 0;
  const tarjetasPorJugador = new Map<string, { amarillas: number; rojas: number }>();

  if (teamIds.length > 0) {
    const { data: eventos } = await supabase
      .from("match_events")
      .select("tipo, player_id")
      .in("team_id", teamIds)
      .in("tipo", ["amarilla", "roja"]);

    for (const e of eventos ?? []) {
      const prev = tarjetasPorJugador.get(e.player_id) ?? { amarillas: 0, rojas: 0 };
      if (e.tipo === "amarilla") {
        amarillas++;
        prev.amarillas++;
      } else {
        rojas++;
        prev.rojas++;
      }
      tarjetasPorJugador.set(e.player_id, prev);
    }
  }

  const nombreJugador = new Map(
    jugadores.map((j) => [
      j.player_id,
      `${j.players?.first_name ?? ""} ${j.players?.last_name ?? ""}`.trim() || "Jugador",
    ])
  );
  const masAmonestados = Array.from(tarjetasPorJugador.entries())
    .map(([playerId, v]) => ({
      playerId,
      nombre: nombreJugador.get(playerId) ?? "Jugador (ex plantel)",
      total: v.amarillas + v.rojas * 2,
      detalle: `${v.amarillas} am · ${v.rojas} ro`,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 6. FINANZAS (Paso 17B): resumen de cargos del club
  const { data: cargos } = await supabase
    .from("treasury_charges")
    .select("monto, status, fecha_vencimiento")
    .eq("club_id", clubId);

  let deudaPendiente = 0;
  let deudaVencida = 0;
  let cargosPagados = 0;
  for (const c of cargos ?? []) {
    if (c.status === "pagado") {
      cargosPagados++;
      continue;
    }
    if (c.status === "anulado") continue;
    const monto = Number(c.monto ?? 0);
    deudaPendiente += monto;
    if (c.fecha_vencimiento && c.fecha_vencimiento < hoy) deudaVencida += monto;
  }

  const hayAlertas = docsIncompletos > 0 || deudaVencida > 0;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Estadísticas de {club.name}
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Rendimiento deportivo, disciplina, finanzas y documentación de tu club.
        </p>
      </div>

      {/* PANEL DE ALERTAS (Paso 17B) */}
      {hayAlertas ? (
        <section className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 flex flex-col gap-3">
          <h3 className="font-serif text-base font-black text-rose-800 flex items-center gap-2">
            <BellRing className="w-5 h-5" /> Cosas que necesitan tu atención
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {docsIncompletos > 0 && (
              <Link
                href="/club/planteles"
                className="bg-white border border-rose-200 rounded-xl p-4 flex items-start gap-3 hover:border-rose-300 transition"
              >
                <FileWarning className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-[#1A2A44]">
                    {docsIncompletos} jugador{docsIncompletos === 1 ? "" : "es"} con documentación
                    incompleta
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Les falta alguno de los {DOCS_REQUERIDOS} documentos obligatorios para jugar.
                  </p>
                </div>
              </Link>
            )}
            {deudaVencida > 0 && (
              <Link
                href="/club/finanzas"
                className="bg-white border border-rose-200 rounded-xl p-4 flex items-start gap-3 hover:border-rose-300 transition"
              >
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-black text-[#1A2A44]">
                    {dinero(deudaVencida)} en cargos vencidos
                  </p>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    Regularizá la deuda para evitar trabas en trámites y pases.
                  </p>
                </div>
              </Link>
            )}
          </div>
        </section>
      ) : (
        <section className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
          <CircleCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-xs font-bold text-emerald-800">
            Todo al día: documentación completa y sin cargos vencidos. ¡Buen trabajo!
          </p>
        </section>
      )}

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plantel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-[#F97316] rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Roster Completo</span>
            <span className="text-xl font-black text-[#1A2A44]">{totalJugadores} Jugadores</span>
            <span className="text-[10px] text-green-600 font-semibold block">{listos} con documentación completa</span>
          </div>
        </div>

        {/* Rendimiento */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Partidos Oficiales</span>
            <span className="text-xl font-black text-[#1A2A44]">{pj} Jugados</span>
            <span className="text-[10px] text-slate-500 font-semibold block">
              {pg}G / {pe}E / {pp}P
            </span>
          </div>
        </div>

        {/* Trámites */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Pases Efectivizados</span>
            <span className="text-xl font-black text-[#1A2A44]">{Number(pasesRecibidos) + Number(pasesCedidos)} Pases</span>
            <span className="text-[10px] text-purple-600 font-semibold block">
              +{pasesRecibidos} incorporados / -{pasesCedidos} cedidos
            </span>
          </div>
        </div>
      </div>

      {/* Panel Deportivo Detallado */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Award className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-serif text-base font-black text-[#1A2A44]">
            Rendimiento Deportivo de la Temporada
          </h3>
        </div>

        {pj === 0 ? (
          <div className="text-center py-8">
            <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-xs font-semibold">
              Todavía no hay resultados confirmados de tus partidos este torneo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {/* Goles Favor */}
            <div className="bg-slate-50 border rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Goles a Favor (GF)</span>
              <p className="text-2xl font-black text-green-700 mt-1">{gf}</p>
              <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                {(gf / pj).toFixed(1)} goles p/partido
              </span>
            </div>

            {/* Goles Contra */}
            <div className="bg-slate-50 border rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Goles en Contra (GC)</span>
              <p className="text-2xl font-black text-red-700 mt-1">{gc}</p>
              <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                {(gc / pj).toFixed(1)} goles p/partido
              </span>
            </div>

            {/* Diferencia */}
            <div className="bg-slate-50 border rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Diferencia de Gol</span>
              <p className="text-2xl font-black text-[#1A2A44] mt-1">
                {gf - gc > 0 ? `+${gf - gc}` : gf - gc}
              </p>
              <span className="text-[9px] text-slate-500 font-medium block mt-0.5">DIF global</span>
            </div>

            {/* Efectividad */}
            <div className="bg-slate-50 border rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Efectividad de Puntos</span>
              <p className="text-2xl font-black text-[#F97316] mt-1">{efectividad.toFixed(0)}%</p>
              <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                {pg * 3 + pe} de {pj * 3} pts posibles
              </span>
            </div>
          </div>
        )}
      </section>

      {/* DISCIPLINA + FINANZAS (Paso 17B) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Disciplina */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h3 className="font-serif text-base font-black text-[#1A2A44]">Disciplina</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <span className="text-[10px] font-bold text-amber-600 uppercase block tracking-wider">Amarillas</span>
              <p className="text-2xl font-black text-amber-700 mt-1">{amarillas}</p>
              <span className="text-[9px] text-amber-600 font-medium block mt-0.5">
                {pj > 0 ? (amarillas / pj).toFixed(1) : "0"} por partido
              </span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <span className="text-[10px] font-bold text-rose-600 uppercase block tracking-wider">Rojas</span>
              <p className="text-2xl font-black text-rose-700 mt-1">{rojas}</p>
              <span className="text-[9px] text-rose-600 font-medium block mt-0.5">
                {pj > 0 ? (rojas / pj).toFixed(2) : "0"} por partido
              </span>
            </div>
          </div>
          {masAmonestados.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Jugadores con más fichas
              </span>
              {masAmonestados.map((j) => (
                <div
                  key={j.playerId}
                  className="flex items-center justify-between text-xs border-b border-slate-50 last:border-0 py-1.5"
                >
                  <span className="font-bold text-[#1A2A44]">{j.nombre}</span>
                  <span className="text-slate-400 font-semibold">{j.detalle}</span>
                </div>
              ))}
            </div>
          )}
          {amarillas === 0 && rojas === 0 && (
            <p className="text-xs text-slate-400 font-semibold text-center py-2">
              Sin tarjetas registradas todavía. ¡Excelente conducta!
            </p>
          )}
        </section>

        {/* Finanzas */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              <h3 className="font-serif text-base font-black text-[#1A2A44]">Finanzas</h3>
            </div>
            <Link
              href="/club/finanzas"
              className="text-[10px] font-black uppercase tracking-widest text-[#F97316] hover:underline"
            >
              Ver detalle →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div
              className={`rounded-xl p-4 border ${
                deudaPendiente > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase block tracking-wider ${
                  deudaPendiente > 0 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                Saldo pendiente
              </span>
              <p
                className={`text-xl font-black mt-1 ${
                  deudaPendiente > 0 ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {dinero(deudaPendiente)}
              </p>
              {deudaVencida > 0 && (
                <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                  {dinero(deudaVencida)} vencidos
                </span>
              )}
            </div>
            <div className="bg-slate-50 border rounded-xl p-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Cargos pagados</span>
              <p className="text-xl font-black text-[#1A2A44] mt-1">{cargosPagados}</p>
              <span className="text-[9px] text-slate-500 font-medium block mt-0.5">
                <Banknote className="w-3 h-3 inline-block" /> histórico del club
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold">
            Los pagos se verifican desde la federación. Si subiste un comprobante y todavía figura
            pendiente, está en revisión de tesorería.
          </p>
        </section>
      </div>
    </div>
  );
}
