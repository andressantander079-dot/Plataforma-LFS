import { redirect } from "next/navigation";
import Link from "next/link";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { CalendarClock, MapPin, Award, ClipboardList, MessageSquare, FileWarning, ArrowRight } from "lucide-react";
import { SaludoInteligente } from "@/components/dashboards/SaludoInteligente";
import { ListaAtencion } from "@/components/dashboards/ListaAtencion";
import { HeroProximoPartido } from "@/components/dashboards/HeroProximoPartido";
import { QuickActions } from "@/components/dashboards/QuickActions";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";
import { clasificarUrgencia, textoConteo, type ItemAtencion } from "@/lib/core/rules/dashboardRules";

/**
 * PANEL DEL ÁRBITRO — Versión básica REAL.
 * Próximas designaciones (con héroe + cuenta regresiva), planillas
 * pendientes de carga y accesos rápidos. Se actualiza en tiempo real.
 */
export const dynamic = "force-dynamic";

export default async function RefereeDashboard() {
  const supabase = await createLfsServerClient();
  const ahora = new Date();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Todas mis designaciones (programadas), ordenadas por fecha
  const { data: designaciones } = await supabase
    .from("matches")
    .select("id, scheduled_at, venue_id, status, matchday, home_team_id, away_team_id, competitions(name, season), venues(name)")
    .eq("referee_id", user.id)
    .eq("status", "programado")
    .order("scheduled_at", { ascending: true, nullsFirst: false })
    .limit(30);

  const lista = designaciones ?? [];
  const equipoIds = new Set<string>();
  for (const d of lista) {
    equipoIds.add(d.home_team_id);
    equipoIds.add(d.away_team_id);
  }
  const { data: equipos } = equipoIds.size
    ? await supabase.from("teams").select("id, name").in("id", [...equipoIds])
    : { data: [] };
  const nombreEquipo = new Map((equipos ?? []).map((t) => [t.id, t.name as string]));

  const proximas = lista.filter(
    (d) => d.scheduled_at !== null && new Date(d.scheduled_at).getTime() > ahora.getTime() - 3 * 3_600_000
  );
  const pendientesCarga = lista.filter(
    (d) => d.scheduled_at !== null && new Date(d.scheduled_at).getTime() <= ahora.getTime()
  );

  const siguiente = proximas[0] ?? null;

  const items: ItemAtencion[] = [];
  if (pendientesCarga.length > 0) {
    items.push({
      nivel: clasificarUrgencia(pendientesCarga[0]?.scheduled_at ?? null, ahora, 48),
      titulo: textoConteo(pendientesCarga.length, "planilla sin cargar", "planillas sin cargar"),
      detalle: "Partidos que ya dirigiste y todavía no tienen el resultado cargado.",
      href: "/arbitro/planillas",
      accion: "Cargar",
    });
  }
  if (proximas.length > 0) {
    items.push({
      nivel: "info",
      titulo: textoConteo(proximas.length, "designación próxima", "designaciones próximas"),
      detalle: "Revisá fecha, hora y cancha de tus próximos partidos.",
      href: "/arbitro/designaciones",
      accion: "Ver",
    });
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <RealtimeRefresher tablas={["matches", "match_sheets"]} />

      <SaludoInteligente
        nombre={profile?.full_name ?? null}
        pendientes={pendientesCarga.length}
        rol="Arbitraje LFS"
      />

      {siguiente && (
        <HeroProximoPartido
          miEquipo={nombreEquipo.get(siguiente.home_team_id) ?? "Local"}
          rival={nombreEquipo.get(siguiente.away_team_id) ?? "Visitante"}
          esLocal={true}
          torneo={
            (siguiente.competitions as unknown as { name: string; season: string | null } | null)
              ? `${(siguiente.competitions as unknown as { name: string }).name} ${(siguiente.competitions as unknown as { season: string | null }).season ?? ""}`.trim()
              : "Torneo LFS"
          }
          cancha={(siguiente.venues as unknown as { name: string } | null)?.name ?? null}
          fechaISO={siguiente.scheduled_at as string}
          hrefPartidos="/arbitro/designaciones"
        />
      )}

      <ListaAtencion items={items} />

      {/* Lista de próximas designaciones */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#F97316]" />
          <h2 className="font-serif text-base font-bold text-[#1A2A44]">
            Mis próximas designaciones
          </h2>
        </div>

        {proximas.length === 0 ? (
          <p className="text-slate-400 text-xs italic">
            No tenés partidos asignados por ahora. Cuando la liga te designe, aparecen acá.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {proximas.map((d) => {
              const fecha = new Date(d.scheduled_at as string);
              return (
                <div key={d.id} className="py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1A2A44]/5 flex flex-col items-center justify-center shrink-0">
                    <span className="text-sm font-black text-[#1A2A44] leading-none">
                      {fecha.toLocaleDateString("es-AR", { day: "2-digit", timeZone: "America/Argentina/Ushuaia" })}
                    </span>
                    <span className="text-[8px] font-bold uppercase text-slate-400">
                      {fecha.toLocaleDateString("es-AR", { month: "short", timeZone: "America/Argentina/Ushuaia" })}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1A2A44] truncate">
                      {nombreEquipo.get(d.home_team_id) ?? "Local"} vs {nombreEquipo.get(d.away_team_id) ?? "Visitante"}
                    </p>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-[#F97316] shrink-0" />
                      {(d.venues as unknown as { name: string } | null)?.name ?? "Cancha a confirmar"}
                      {" · "}
                      {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Ushuaia" })} hs
                    </p>
                  </div>
                  {typeof d.matchday === "number" && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] shrink-0">
                      Fecha {d.matchday}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pendientesCarga.length > 0 && (
          <Link
            href="/arbitro/planillas"
            className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F97316]"
          >
            <FileWarning className="w-3.5 h-3.5" />
            Tenés {pendientesCarga.length} planilla{pendientesCarga.length === 1 ? "" : "s"} por cargar
            <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </section>

      <QuickActions
        acciones={[
          { href: "/arbitro/planillas", label: "Mis planillas", icono: Award },
          { href: "/arbitro/designaciones", label: "Designaciones", icono: CalendarClock },
          { href: "/arbitro/mensajeria", label: "Mensajería", icono: MessageSquare },
          { href: "/arbitro/perfil", label: "Mi perfil", icono: ClipboardList },
        ]}
      />
    </div>
  );
}
