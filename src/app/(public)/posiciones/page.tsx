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
    .select("id, name, season, status, format, points_win, points_draw, points_loss, tiebreaker, categories(name)")
    .order("created_at", { ascending: false });

  const seleccionado =
    (torneos ?? []).find((t) => t.id === torneoParam) ??
    (torneos ?? []).find((t) => t.status === "en_curso") ??
    (torneos ?? [])[0];

  interface FilaConNombre {
    nombre: string;
    teamId: string;
    puntos: number;
    pj: number;
    pg: number;
    pe: number;
    pp: number;
    gf: number;
    gc: number;
    dif: number;
  }

  let secciones: { titulo: string | null; filas: FilaConNombre[]; vallaId: string | null }[] = [];
  let campeon: string | null = null;

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

    // La tabla se alimenta SOLO de la fase regular (los playoffs no suman puntos)
    const { data: confirmados } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, home_score, away_score, stage, group_name")
      .eq("competition_id", seleccionado.id)
      .eq("result_confirmed", true);

    const regulares = (confirmados ?? []).filter(
      (p) =>
        (p.stage ?? "fase_regular") === "fase_regular" &&
        p.home_score !== null &&
        p.away_score !== null
    );
    const config = {
      pointsWin: seleccionado.points_win,
      pointsDraw: seleccionado.points_draw,
      pointsLoss: seleccionado.points_loss,
      tiebreaker: seleccionado.tiebreaker as "diferencia_gol" | "enfrentamiento_directo",
    };

    const armarSeccion = (
      titulo: string | null,
      teamIds: string[],
      partidos: typeof regulares
    ) => {
      const tabla = calcularTabla(
        teamIds,
        partidos.map((p) => ({
          homeTeamId: p.home_team_id,
          awayTeamId: p.away_team_id,
          homeScore: p.home_score!,
          awayScore: p.away_score!,
        })),
        config
      );
      const valla = vallaMenosVencida(tabla);
      return {
        titulo,
        vallaId: valla?.teamId ?? null,
        filas: tabla.map((f) => ({ ...f, nombre: nombreEquipo.get(f.teamId) ?? "—" })),
      };
    };

    if (seleccionado.format === "grupos_playoffs") {
      const grupos = [...new Set(regulares.map((p) => p.group_name).filter(Boolean))].sort() as string[];
      secciones = grupos.map((g) => {
        const delGrupo = regulares.filter((p) => p.group_name === g);
        const equipos = [...new Set(delGrupo.flatMap((p) => [p.home_team_id, p.away_team_id]))];
        return armarSeccion(`Grupo ${g}`, equipos, delGrupo);
      });
      if (secciones.length === 0) {
        secciones = [armarSeccion(null, (insc ?? []).map((i) => i.team_id), [])];
      }
    } else {
      secciones = [armarSeccion(null, (insc ?? []).map((i) => i.team_id), regulares)];
    }

    // Campeón: ganador de la final confirmada
    const final = (confirmados ?? []).find(
      (p) => p.stage === "final" && p.home_score !== null && p.away_score !== null
    );
    if (final) {
      campeon =
        nombreEquipo.get(
          final.home_score > final.away_score ? final.home_team_id : final.away_team_id
        ) ?? null;
    }
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

      {/* Campeón */}
      {campeon && (
        <div className="bg-gradient-to-r from-[#1A2A44] to-[#2A3A5C] rounded-2xl p-6 shadow-md text-center flex flex-col items-center gap-1">
          <Trophy className="w-8 h-8 text-[#F97316]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">
            Campeón del torneo
          </p>
          <p className="font-serif text-2xl font-black text-white">{campeon}</p>
        </div>
      )}

      {seleccionado &&
        secciones.map((seccion, idx) => (
          <div
            key={seccion.titulo ?? "tabla"}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-serif text-lg font-black text-[#1A2A44]">
                {seccion.titulo ? `${seleccionado.name} · ${seccion.titulo}` : seleccionado.name}
              </h2>
              {seccion.vallaId && (
                <span className="text-[10px] font-bold text-green-700 bg-green-50 rounded-full px-2.5 py-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Valla menos vencida:{" "}
                  {seccion.filas.find((f) => f.teamId === seccion.vallaId)?.nombre}
                </span>
              )}
            </div>
            <TablaPosiciones filas={seccion.filas} vallaId={seccion.vallaId} />
            {idx === secciones.length - 1 && (
              <p className="text-[10px] text-slate-400">
                Se actualiza automáticamente con los resultados confirmados por la federación.
                Los partidos de playoff no suman puntos.
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
