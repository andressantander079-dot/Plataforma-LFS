import Link from "next/link";
import {
  Users,
  UserRound,
  ClipboardList,
  FileWarning,
  Trophy,
  CalendarPlus,
  Wallet,
  Store,
  TrendingUp,
} from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { bucketsPorDia, clasificarUrgencia, textoConteo, type ItemAtencion } from "@/lib/core/rules/dashboardRules";
import { SaludoInteligente } from "@/components/dashboards/SaludoInteligente";
import { TarjetaKpi } from "@/components/dashboards/TarjetaKpi";
import { ListaAtencion } from "@/components/dashboards/ListaAtencion";
import { QuickActions } from "@/components/dashboards/QuickActions";
import { FeedActividad, type ItemActividad } from "@/components/dashboards/FeedActividad";
import { Sparkline } from "@/components/dashboards/Sparkline";
import { RealtimeRefresher } from "@/components/realtime/RealtimeRefresher";

/**
 * DASHBOARD ADMIN — Centro de comando de la federación (DATOS REALES).
 * KPIs: clubes activos, jugadores inscriptos, trámites pendientes,
 * planillas sin cargar. Semáforo 48 hs, sparkline de actividad de los
 * últimos 30 días y feed de auditoría. Se actualiza en tiempo real.
 */
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createLfsServerClient();
  const ahora = new Date();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("full_name").eq("id", user.id).single()
    : { data: null };

  // ---------------- Consultas en paralelo ----------------
  const hace30Dias = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();

  const [
    { count: clubesActivos },
    { count: clubesEnRevision },
    { count: jugadoresInscriptos },
    { data: pasesPendientes },
    { data: settingsPases },
    { data: partidosSinCargar },
    { data: partidos30d },
    { count: pagosPorAprobar },
    { data: actividad },
  ] = await Promise.all([
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("status", "habilitado"),
    supabase.from("clubs").select("id", { count: "exact", head: true }).eq("status", "en_revision"),
    supabase.from("players").select("id", { count: "exact", head: true }),
    supabase
      .from("transfers")
      .select("id, status, created_at")
      .in("status", ["2_FVF_REVIEW", "6_FINAL_AUDIT"]),
    supabase.from("pase_settings").select("alerta_trabado_horas").eq("id", 1).maybeSingle(),
    supabase
      .from("matches")
      .select("id, scheduled_at")
      .eq("status", "programado")
      .lt("scheduled_at", ahora.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(50),
    supabase
      .from("matches")
      .select("scheduled_at")
      .eq("result_confirmed", true)
      .gte("scheduled_at", hace30Dias),
    supabase.from("treasury_payments").select("id", { count: "exact", head: true }).eq("status", "pendiente"),
    supabase
      .from("audit_logs")
      .select("id, action, module, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // ---------------- Semáforo "Requiere atención" ----------------
  const horasTrabado = Number(settingsPases?.alerta_trabado_horas ?? 48);
  const trabados = (pasesPendientes ?? []).filter(
    (p) =>
      p.status === "2_FVF_REVIEW" &&
      ahora.getTime() - new Date(p.created_at).getTime() > horasTrabado * 3_600_000
  );
  const tramitesPendientes = (pasesPendientes ?? []).length;
  const planillasSinCargar = (partidosSinCargar ?? []).length;

  const items: ItemAtencion[] = [];

  if (trabados.length > 0) {
    items.push({
      nivel: "rojo",
      titulo: textoConteo(trabados.length, "pase trabado", "pases trabados"),
      detalle: `Esperan tu dictamen hace más de ${horasTrabado} hs. Se cancelan solos si pasan 72 hs.`,
      href: "/admin/tramites",
      accion: "Dictaminar",
    });
  }

  const peorPlanilla = (partidosSinCargar ?? [])[0];
  if (planillasSinCargar > 0) {
    items.push({
      nivel: clasificarUrgencia(peorPlanilla?.scheduled_at ?? null, ahora, 48),
      titulo: textoConteo(planillasSinCargar, "planilla sin cargar", "planillas sin cargar"),
      detalle: "Partidos ya jugados cuyo resultado todavía no fue cargado por el árbitro.",
      href: "/admin/designaciones",
      accion: "Revisar",
    });
  }

  if ((pagosPorAprobar ?? 0) > 0) {
    items.push({
      nivel: "amarillo",
      titulo: textoConteo(pagosPorAprobar ?? 0, "pago por aprobar", "pagos por aprobar"),
      detalle: "Comprobantes informados por los clubes esperando verificación de tesorería.",
      href: "/admin/tesoreria/movimientos",
      accion: "Verificar",
    });
  }

  const pasesNoTrabados = tramitesPendientes - trabados.length;
  if (pasesNoTrabados > 0) {
    items.push({
      nivel: "amarillo",
      titulo: textoConteo(pasesNoTrabados, "trámite en curso", "trámites en curso"),
      detalle: "Pases esperando revisión o auditoría final de la liga.",
      href: "/admin/tramites",
      accion: "Ver",
    });
  }

  if ((clubesEnRevision ?? 0) > 0) {
    items.push({
      nivel: "info",
      titulo: textoConteo(clubesEnRevision ?? 0, "club en revisión", "clubes en revisión"),
      detalle: "Clubes que pidieron habilitación y esperan aprobación.",
      href: "/admin/equipos",
      accion: "Revisar",
    });
  }

  // Sparkline: partidos confirmados por día, últimos 30 días
  const spark30 = bucketsPorDia(
    (partidos30d ?? []).map((p) => p.scheduled_at as string),
    30,
    ahora
  );
  const totalPartidos30d = spark30.reduce((a, b) => a + b, 0);

  const pendientesTotales = items.filter((i) => i.nivel !== "info").length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6">
      <RealtimeRefresher
        tablas={["matches", "transfers", "players", "clubs", "treasury_payments", "audit_logs"]}
      />

      <SaludoInteligente
        nombre={profile?.full_name ?? null}
        pendientes={pendientesTotales}
        rol="Administración LFS"
      />

      <ListaAtencion items={items} />

      {/* KPIs principales */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TarjetaKpi
          titulo="Clubes activos"
          valor={clubesActivos ?? 0}
          detalle={clubesEnRevision ? `${clubesEnRevision} en revisión` : "Habilitados"}
          icono={Store}
          acento="azul"
          href="/admin/equipos"
        />
        <TarjetaKpi
          titulo="Jugadores inscriptos"
          valor={jugadoresInscriptos ?? 0}
          detalle="Fichados en la liga"
          icono={Users}
          acento="verde"
          href="/admin/equipos"
        />
        <TarjetaKpi
          titulo="Trámites pendientes"
          valor={tramitesPendientes}
          detalle={trabados.length > 0 ? `${trabados.length} trabados` : "Pases en circuito"}
          icono={ClipboardList}
          acento={trabados.length > 0 ? "rojo" : "naranja"}
          href="/admin/tramites"
        />
        <TarjetaKpi
          titulo="Planillas sin cargar"
          valor={planillasSinCargar}
          detalle="Resultados pendientes"
          icono={FileWarning}
          acento={planillasSinCargar > 0 ? "rojo" : "verde"}
          href="/admin/designaciones"
        />
      </section>

      {/* Actividad de la liga: sparkline 30 días */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#F97316]" />
            <h2 className="font-serif text-base font-bold text-[#1A2A44]">
              Actividad de la liga
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            {totalPartidos30d} partidos en 30 días
          </span>
        </div>
        <div className="h-20">
          <Sparkline valores={spark30} id="admin-30d" ancho={600} alto={80} />
        </div>
        <p className="text-[10px] text-slate-400">
          Partidos con resultado confirmado por día, últimos 30 días.
        </p>
      </section>

      <QuickActions
        acciones={[
          { href: "/admin/competencias", label: "Torneos y fixture", icono: Trophy },
          { href: "/admin/agenda", label: "Agenda de fechas", icono: CalendarPlus },
          { href: "/admin/tramites", label: "Revisar pases", icono: ClipboardList },
          { href: "/admin/tesoreria/movimientos", label: "Verificar pagos", icono: Wallet },
        ]}
      />

      <FeedActividad items={(actividad ?? []) as ItemActividad[]} />

      <p className="text-center text-[10px] text-slate-400 pb-6">
        ¿Buscás el detalle completo? Entrá a{" "}
        <Link href="/admin/estadisticas" className="text-[#F97316] font-bold">
          Estadísticas
        </Link>{" "}
        o al módulo correspondiente desde el menú.
      </p>
    </div>
  );
}
