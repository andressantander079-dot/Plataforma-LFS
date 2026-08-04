import Link from "next/link";
import { ListOrdered, Shield, Trophy } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { calcularTabla, vallaMenosVencida } from "@/lib/core/competencias/tabla";
import { TablaPosiciones } from "@/components/competencias/TablaPosiciones";

/**
 * POSICIONES PÚBLICAS
 * Abierto a todo el mundo (sin login). Tabla automática por torneo,
 * calculada solo con resultados confirmados por la federación.
 */
export default async function PosicionesPublico({
  searchParams,
}: {
  searchParams: Promise<{ torneo?: string }>;
}) {
  const { torneo: torneoParam } = await searchParams;
  const supabase = await createLfsServerClient();

  const { data: torneos } = await supabase
    .from("competitions")
    .select("id, name, season, status, points_win, points_draw, points_loss, tiebreaker, categories(name)")
    .order("created_at", { ascending: false });

  const seleccionado =
    (torneos ?? []).find((t) => t.id === torneoParam) ??
    (torneos ?? []).find((t) => t.status === "en_curso") ??
    (torneos ?? [])[0];

  let filasConNombre: { nombre: string; teamId: string; puntos: number; pj: number; pg: number; pe: number; pp: number; gf: number; gc: number; dif: number }[] = [];
  let vallaId: string | null = null;

  if (seleccionado) {
    const { data: insc } = await supabase
      .from("competition_teams")
      .select("team_id, teams(name)")
      .eq("competition_id", seleccionado.id);
    const nombreEquipo = new Map(
      (insc ?? []).map((i) => [
        i.team_id,
        (i.teams as unknown as { name: string } | null)?.name ?? "—",
      ])
    );

    const { data: confirmados } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, home_score, away_score")
      .eq("competition_id", seleccionado.id)
      .eq("result_confirmed", true);

    const tabla = calcularTabla(
      (insc ?? []).map((i) => i.team_id),
      (confirmados ?? [])
        .filter((p) => p.home_score !== null && p.away_score !== null)
        .map((p) => ({
          homeTeamId: p.home_team_id,
          awayTeamId: p.away_team_id,
          homeScore: p.home_score,
          awayScore: p.away_score,
        })),
      {
        pointsWin: seleccionado.points_win,
        pointsDraw: seleccionado.points_draw,
        pointsLoss: seleccionado.points_loss,
        tiebreaker: seleccionado.tiebreaker,
      }
    );

    const valla = vallaMenosVencida(tabla);
    vallaId = valla?.teamId ?? null;
    filasConNombre = tabla.map((f) => ({
      ...f,
      nombre: nombreEquipo.get(f.teamId) ?? "—",
    }));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="text-center flex flex-col gap-1">
        <h1 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center justify-center gap-2">
          <ListOrdered className="w-7 h-7 text-[#F97316]" />
          Posiciones
        </h1>
        <p className="text-slate-500 text-sm">
          Tablas oficiales — Liga de Fútsal de Ushuaia
        </p>
      </div>

      {/* Selector de torneo */}
      <div className="flex flex-wrap justify-center gap-2">
        {(torneos ?? []).map((t) => {
          const activo = seleccionado?.id === t.id;
          const categoria = (t.categories as unknown as { name: string } | null)?.name;
          return (
            <Link
              key={t.id}
              href={`/posiciones?torneo=${t.id}`}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition border ${
                activo
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#F97316]"
              }`}
            >
              {t.name} {categoria ? `· ${categoria}` : ""}
            </Link>
          );
        })}
      </div>

      {(torneos ?? []).length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
          <Trophy className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="font-serif text-lg font-bold text-[#1A2A44]">
            La temporada todavía no comenzó
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Cuando la federación publique el primer torneo, la tabla aparece acá.
          </p>
        </div>
      )}

      {seleccionado && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-serif text-lg font-black text-[#1A2A44]">
              {seleccionado.name}
            </h2>
            {vallaId && (
              <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                Valla menos vencida:{" "}
                {filasConNombre.find((f) => f.teamId === vallaId)?.nombre}
              </span>
            )}
          </div>
          <TablaPosiciones filas={filasConNombre} vallaId={vallaId} />
          <p className="text-[10px] text-slate-400">
            Se actualiza automáticamente con los resultados confirmados por la federación.
          </p>
        </div>
      )}
    </div>
  );
}
