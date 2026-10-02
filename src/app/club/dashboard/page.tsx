import { redirect } from "next/navigation";
import Link from "next/link";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { estadoCargo, formatoPesos } from "@/lib/core/tesoreria/money";
import { calcularTabla, type PartidoParaTabla, type ConfigTabla } from "@/lib/core/competencias/tabla";
import { contarDocumentosRequeridos } from "@/lib/core/rules/jugadoresRules";
import {
  calcularRacha,
  clasificarUrgencia,
  textoConteo,
  type ItemAtencion,
  type PartidoResultado,
  type ResultadoRacha,
} from "@/lib/core/rules/dashboardRules";
import { SaludoInteligente } from "@/components/dashboards/SaludoInteligente";
import { ListaAtencion } from "@/components/dashboards/ListaAtencion";
import { HeroProximoPartido } from "@/components/dashboards/HeroProximoPartido";
import { RachaForma } from "@/components/dashboards/RachaForma";
import { QuickActions } from "@/components/dashboards/QuickActions";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";
import {
  Users, Phone, KeyRound, UserRound, ShieldCheck, AlertCircle,
  CheckCircle, XCircle, Mail, Wallet, ClipboardList, Trophy,
  FileWarning, UserPlus, CalendarClock,
} from "lucide-react";

/**
 * PANEL DEL CLUB (rol club) — Dashboard REAL completo.
 * Saludo inteligente, héroe del próximo partido con cuenta regresiva,
 * semáforo de pendientes (documentación, planillas, pases, deudas,
 * sanciones), racha de forma por equipo, tabla de posiciones completa
 * con la posición del club destacada y acceso a datos institucionales.
 * Se actualiza en tiempo real (realtime + refresco del servidor).
 */
export const dynamic = "force-dynamic";

interface Club {
  id: string;
  name: string;
  president_name: string | null;
  president_dni: string;
  president_phone: string;
  treasurer_name: string | null;
  treasurer_dni: string;
  treasurer_phone: string;
  status: "inhabilitado" | "en_revision" | "habilitado";
}

interface Representante {
  id: string;
  full_name: string;
  dni: string;
  phone: string;
  cargo: string;
}

interface UsuarioClub {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
}

const STATUS_UI = {
  habilitado: { label: "Habilitado", className: "bg-green-500/15 text-green-300", Icon: CheckCircle },
  en_revision: { label: "En revisión", className: "bg-orange-500/15 text-orange-300", Icon: AlertCircle },
  inhabilitado: { label: "Inhabilitado", className: "bg-red-500/15 text-red-300", Icon: XCircle },
} as const;

export default async function ClubDashboard() {
  const supabase = await createLfsServerClient();
  const ahora = new Date();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Perfil del usuario logueado: a qué club pertenece
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, full_name, role")
    .eq("id", user.id)
    .single();

  // Un admin que entra a /club ve el primer club (misma regla que el layout)
  let clubId = profile?.club_id ?? null;
  if (!clubId && profile?.role === "admin") {
    const { data: primerClub } = await supabase
      .from("clubs")
      .select("id")
      .order("name")
      .limit(1)
      .maybeSingle();
    clubId = primerClub?.id ?? null;
  }

  if (!clubId) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-orange-500" />
          <h1 className="font-serif text-xl font-bold text-[#1A2A44]">
            Usuario sin club asignado
          </h1>
          <p className="text-slate-500 text-sm">
            Tu usuario todavía no está vinculado a ningún club. Pedile a la
            federación que asigne tu cuenta desde el panel de administración.
          </p>
        </div>
      </main>
    );
  }

  const { data: club } = await supabase.from("clubs").select("*").eq("id", clubId).single();
  if (!club) redirect("/login");
  const clubData = club as Club;

  // Mis equipos (uno por categoría)
  const { data: misEquipos } = await supabase
    .from("teams")
    .select("id, name, category_id")
    .eq("club_id", clubData.id);
  const misTeamIds = (misEquipos ?? []).map((t) => t.id);
  const nombreMiEquipo = new Map((misEquipos ?? []).map((t) => [t.id, t.name as string]));

  // ---------------- Consultas en paralelo ----------------
  const [
    { data: representantes },
    { data: cargosVivos },
    { data: pagosClub },
    { data: settingsTes },
    { count: pasesPorDictaminar },
    { data: usuarios },
    { data: vinculosJugadores },
    { data: sancionesActivas },
    { data: inscripciones },
  ] = await Promise.all([
    supabase
      .from("club_representatives")
      .select("id, full_name, dni, phone, cargo")
      .eq("club_id", clubData.id)
      .order("created_at"),
    supabase
      .from("treasury_charges")
      .select("id, monto, fecha_vencimiento, status")
      .eq("club_id", clubData.id)
      .in("status", ["pendiente", "parcial"]),
    supabase
      .from("treasury_payments")
      .select("charge_id, monto")
      .eq("club_id", clubData.id)
      .eq("status", "aprobado"),
    supabase.from("treasury_settings").select("late_fee_percent").eq("id", 1).maybeSingle(),
    supabase
      .from("transfers")
      .select("id", { count: "exact", head: true })
      .eq("from_club_id", clubData.id)
      .eq("status", "4_CLUB_B_DECISION"),
    supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("club_id", clubData.id)
      .order("created_at"),
    supabase
      .from("player_categories")
      .select("player_id, players(documents)")
      .eq("club_id", clubData.id),
    misTeamIds.length
      ? supabase
          .from("player_suspensions")
          .select("id, partidos_pendientes")
          .in("team_id", misTeamIds)
          .gt("partidos_pendientes", 0)
      : Promise.resolve({ data: [] as { id: string; partidos_pendientes: number }[] }),
    misTeamIds.length
      ? supabase.from("competition_teams").select("competition_id, team_id").in("team_id", misTeamIds)
      : Promise.resolve({ data: [] as { competition_id: string; team_id: string }[] }),
  ]);

  // ---------------- Deuda de tesorería (aviso) ----------------
  const aprobPorCargo = new Map<string, number>();
  for (const p of pagosClub ?? []) {
    aprobPorCargo.set(p.charge_id, (aprobPorCargo.get(p.charge_id) ?? 0) + Number(p.monto));
  }
  let deudaAviso = 0;
  let cargosConDeuda = 0;
  let hayVencidos = false;
  for (const c of cargosVivos ?? []) {
    const e = estadoCargo(
      Number(c.monto),
      c.fecha_vencimiento,
      Number(settingsTes?.late_fee_percent ?? 0),
      aprobPorCargo.get(c.id) ?? 0,
      false
    );
    if (e.saldo > 0) {
      deudaAviso += e.saldo;
      cargosConDeuda++;
      if (e.estado === "vencido") hayVencidos = true;
    }
  }

  // ---------------- Documentación incompleta del plantel ----------------
  const docsPorJugador = new Map<string, number>();
  for (const v of vinculosJugadores ?? []) {
    const docs = (v.players as unknown as { documents: Record<string, string> | null } | null)?.documents ?? null;
    docsPorJugador.set(v.player_id, contarDocumentosRequeridos(docs));
  }
  const jugadoresIncompletos = [...docsPorJugador.values()].filter((n) => n < 4).length;

  // ---------------- Partidos: próximo, racha y planillas ----------------
  let proximoPartido: {
    miEquipo: string;
    rival: string;
    esLocal: boolean;
    torneo: string;
    cancha: string | null;
    fechaISO: string;
  } | null = null;
  const rachas: { equipo: string; racha: ResultadoRacha[] }[] = [];
  let planillasSinConfirmar = 0;
  let partidoMasViejoSinConfirmar: string | null = null;

  interface FilaTablaUI {
    teamId: string;
    nombre: string;
    puntos: number;
    pj: number;
    pg: number;
    pe: number;
    pp: number;
    gf: number;
    gc: number;
    dif: number;
  }
  const tablasPorTorneo: { torneo: string; categoria: string | null; filas: FilaTablaUI[] }[] = [];

  if (misTeamIds.length > 0) {
    const { data: partidosClub } = await supabase
      .from("matches")
      .select("id, competition_id, home_team_id, away_team_id, scheduled_at, venue_id, status, home_score, away_score, result_confirmed, stage")
      .or(`home_team_id.in.(${misTeamIds.join(",")}),away_team_id.in.(${misTeamIds.join(",")})`)
      .order("scheduled_at", { ascending: true, nullsFirst: false });

    const { data: canchas } = await supabase.from("venues").select("id, name");
    const nombreCancha = new Map((canchas ?? []).map((c) => [c.id, c.name as string]));

    const competitionIds = [...new Set((inscripciones ?? []).map((i) => i.competition_id))];
    const { data: torneos } = competitionIds.length
      ? await supabase
          .from("competitions")
          .select("id, name, season, status, points_win, points_draw, points_loss, tiebreaker, categories(name)")
          .in("id", competitionIds)
      : { data: [] };
    const nombreTorneo = new Map((torneos ?? []).map((t) => [t.id, `${t.name} ${t.season ?? ""}`.trim()]));

    // Nombres de todos los equipos rivales
    const rivalIds = new Set<string>();
    for (const p of partidosClub ?? []) {
      rivalIds.add(p.home_team_id);
      rivalIds.add(p.away_team_id);
    }
    const { data: todosEquipos } = rivalIds.size
      ? await supabase.from("teams").select("id, name").in("id", [...rivalIds])
      : { data: [] };
    const nombreEquipo = new Map((todosEquipos ?? []).map((t) => [t.id, t.name as string]));

    // Próximo partido (programado, a futuro)
    const proximo = (partidosClub ?? []).find(
      (p) =>
        p.status === "programado" &&
        p.scheduled_at !== null &&
        new Date(p.scheduled_at).getTime() > ahora.getTime() - 3 * 3_600_000
    );
    if (proximo) {
      const esLocal = misTeamIds.includes(proximo.home_team_id);
      const miTeamId = esLocal ? proximo.home_team_id : proximo.away_team_id;
      const rivalId = esLocal ? proximo.away_team_id : proximo.home_team_id;
      proximoPartido = {
        miEquipo: nombreMiEquipo.get(miTeamId) ?? "Mi equipo",
        rival: nombreEquipo.get(rivalId) ?? "Rival",
        esLocal,
        torneo: nombreTorneo.get(proximo.competition_id) ?? "Torneo LFS",
        cancha: proximo.venue_id ? nombreCancha.get(proximo.venue_id) ?? null : null,
        fechaISO: proximo.scheduled_at as string,
      };
    }

    // Racha por equipo (últimos 5 confirmados, cronológico)
    for (const teamId of misTeamIds) {
      const resultados: PartidoResultado[] = (partidosClub ?? [])
        .filter(
          (p) =>
            p.result_confirmed &&
            p.home_score !== null &&
            p.away_score !== null &&
            (p.home_team_id === teamId || p.away_team_id === teamId)
        )
        .sort(
          (a, b) =>
            new Date(a.scheduled_at ?? 0).getTime() - new Date(b.scheduled_at ?? 0).getTime()
        )
        .map((p) =>
          p.home_team_id === teamId
            ? { golesFavor: p.home_score as number, golesContra: p.away_score as number }
            : { golesFavor: p.away_score as number, golesContra: p.home_score as number }
        );
      const racha = calcularRacha(resultados);
      if (racha.length > 0) {
        rachas.push({ equipo: nombreMiEquipo.get(teamId) ?? "Equipo", racha });
      }
    }

    // Planillas de partidos futuros sin confirmar por el club
    const futuros = (partidosClub ?? []).filter(
      (p) => p.status === "programado" && p.scheduled_at !== null
    );
    if (futuros.length > 0) {
      const { data: planillas } = await supabase
        .from("match_sheets")
        .select("match_id, confirmada_local, confirmada_visitante")
        .in("match_id", futuros.map((p) => p.id));
      const planillaPorMatch = new Map((planillas ?? []).map((p) => [p.match_id, p]));
      for (const p of futuros) {
        const planilla = planillaPorMatch.get(p.id);
        const soyLocal = misTeamIds.includes(p.home_team_id);
        const pendiente = soyLocal ? !planilla?.confirmada_local : !planilla?.confirmada_visitante;
        if (pendiente) {
          planillasSinConfirmar++;
          if (!partidoMasViejoSinConfirmar) partidoMasViejoSinConfirmar = p.scheduled_at;
        }
      }
    }

    // Tabla completa por torneo en curso (posición del club destacada)
    for (const torneo of torneos ?? []) {
      if (torneo.status !== "en_curso") continue;
      const { data: inscTorneo } = await supabase
        .from("competition_teams")
        .select("team_id, teams(name)")
        .eq("competition_id", torneo.id);
      const equipoIds = (inscTorneo ?? []).map((i) => i.team_id);
      const nombres = new Map(
        (inscTorneo ?? []).map((i) => [
          i.team_id,
          (i.teams as unknown as { name: string } | null)?.name ?? "—",
        ])
      );
      const partidosTorneo: PartidoParaTabla[] = (partidosClub ?? [])
        .filter(
          (p) =>
            p.competition_id === torneo.id &&
            p.result_confirmed &&
            (p.stage ?? "fase_regular") === "fase_regular" &&
            p.home_score !== null &&
            p.away_score !== null
        )
        .map((p) => ({
          homeTeamId: p.home_team_id,
          awayTeamId: p.away_team_id,
          homeScore: p.home_score as number,
          awayScore: p.away_score as number,
        }));

      // La tabla necesita TODOS los partidos del torneo, no solo los del club
      const { data: confirmadosTorneo } = await supabase
        .from("matches")
        .select("home_team_id, away_team_id, home_score, away_score, stage")
        .eq("competition_id", torneo.id)
        .eq("result_confirmed", true);
      const regulares: PartidoParaTabla[] = (confirmadosTorneo ?? [])
        .filter(
          (p) =>
            (p.stage ?? "fase_regular") === "fase_regular" &&
            p.home_score !== null &&
            p.away_score !== null
        )
        .map((p) => ({
          homeTeamId: p.home_team_id,
          awayTeamId: p.away_team_id,
          homeScore: p.home_score as number,
          awayScore: p.away_score as number,
        }));

      const config: ConfigTabla = {
        pointsWin: torneo.points_win,
        pointsDraw: torneo.points_draw,
        pointsLoss: torneo.points_loss,
        tiebreaker: torneo.tiebreaker as "diferencia_gol" | "enfrentamiento_directo",
      };
      const filas = calcularTabla(equipoIds, regulares, config).map((f) => ({
        ...f,
        nombre: nombres.get(f.teamId) ?? "—",
      }));

      tablasPorTorneo.push({
        torneo: `${torneo.name} ${torneo.season ?? ""}`.trim(),
        categoria: (torneo.categories as unknown as { name: string } | null)?.name ?? null,
        filas,
      });
    }
  }

  // ---------------- Semáforo "Requiere atención" ----------------
  const items: ItemAtencion[] = [];

  if (hayVencidos) {
    items.push({
      nivel: "rojo",
      titulo: `Tenés cargos vencidos por ${formatoPesos(deudaAviso)}`,
      detalle: "Los vencidos suman recargo. Informá el pago cuanto antes.",
      href: "/club/finanzas",
      accion: "Pagar",
    });
  } else if (cargosConDeuda > 0) {
    items.push({
      nivel: "amarillo",
      titulo: `${textoConteo(cargosConDeuda, "cargo pendiente", "cargos pendientes")} por ${formatoPesos(deudaAviso)}`,
      detalle: "Todavía no vencen, pero conviene saldarlos a tiempo.",
      href: "/club/finanzas",
      accion: "Ver",
    });
  }

  if (jugadoresIncompletos > 0) {
    items.push({
      nivel: "rojo",
      titulo: textoConteo(jugadoresIncompletos, "jugador con documentación incompleta", "jugadores con documentación incompleta"),
      detalle: "Les falta alguno de los 4 documentos obligatorios para poder jugar.",
      href: "/club/planteles",
      accion: "Completar",
    });
  }

  if (planillasSinConfirmar > 0) {
    items.push({
      nivel: clasificarUrgencia(partidoMasViejoSinConfirmar, ahora, 48),
      titulo: textoConteo(planillasSinConfirmar, "planilla por confirmar", "planillas por confirmar"),
      detalle: "Confirmá la convocatoria de tus próximos partidos.",
      href: "/club/partidos",
      accion: "Confirmar",
    });
  }

  if ((pasesPorDictaminar ?? 0) > 0) {
    items.push({
      nivel: "amarillo",
      titulo: textoConteo(pasesPorDictaminar ?? 0, "pase esperando tu dictamen", "pases esperando tu dictamen"),
      detalle: "Otro club pidió jugadores tuyos. Aprobá o rechazá desde Trámites.",
      href: "/club/tramites",
      accion: "Dictaminar",
    });
  }

  if ((sancionesActivas ?? []).length > 0) {
    items.push({
      nivel: "info",
      titulo: textoConteo((sancionesActivas ?? []).length, "jugador suspendido", "jugadores suspendidos"),
      detalle: "Cumplen sanción por tarjetas. No pueden ir a la planilla.",
      href: "/club/estadisticas",
      accion: "Ver",
    });
  }

  const pendientesTotales = items.filter((i) => i.nivel !== "info").length;

  const status = STATUS_UI[clubData.status] ?? STATUS_UI.inhabilitado;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <RealtimeRefresher
        tablas={["matches", "match_sheets", "transfers", "treasury_charges", "treasury_payments", "players", "player_suspensions"]}
      />

      <SaludoInteligente
        nombre={profile?.full_name ?? null}
        pendientes={pendientesTotales}
        rol={clubData.name}
      />

      {/* Héroe: próximo partido con cuenta regresiva */}
      {proximoPartido && (
        <HeroProximoPartido
          miEquipo={proximoPartido.miEquipo}
          rival={proximoPartido.rival}
          esLocal={proximoPartido.esLocal}
          torneo={proximoPartido.torneo}
          cancha={proximoPartido.cancha}
          fechaISO={proximoPartido.fechaISO}
          hrefPartidos="/club/partidos"
        />
      )}

      <ListaAtencion items={items} />

      <QuickActions
        acciones={[
          { href: "/club/partidos", label: "Confirmar planilla", icono: CalendarClock },
          { href: "/club/tramites", label: "Trámites y pases", icono: ClipboardList },
          { href: "/club/planteles", label: "Inscribir jugador", icono: UserPlus },
          { href: "/club/finanzas", label: "Mis finanzas", icono: Wallet },
        ]}
      />

      {/* Racha de forma por equipo */}
      {rachas.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-[#F97316]" />
            <h2 className="font-serif text-base font-bold text-[#1A2A44]">
              Racha de tus equipos
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 mb-2">
            Últimos 5 resultados confirmados (el más reciente a la derecha).
          </p>
          <div className="divide-y divide-slate-100">
            {rachas.map((r) => (
              <RachaForma key={r.equipo} equipo={r.equipo} racha={r.racha} />
            ))}
          </div>
        </section>
      )}

      {/* Tabla de posiciones completa con el club destacado */}
      {tablasPorTorneo.map((tabla) => (
        <section
          key={tabla.torneo}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#F97316]" />
              <h2 className="font-serif text-base font-bold text-[#1A2A44]">{tabla.torneo}</h2>
            </div>
            {tabla.categoria && (
              <span className="text-[10px] font-bold text-slate-400">{tabla.categoria}</span>
            )}
          </div>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs min-w-[480px]">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 font-black">#</th>
                  <th className="text-left py-2 font-black">Equipo</th>
                  <th className="text-center py-2 font-black">Pts</th>
                  <th className="text-center py-2 font-black">PJ</th>
                  <th className="text-center py-2 font-black">G</th>
                  <th className="text-center py-2 font-black">E</th>
                  <th className="text-center py-2 font-black">P</th>
                  <th className="text-center py-2 font-black">GF</th>
                  <th className="text-center py-2 font-black">GC</th>
                  <th className="text-center py-2 font-black">DIF</th>
                </tr>
              </thead>
              <tbody>
                {tabla.filas.map((fila, idx) => {
                  const esMio = misTeamIds.includes(fila.teamId);
                  return (
                    <tr
                      key={fila.teamId}
                      className={`border-b border-slate-50 ${
                        esMio
                          ? "bg-[#F97316]/10 font-bold"
                          : idx < 3
                            ? "bg-green-50/40"
                            : ""
                      }`}
                    >
                      <td className="py-2 pr-1 text-slate-400">{idx + 1}</td>
                      <td className="py-2 text-[#1A2A44]">
                        {fila.nombre}
                        {esMio && (
                          <span className="ml-1.5 text-[8px] font-black uppercase text-[#F97316]">
                            Tu club
                          </span>
                        )}
                      </td>
                      <td className="py-2 text-center font-black text-[#1A2A44]">{fila.puntos}</td>
                      <td className="py-2 text-center text-slate-500">{fila.pj}</td>
                      <td className="py-2 text-center text-slate-500">{fila.pg}</td>
                      <td className="py-2 text-center text-slate-500">{fila.pe}</td>
                      <td className="py-2 text-center text-slate-500">{fila.pp}</td>
                      <td className="py-2 text-center text-slate-500">{fila.gf}</td>
                      <td className="py-2 text-center text-slate-500">{fila.gc}</td>
                      <td className="py-2 text-center text-slate-500">{fila.dif}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Aviso de tesorería: cargos pendientes / vencidos */}
      {cargosConDeuda > 0 && (
        <Link
          href="/club/finanzas"
          className={`rounded-2xl border p-4 flex items-center gap-3 shadow-sm transition hover:shadow-md ${
            hayVencidos ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"
          }`}
        >
          <Wallet className={`w-6 h-6 shrink-0 ${hayVencidos ? "text-red-600" : "text-orange-500"}`} />
          <div className="flex-1">
            <p className={`font-bold text-sm ${hayVencidos ? "text-red-800" : "text-orange-800"}`}>
              Tenés {cargosConDeuda} cargo{cargosConDeuda > 1 ? "s" : ""} pendiente
              {cargosConDeuda > 1 ? "s" : ""} por {formatoPesos(deudaAviso)}
              {hayVencidos ? " · ¡Hay vencidos con recargo!" : ""}
            </p>
            <p className={`text-[11px] ${hayVencidos ? "text-red-600" : "text-orange-600"}`}>
              Tocá acá para ver tu estado de cuenta e informar el pago.
            </p>
          </div>
        </Link>
      )}

      {/* Aviso de pases: trámites esperando el dictamen del club */}
      {(pasesPorDictaminar ?? 0) > 0 && (
        <Link
          href="/club/tramites"
          className="rounded-2xl border p-4 flex items-center gap-3 shadow-sm transition hover:shadow-md bg-purple-50 border-purple-200"
        >
          <ClipboardList className="w-6 h-6 shrink-0 text-purple-600" />
          <div className="flex-1">
            <p className="font-bold text-sm text-purple-800">
              {pasesPorDictaminar === 1
                ? "Hay 1 pase esperando tu dictamen"
                : `Hay ${pasesPorDictaminar} pases esperando tu dictamen`}
            </p>
            <p className="text-[11px] text-purple-600">
              Otro club pidió jugadores tuyos. Tocá acá para aprobar o rechazar.
            </p>
          </div>
        </Link>
      )}

      {/* Datos institucionales */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-[#F97316]" />
          <h2 className="font-serif text-lg font-bold text-[#1A2A44]">
            Autoridades Registradas
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-slate-100 rounded-xl p-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Presidente
            </span>
            <p className="text-sm font-bold text-[#1A2A44] mt-1">
              {clubData.president_name ?? `DNI ${clubData.president_dni}`}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-[#F97316]" /> {clubData.president_phone}
            </p>
          </div>
          <div className="border border-slate-100 rounded-xl p-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Tesorero
            </span>
            <p className="text-sm font-bold text-[#1A2A44] mt-1">
              {clubData.treasurer_name ?? `DNI ${clubData.treasurer_dni}`}
            </p>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
              <Phone className="w-3 h-3 text-[#F97316]" /> {clubData.treasurer_phone}
            </p>
          </div>
        </div>

        {/* Representantes extra */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
            Otros representantes autorizados
          </span>
          {(representantes ?? []).length === 0 ? (
            <p className="text-slate-400 text-xs italic mt-2">
              No hay representantes adicionales registrados por la federación.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 mt-2">
              {(representantes as Representante[]).map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#1A2A44]/5 flex items-center justify-center shrink-0">
                    <UserRound className="w-4 h-4 text-[#1A2A44]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1A2A44] truncate">{r.full_name}</p>
                    <p className="text-[11px] text-slate-500">
                      DNI {r.dni} · {r.phone}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] shrink-0">
                    {r.cargo}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Usuarios con acceso */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-5 h-5 text-[#F97316]" />
          <h2 className="font-serif text-lg font-bold text-[#1A2A44]">
            Usuarios con Acceso a la Plataforma
          </h2>
        </div>
        <p className="text-slate-400 text-[11px] mb-4">
          Estas son las cuentas que la federación habilitó para tu club. Si
          necesitás dar de alta o baja un usuario, solicitálo por Mensajería.
        </p>

        {(usuarios ?? []).length === 0 ? (
          <p className="text-slate-400 text-xs italic">
            Todavía no hay usuarios habilitados para tu club.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {(usuarios as UsuarioClub[]).map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-[#1A2A44] flex items-center justify-center shrink-0">
                  <UserRound className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#1A2A44] truncate">{u.full_name}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 text-[#F97316] shrink-0" />
                    {u.email ?? "Sin email"}
                  </p>
                </div>
                <span className="text-[9px] text-slate-400 font-bold shrink-0">
                  Alta: {new Date(u.created_at).toLocaleDateString("es-AR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Estado del club */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
        <status.Icon className="w-5 h-5 shrink-0 text-[#1A2A44]" />
        <p className="text-xs text-slate-500 flex-1">
          Estado institucional del club:{" "}
          <span className="font-bold text-[#1A2A44]">{status.label}</span>
        </p>
      </section>

      {/* Pie */}
      <p className="text-center text-[10px] text-slate-400 pb-6">
        Plataforma LFS v3.0 — Si algún dato está incorrecto, reportalo a la federación.
      </p>
    </div>
  );
}
