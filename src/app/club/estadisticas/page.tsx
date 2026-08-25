import { redirect } from "next/navigation";
import { BarChart3, Trophy, Users, Award, Calendar, ArrowRightLeft } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

interface MatchRow {
  home_team_id: string;
  away_team_id: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result_confirmed: boolean;
}

interface PlayerRow {
  players: {
    documents: Record<string, string> | null;
  } | null;
}

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

  // 1. Obtener equipos del club para partidos
  const { data: teams } = await supabase
    .from("teams")
    .select("id, name")
    .eq("club_id", clubId);
  const teamIds = (teams ?? []).map((t) => t.id);

  // 2. Jugadores y habilitaciones
  const { data: playerRows } = await supabase
    .from("player_categories")
    .select("players ( documents )")
    .eq("club_id", clubId);

  const totalJugadores = (playerRows ?? []).length;
  const listos = (playerRows ?? []).filter((r) => {
    const docs = (r.players as unknown as { documents: Record<string, string> | null })?.documents;
    return docs && docs.medical && docs.ddjj && docs.photo;
  }).length;

  // 3. Pases completados esta temporada
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

  // 4. Calcular métricas de partidos desde Supabase
  let pj = 0;
  let pg = 0;
  let pe = 0;
  let pp = 0;
  let gf = 0;
  let gc = 0;

  if (teamIds.length > 0) {
    const { data: matches } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, home_score, away_score, status, result_confirmed")
      .or(`home_team_id.in.(${teamIds.join(",")}),away_team_id.in.(${teamIds.join(",")})`);

    for (const m of (matches ?? []) as MatchRow[]) {
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

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#F97316]" />
          Estadísticas de {club.name}
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Resumen histórico de rendimiento deportivo, pases y documentación de la temporada.
        </p>
      </div>

      {/* Tarjetas de Métricas Físicas / Documentales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plantel */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-50 text-[#F97316] rounded-xl flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">Roster Completo</span>
            <span className="text-xl font-black text-[#1A2A44]">{totalJugadores} Jugadores</span>
            <span className="text-[10px] text-green-600 font-semibold block">{listos} Habilitados LFS</span>
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
    </div>
  );
}
