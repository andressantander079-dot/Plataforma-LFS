import { redirect } from "next/navigation";
import Link from "next/link";
import { Trophy, Plus, MapPin, Users, CalendarRange } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * COMPETENCIAS — Lista de torneos (admin)
 */

const ESTADO_UI: Record<string, { label: string; className: string }> = {
  borrador: { label: "Borrador", className: "bg-slate-100 text-slate-600" },
  en_curso: { label: "En curso", className: "bg-green-100 text-green-700" },
  finalizado: { label: "Finalizado", className: "bg-[#1A2A44]/10 text-[#1A2A44]" },
};

export default async function AdminCompetencias() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: torneos } = await supabase
    .from("competitions")
    .select("id, name, season, format, status, categories(name), competition_teams(count), matches(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#F97316]" />
            Competencias
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Torneos por categoría: equipos, fixture, resultados y tablas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/competencias/canchas"
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-[#1A2A44] text-xs font-bold hover:border-[#F97316] hover:text-[#F97316] transition flex items-center gap-1.5"
          >
            <MapPin className="w-4 h-4" /> Canchas
          </Link>
          <Link
            href="/admin/competencias/crear"
            className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Crear Torneo
          </Link>
        </div>
      </div>

      {(torneos ?? []).length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center gap-3 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-serif text-lg font-bold text-[#1A2A44]">Todavía no hay torneos</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Creá el primero con el botón de arriba. Los clubes habilitados se inscriben
            automáticamente y después generás el fixture con un clic.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(torneos ?? []).map((t) => {
          const categoria = (t.categories as unknown as { name: string } | null)?.name ?? "—";
          const equipos = (t.competition_teams as unknown as { count: number }[])[0]?.count ?? 0;
          const partidos = (t.matches as unknown as { count: number }[])[0]?.count ?? 0;
          const estado = ESTADO_UI[t.status] ?? ESTADO_UI.borrador;

          return (
            <Link
              key={t.id}
              href={`/admin/competencias/${t.id}`}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#F97316]/60 hover:shadow-md transition flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-serif text-lg font-black text-[#1A2A44] truncate">
                    {t.name}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {categoria} · Temporada {t.season} · {t.format === "liga" ? "Liga" : t.format}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${estado.className}`}>
                  {estado.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-[#F97316]" /> {equipos} equipos
                </span>
                <span className="flex items-center gap-1">
                  <CalendarRange className="w-3.5 h-3.5 text-[#F97316]" /> {partidos} partidos
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
