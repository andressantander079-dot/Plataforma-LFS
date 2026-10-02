"use server";

/**
 * BADGES DE NAVEGACIÓN — Cuenta los pendientes de cada rol para las
 * burbujas rojas de la barra inferior móvil (estilo WhatsApp).
 * El cliente la llama al montar y cada vez que llega un cambio realtime.
 * Devuelve un mapa { "/ruta": cantidad } — solo rutas con pendientes.
 */
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

export async function obtenerBadgesNav(): Promise<Record<string, number>> {
  try {
    const supabase = await createLfsServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, club_id")
      .eq("id", user.id)
      .single();
    if (!profile) return {};

    const badges: Record<string, number> = {};
    const ahora = new Date().toISOString();

    // ---------------- ADMIN / TESORERO ----------------
    if (profile.role === "admin" || profile.role === "tesorero") {
      const { count: pasesPendientes } = await supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .in("status", ["2_FVF_REVIEW", "6_FINAL_AUDIT"]);
      if ((pasesPendientes ?? 0) > 0) badges["/admin/tramites"] = pasesPendientes!;

      const { count: pagosPorAprobar } = await supabase
        .from("treasury_payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente");
      if ((pagosPorAprobar ?? 0) > 0) badges["/admin/tesoreria"] = pagosPorAprobar!;

      const { count: sinCargar } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("status", "programado")
        .lt("scheduled_at", ahora);
      if ((sinCargar ?? 0) > 0) badges["/admin/competencias"] = sinCargar!;
      return badges;
    }

    // ---------------- CLUB ----------------
    if (profile.role === "club" && profile.club_id) {
      const clubId = profile.club_id;

      const { count: porDictaminar } = await supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("from_club_id", clubId)
        .eq("status", "4_CLUB_B_DECISION");
      if ((porDictaminar ?? 0) > 0) badges["/club/tramites"] = porDictaminar!;

      // Planillas de mis equipos que todavía no confirmé
      const { data: misEquipos } = await supabase
        .from("teams")
        .select("id")
        .eq("club_id", clubId);
      const teamIds = (misEquipos ?? []).map((t) => t.id);

      if (teamIds.length > 0) {
        const { data: proximos } = await supabase
          .from("matches")
          .select("id, home_team_id, away_team_id")
          .in("home_team_id", teamIds)
          .eq("status", "programado")
          .gte("scheduled_at", ahora)
          .limit(50);
        const { data: proximosVisita } = await supabase
          .from("matches")
          .select("id, home_team_id, away_team_id")
          .in("away_team_id", teamIds)
          .eq("status", "programado")
          .gte("scheduled_at", ahora)
          .limit(50);

        const partidos = [...(proximos ?? []), ...(proximosVisita ?? [])];
        const matchIds = partidos.map((p) => p.id);
        if (matchIds.length > 0) {
          const { data: planillas } = await supabase
            .from("match_sheets")
            .select("match_id, confirmada_local, confirmada_visitante")
            .in("match_id", matchIds);
          const planillaPorMatch = new Map((planillas ?? []).map((p) => [p.match_id, p]));
          const misIds = new Set(teamIds);
          let sinConfirmar = 0;
          for (const p of partidos) {
            const planilla = planillaPorMatch.get(p.id);
            const soyLocal = misIds.has(p.home_team_id);
            if (soyLocal && !planilla?.confirmada_local) sinConfirmar++;
            if (!soyLocal && !planilla?.confirmada_visitante) sinConfirmar++;
          }
          if (sinConfirmar > 0) badges["/club/partidos"] = sinConfirmar;
        }
      }
      return badges;
    }

    // ---------------- ÁRBITRO ----------------
    if (profile.role === "arbitro" || profile.role === "arbitro_asistente") {
      const { count: porCargar } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("referee_id", user.id)
        .eq("status", "programado")
        .lt("scheduled_at", ahora);
      if ((porCargar ?? 0) > 0) badges["/arbitro/planillas"] = porCargar!;

      const { count: proximas } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("referee_id", user.id)
        .eq("status", "programado")
        .gte("scheduled_at", ahora);
      if ((proximas ?? 0) > 0) badges["/arbitro/designaciones"] = proximas!;
      return badges;
    }

    return badges;
  } catch (err) {
    console.error("Error al obtener badges de navegación:", err);
    return {};
  }
}
