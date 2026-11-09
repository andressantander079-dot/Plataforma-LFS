"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import { crearMultaAutomatica } from "@/lib/actions/tesoreria.actions";
import {
  faltasAcumuladas,
  marcadorDesdeEventos,
  minutoTotal as calcularMinutoTotal,
  nivelFaltas,
  numerosDuplicados,
  puedePedirTiempo,
  TITULARES_REQUERIDOS,
  type FaltasPorTiempo,
  type NivelFaltas,
  type TipoEvento,
} from "@/lib/core/rules/planillaPremiumRules";
import {
  ganadorFigura,
  registrarVoto,
  rutaFirma,
  type MapaFirmas,
  type RolFirma,
  type VotanteFigura,
  type VotoFigura,
} from "@/lib/core/rules/firmasRules";
import type { FaseReloj } from "@/lib/core/rules/relojRules";

/**
 * PLANILLA EN VIVO — Paso 17C
 * El corazón premium del partido: reloj con cuenta regresiva, eventos
 * con minuto automático, faltas acumuladas, tiempos pedidos, semáforo
 * pre-partido, multi-oficial (2do árbitro + planillero), firmas
 * digitales, votación de la figura, ausencia/suspensión con motivo y
 * la transmisión pública en tiempo real.
 *
 * No reemplaza a planilla.actions.ts (Paso 7A): la convocatoria, la
 * confirmación de clubes y la aprobación de la federación siguen ahí.
 */

// ---------- Tipos ----------

export interface OficialPartido {
  id: string;
  userId: string;
  nombre: string;
  rol: "segundo_arbitro" | "planillero";
  modo: "directa" | "propuesta";
  estado: "pendiente" | "aceptada" | "rechazada";
}

export interface ConvocadoVivo {
  sheetPlayerId: string;
  playerId: string;
  nombre: string;
  teamId: string;
  esTitular: boolean;
  numero: number | null;
  agregadoPor: string;
}

export interface EventoVivo {
  id: string;
  tipo: TipoEvento;
  teamId: string;
  playerId: string | null;
  jugadorNombre: string;
  relacionadoNombre: string | null;
  asistenteNombre: string | null;
  minuto: number | null;
  tiempo: "PT" | "ST" | null;
  minutoTotal: number | null;
  createdBy: string | null;
  createdAt: string;
}

export interface CuerpoTecnico {
  dtLocal: string;
  ayudanteLocal: string;
  dtVisitante: string;
  ayudanteVisitante: string;
  planilleroNombre: string;
}

export interface PlanillaEnVivo {
  matchId: string;
  competitionId: string;
  torneo: string;
  categoria: string;
  temporada: string;
  scheduledAt: string | null;
  cancha: string | null;
  statusPartido: string;
  motivoEstado: string | null;
  ausenteTeamId: string | null;
  homeTeamId: string;
  awayTeamId: string;
  clubLocalId: string;
  clubVisitanteId: string;
  local: string;
  visitante: string;
  homeScore: number | null;
  awayScore: number | null;
  colorLocal: string | null;
  colorVisitante: string | null;
  figuraPlayerId: string | null;
  figuraNombre: string | null;
  // reloj
  liveStatus: FaseReloj;
  relojCorriendo: boolean;
  relojIniciadoAt: string | null;
  relojSegundosBase: number;
  duracionTiempoMin: number;
  duracionEntretiempoMin: number;
  // planilla
  sheetId: string | null;
  sheetStatus: string | null;
  confirmadaLocal: string | null;
  confirmadaVisitante: string | null;
  staffConfirmado: boolean;
  cuerpoTecnico: CuerpoTecnico;
  observaciones: string | null;
  firmas: MapaFirmas;
  votosFigura: VotoFigura[];
  capitanLocalId: string | null;
  capitanVisitanteId: string | null;
  cerradaAt: string | null;
  // datos
  arbitroPrincipalId: string | null;
  arbitroPrincipalNombre: string | null;
  oficiales: OficialPartido[];
  convocados: ConvocadoVivo[];
  eventos: EventoVivo[];
  // permisos del que mira
  esAdmin: boolean;
  esPrincipal: boolean;
  esSegundo: boolean;
  esPlanillero: boolean;
  puedeCargar: boolean; // principal o 2do (aceptado) o admin
  puedeCerrar: boolean; // solo principal o admin
  miClubId: string | null;
}

export interface AlertasEvento {
  dobleAmarilla: boolean;
  jugadorExpulsadoAntes: boolean;
  faltasEquipo: number;
  nivelFaltas: NivelFaltas;
}

type Supabase = Awaited<ReturnType<typeof createLfsServerClient>>;

// ---------- Contexto y permisos ----------

async function obtenerContexto() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id, full_name")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    role: (profile?.role ?? "club") as string,
    nombre: (profile?.full_name ?? "") as string,
    clubId: (profile?.club_id ?? null) as string | null,
  };
}

interface PermisosPartido {
  esAdmin: boolean;
  esPrincipal: boolean;
  esSegundo: boolean;
  esPlanillero: boolean;
  puedeCargar: boolean;
  puedeCerrar: boolean;
}

async function permisosDePartido(
  supabase: Supabase,
  userId: string,
  role: string,
  matchId: string,
  refereeId: string | null
): Promise<PermisosPartido> {
  const esAdmin = role === "admin";
  const esPrincipal = Boolean(refereeId && refereeId === userId);

  const { data: oficial } = await supabase
    .from("match_officials")
    .select("rol, designacion_estado")
    .eq("match_id", matchId)
    .eq("user_id", userId)
    .eq("designacion_estado", "aceptada")
    .maybeSingle();

  const esSegundo = oficial?.rol === "segundo_arbitro";
  const esPlanillero = oficial?.rol === "planillero";

  return {
    esAdmin,
    esPrincipal,
    esSegundo,
    esPlanillero,
    // Cargan eventos: principal y 2do. Cierra: solo el principal.
    // El admin puede todo (modo override).
    puedeCargar: esAdmin || esPrincipal || esSegundo,
    puedeCerrar: esAdmin || esPrincipal,
  };
}

function revalidarVivo(matchId: string) {
  revalidatePath(`/arbitro/planillas/${matchId}`);
  revalidatePath(`/club/partidos/${matchId}`);
  revalidatePath(`/admin/planillas/${matchId}`);
  revalidatePath(`/en-vivo/${matchId}`);
  revalidatePath("/en-vivo");
  revalidatePath("/");
  revalidatePath("/fixture");
}

// ---------- Notificaciones internas (best-effort, nunca rompen) ----------

async function notificarClub(clubId: string | null, texto: string, senderId: string) {
  if (!clubId) return;
  try {
    const admin = createLfsAdminClient();
    let { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("club_id", clubId)
      .maybeSingle();
    if (!conv) {
      const { data: nueva } = await admin
        .from("conversations")
        .insert({ club_id: clubId, last_message_at: new Date().toISOString() })
        .select("id")
        .single();
      conv = nueva;
    }
    if (!conv) return;
    await admin.from("messages").insert({
      conversation_id: conv.id,
      sender_id: senderId,
      body: texto,
    });
  } catch {
    // silencioso: el aviso es un plus
  }
}

async function notificarArbitro(arbitroId: string | null, texto: string, senderId: string) {
  if (!arbitroId) return;
  try {
    const admin = createLfsAdminClient();
    let { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("arbitro_id", arbitroId)
      .maybeSingle();
    if (!conv) {
      const { data: nueva } = await admin
        .from("conversations")
        .insert({ arbitro_id: arbitroId, last_message_at: new Date().toISOString() })
        .select("id")
        .single();
      conv = nueva;
    }
    if (!conv) return;
    await admin.from("messages").insert({
      conversation_id: conv.id,
      sender_id: senderId,
      body: texto,
    });
  } catch {
    // silencioso
  }
}

// ---------- Lectura principal ----------

export async function obtenerPlanillaEnVivo(matchId: string): Promise<{
  data?: PlanillaEnVivo;
  error?: string;
}> {
  try {
    const { supabase, user, role, clubId } = await obtenerContexto();

    const { data: match, error } = await supabase
      .from("matches")
      .select(
        `id, competition_id, matchday, scheduled_at, venue_id, referee_id, status,
         home_team_id, away_team_id, home_score, away_score,
         live_status, duracion_tiempo_min, duracion_entretiempo_min,
         reloj_iniciado_at, reloj_segundos_base, reloj_corriendo,
         motivo_estado, ausente_team_id, color_local, color_visitante,
         figura_player_id, en_vivo_desde`
      )
      .eq("id", matchId)
      .single();
    if (error || !match) return { error: "No se encontró el partido." };

    const teamIds = [match.home_team_id, match.away_team_id];
    const [
      { data: equipos },
      { data: torneo },
      { data: cancha },
      { data: arbitro },
      { data: sheet },
      { data: oficialesRaw },
    ] = await Promise.all([
      supabase.from("teams").select("id, club_id, category_id, name").in("id", teamIds),
      supabase
        .from("competitions")
        .select("id, name, season, category_id")
        .eq("id", match.competition_id)
        .single(),
      match.venue_id
        ? supabase.from("venues").select("name").eq("id", match.venue_id).single()
        : Promise.resolve({ data: null }),
      match.referee_id
        ? supabase.from("profiles").select("full_name").eq("id", match.referee_id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("match_sheets")
        .select(
          `id, status, confirmada_local, confirmada_visitante, observaciones,
           cuerpo_tecnico, staff_confirmado, firmas, votos_figura,
           capitan_local_id, capitan_visitante_id, cerrada_at`
        )
        .eq("match_id", matchId)
        .maybeSingle(),
      supabase
        .from("match_officials")
        .select("id, user_id, rol, designacion_modo, designacion_estado")
        .eq("match_id", matchId),
    ]);

    const local = (equipos ?? []).find((e) => e.id === match.home_team_id);
    const visitante = (equipos ?? []).find((e) => e.id === match.away_team_id);
    if (!local || !visitante) return { error: "El partido no tiene equipos válidos." };

    const { data: categoria } = torneo?.category_id
      ? await supabase.from("categories").select("name").eq("id", torneo.category_id).single()
      : { data: null };

    // Nombres de los oficiales (mapa aparte, patrón del proyecto)
    const oficialUserIds = (oficialesRaw ?? []).map((o) => o.user_id as string);
    const { data: perfilesOficiales } = oficialUserIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", oficialUserIds)
      : { data: [] };
    const nombrePorId = new Map(
      (perfilesOficiales ?? []).map((p) => [p.id as string, (p.full_name ?? "") as string])
    );

    const oficiales: OficialPartido[] = (oficialesRaw ?? []).map((o) => ({
      id: o.id as string,
      userId: o.user_id as string,
      nombre: nombrePorId.get(o.user_id as string) ?? "Sin nombre",
      rol: o.rol as OficialPartido["rol"],
      modo: o.designacion_modo as OficialPartido["modo"],
      estado: o.designacion_estado as OficialPartido["estado"],
    }));

    // Convocados + eventos (si hay planilla)
    let convocados: ConvocadoVivo[] = [];
    const eventos: EventoVivo[] = [];

    if (sheet) {
      const { data: convRaw } = await supabase
        .from("match_sheet_players")
        .select("id, player_id, team_id, es_titular, numero_camiseta, agregado_por")
        .eq("sheet_id", sheet.id);

      const playerIds = (convRaw ?? []).map((c) => c.player_id as string);
      const { data: jugadores } = playerIds.length
        ? await supabase.from("players").select("id, first_name, last_name").in("id", playerIds)
        : { data: [] };
      const nombreJugador = new Map(
        (jugadores ?? []).map((p) => [
          p.id as string,
          `${p.first_name} ${p.last_name}`,
        ])
      );

      convocados = (convRaw ?? []).map((c) => ({
        sheetPlayerId: c.id as string,
        playerId: c.player_id as string,
        nombre: nombreJugador.get(c.player_id as string) ?? "Jugador",
        teamId: c.team_id as string,
        esTitular: Boolean(c.es_titular),
        numero: (c.numero_camiseta ?? null) as number | null,
        agregadoPor: (c.agregado_por ?? "club") as string,
      }));

      const { data: evRaw } = await supabase
        .from("match_events")
        .select(
          "id, tipo, team_id, player_id, jugador_relacionado_id, asistente_id, minuto, tiempo, minuto_total, created_by, created_at"
        )
        .eq("match_id", matchId)
        .order("created_at", { ascending: true });

      const idsEvento = new Set<string>();
      for (const e of evRaw ?? []) {
        if (e.player_id) idsEvento.add(e.player_id as string);
        if (e.jugador_relacionado_id) idsEvento.add(e.jugador_relacionado_id as string);
        if (e.asistente_id) idsEvento.add(e.asistente_id as string);
      }
      const faltan = [...idsEvento].filter((id) => !nombreJugador.has(id));
      if (faltan.length) {
        const { data: extra } = await supabase
          .from("players")
          .select("id, first_name, last_name")
          .in("id", faltan);
        for (const p of extra ?? []) {
          nombreJugador.set(p.id as string, `${p.first_name} ${p.last_name}`);
        }
      }

      for (const e of evRaw ?? []) {
        eventos.push({
          id: e.id as string,
          tipo: e.tipo as TipoEvento,
          teamId: e.team_id as string,
          playerId: (e.player_id ?? null) as string | null,
          jugadorNombre: e.player_id
            ? nombreJugador.get(e.player_id as string) ?? "Jugador"
            : "—",
          relacionadoNombre: e.jugador_relacionado_id
            ? nombreJugador.get(e.jugador_relacionado_id as string) ?? null
            : null,
          asistenteNombre: e.asistente_id
            ? nombreJugador.get(e.asistente_id as string) ?? null
            : null,
          minuto: (e.minuto ?? null) as number | null,
          tiempo: (e.tiempo ?? null) as "PT" | "ST" | null,
          minutoTotal: (e.minuto_total ?? null) as number | null,
          createdBy: (e.created_by ?? null) as string | null,
          createdAt: e.created_at as string,
        });
      }
    }

    // Figura del partido (nombre)
    let figuraNombre: string | null = null;
    if (match.figura_player_id) {
      const { data: fig } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", match.figura_player_id)
        .maybeSingle();
      if (fig) figuraNombre = `${fig.first_name} ${fig.last_name}`;
    }

    const permisos = await permisosDePartido(
      supabase,
      user.id,
      role,
      matchId,
      (match.referee_id ?? null) as string | null
    );

    const ct = (sheet?.cuerpo_tecnico ?? {}) as Record<string, unknown>;
    const cuerpoTecnico: CuerpoTecnico = {
      dtLocal: (ct.dt_local as string) ?? "",
      ayudanteLocal: (ct.ayudante_local as string) ?? "",
      dtVisitante: (ct.dt_visitante as string) ?? "",
      ayudanteVisitante: (ct.ayudante_visitante as string) ?? "",
      planilleroNombre: (ct.planillero_nombre as string) ?? "",
    };

    const data: PlanillaEnVivo = {
      matchId,
      competitionId: match.competition_id as string,
      torneo: (torneo?.name ?? "") as string,
      categoria: (categoria?.name ?? "") as string,
      temporada: (torneo?.season ?? "") as string,
      scheduledAt: (match.scheduled_at ?? null) as string | null,
      cancha: (cancha?.name ?? null) as string | null,
      statusPartido: match.status as string,
      motivoEstado: (match.motivo_estado ?? null) as string | null,
      ausenteTeamId: (match.ausente_team_id ?? null) as string | null,
      homeTeamId: match.home_team_id as string,
      awayTeamId: match.away_team_id as string,
      clubLocalId: local.club_id as string,
      clubVisitanteId: visitante.club_id as string,
      local: local.name as string,
      visitante: visitante.name as string,
      homeScore: (match.home_score ?? null) as number | null,
      awayScore: (match.away_score ?? null) as number | null,
      colorLocal: (match.color_local ?? null) as string | null,
      colorVisitante: (match.color_visitante ?? null) as string | null,
      figuraPlayerId: (match.figura_player_id ?? null) as string | null,
      figuraNombre,
      liveStatus: (match.live_status ?? "sin_iniciar") as FaseReloj,
      relojCorriendo: Boolean(match.reloj_corriendo),
      relojIniciadoAt: (match.reloj_iniciado_at ?? null) as string | null,
      relojSegundosBase: (match.reloj_segundos_base ?? 0) as number,
      duracionTiempoMin: (match.duracion_tiempo_min ?? 25) as number,
      duracionEntretiempoMin: (match.duracion_entretiempo_min ?? 10) as number,
      sheetId: (sheet?.id ?? null) as string | null,
      sheetStatus: (sheet?.status ?? null) as string | null,
      confirmadaLocal: (sheet?.confirmada_local ?? null) as string | null,
      confirmadaVisitante: (sheet?.confirmada_visitante ?? null) as string | null,
      staffConfirmado: Boolean(sheet?.staff_confirmado),
      cuerpoTecnico,
      observaciones: (sheet?.observaciones ?? null) as string | null,
      firmas: ((sheet?.firmas ?? {}) as MapaFirmas) ?? {},
      votosFigura: ((sheet?.votos_figura ?? []) as VotoFigura[]) ?? [],
      capitanLocalId: (sheet?.capitan_local_id ?? null) as string | null,
      capitanVisitanteId: (sheet?.capitan_visitante_id ?? null) as string | null,
      cerradaAt: (sheet?.cerrada_at ?? null) as string | null,
      arbitroPrincipalId: (match.referee_id ?? null) as string | null,
      arbitroPrincipalNombre: (arbitro?.full_name ?? null) as string | null,
      oficiales,
      convocados,
      eventos,
      ...permisos,
      miClubId: clubId,
    };

    return { data };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Configuración pre-partido (reloj, colores, staff) ----------

export async function configurarReloj(
  matchId: string,
  input: { duracionTiempoMin: number; duracionEntretiempoMin: number }
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal configura el reloj." };
    if (match.live_status !== "sin_iniciar" && match.live_status !== "pre_partido") {
      return { error: "El partido ya arrancó: la duración no se puede cambiar." };
    }
    const duracion = Math.min(45, Math.max(5, Math.round(input.duracionTiempoMin)));
    const entretiempo = Math.min(20, Math.max(1, Math.round(input.duracionEntretiempoMin)));
    const { error } = await supabase
      .from("matches")
      .update({
        duracion_tiempo_min: duracion,
        duracion_entretiempo_min: entretiempo,
        live_status: "pre_partido",
      })
      .eq("id", matchId);
    if (error) return { error: "No se pudo guardar la configuración del reloj." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function guardarColores(
  matchId: string,
  input: { colorLocal: string | null; colorVisitante: string | null }
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCargar) return { error: "No tenés permisos sobre este partido." };

    const valido = (c: string | null) => c === null || /^#[0-9a-fA-F]{6}$/.test(c);
    if (!valido(input.colorLocal) || !valido(input.colorVisitante)) {
      return { error: "El color tiene que ser un código #RRGGBB." };
    }
    const { error } = await supabase
      .from("matches")
      .update({ color_local: input.colorLocal, color_visitante: input.colorVisitante })
      .eq("id", matchId);
    if (error) return { error: "No se pudieron guardar los colores." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

const CLAVES_CT = ["dt_local", "ayudante_local", "dt_visitante", "ayudante_visitante", "planillero_nombre"] as const;

function limpiarNombre(v: unknown): string {
  return String(v ?? "").trim().slice(0, 80);
}

/** El árbitro confirma (o corrige) el cuerpo técnico antes de empezar. */
export async function confirmarStaff(
  matchId: string,
  input: {
    dtLocal: string;
    ayudanteLocal: string;
    dtVisitante: string;
    ayudanteVisitante: string;
    planilleroNombre: string;
  }
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal confirma el cuerpo técnico." };
    if (match.live_status !== "sin_iniciar" && match.live_status !== "pre_partido") {
      return { error: "El partido ya arrancó: el cuerpo técnico quedó registrado." };
    }

    const cuerpoTecnico = {
      dt_local: limpiarNombre(input.dtLocal),
      ayudante_local: limpiarNombre(input.ayudanteLocal),
      dt_visitante: limpiarNombre(input.dtVisitante),
      ayudante_visitante: limpiarNombre(input.ayudanteVisitante),
      planillero_nombre: limpiarNombre(input.planilleroNombre),
    };
    if (!cuerpoTecnico.dt_local || !cuerpoTecnico.dt_visitante) {
      return { error: "Cargá el nombre de los dos DTs (es quien firma la planilla)." };
    }

    const { error } = await supabase
      .from("match_sheets")
      .update({ cuerpo_tecnico: cuerpoTecnico, staff_confirmado: true })
      .eq("match_id", matchId);
    if (error) return { error: "No se pudo guardar el cuerpo técnico." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** El CLUB precarga su DT y ayudante (después el árbitro confirma o corrige). */
export async function precargarCuerpoTecnico(
  matchId: string,
  input: { dt: string; ayudante: string }
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, clubId, role } = await obtenerContexto();
    if (role !== "club" && role !== "admin") {
      return { error: "Solo el club puede precargar su cuerpo técnico." };
    }
    const { data: match } = await supabase
      .from("matches")
      .select("home_team_id, away_team_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    if (match.live_status !== "sin_iniciar" && match.live_status !== "pre_partido") {
      return { error: "El partido ya arrancó." };
    }

    const { data: equipos } = await supabase
      .from("teams")
      .select("id, club_id")
      .in("id", [match.home_team_id, match.away_team_id]);
    const mio = (equipos ?? []).find((t) => role === "admin" || t.club_id === clubId);
    if (!mio) return { error: "Este partido no es de tu club." };

    const { data: sheet } = await supabase
      .from("match_sheets")
      .select("id, cuerpo_tecnico")
      .eq("match_id", matchId)
      .maybeSingle();
    if (!sheet) return { error: "Todavía no hay planilla creada para este partido." };

    const esLocal = mio.id === match.home_team_id;
    const actual = (sheet.cuerpo_tecnico ?? {}) as Record<string, unknown>;
    const nuevo = {
      ...actual,
      [esLocal ? "dt_local" : "dt_visitante"]: limpiarNombre(input.dt),
      [esLocal ? "ayudante_local" : "ayudante_visitante"]: limpiarNombre(input.ayudante),
    };

    const { error } = await supabase
      .from("match_sheets")
      .update({ cuerpo_tecnico: nuevo })
      .eq("id", sheet.id);
    if (error) return { error: "No se pudo guardar el cuerpo técnico." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Números de camiseta y capitanes ----------

export async function guardarNumeroCamiseta(
  matchId: string,
  sheetPlayerId: string,
  numero: number | null
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCargar) return { error: "No tenés permisos sobre este partido." };
    if (numero !== null && (numero < 1 || numero > 99)) {
      return { error: "El número va de 1 a 99." };
    }
    const { error } = await supabase
      .from("match_sheet_players")
      .update({ numero_camiseta: numero })
      .eq("id", sheetPlayerId);
    if (error) return { error: "No se pudo guardar el número." };
    revalidatePath(`/arbitro/planillas/${matchId}`);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function guardarCapitan(
  matchId: string,
  teamId: string,
  playerId: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, home_team_id")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCargar) return { error: "No tenés permisos sobre este partido." };

    const campo =
      teamId === match.home_team_id ? "capitan_local_id" : "capitan_visitante_id";
    const { error } = await supabase
      .from("match_sheets")
      .update({ [campo]: playerId })
      .eq("match_id", matchId);
    if (error) return { error: "No se pudo marcar el capitán." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Control del reloj ----------

interface FilaReloj {
  referee_id: string | null;
  home_team_id: string;
  away_team_id: string;
  competition_id: string;
  live_status: FaseReloj;
  reloj_corriendo: boolean;
  reloj_iniciado_at: string | null;
  reloj_segundos_base: number;
  duracion_tiempo_min: number;
  duracion_entretiempo_min: number;
  avisos: Record<string, unknown>;
}

async function obtenerReloj(supabase: Supabase, matchId: string): Promise<FilaReloj | null> {
  const { data } = await supabase
    .from("matches")
    .select(
      `referee_id, home_team_id, away_team_id, competition_id, live_status,
       reloj_corriendo, reloj_iniciado_at, reloj_segundos_base,
       duracion_tiempo_min, duracion_entretiempo_min, avisos`
    )
    .eq("id", matchId)
    .single();
  return (data as FilaReloj | null) ?? null;
}

function segundosConsumidosServidor(m: FilaReloj): number {
  const duracion =
    m.live_status === "entretiempo"
      ? m.duracion_entretiempo_min * 60
      : m.duracion_tiempo_min * 60;
  let consumidos = m.reloj_segundos_base;
  if (m.reloj_corriendo && m.reloj_iniciado_at) {
    consumidos += Math.max(
      0,
      Math.floor((Date.now() - new Date(m.reloj_iniciado_at).getTime()) / 1000)
    );
  }
  return Math.min(duracion, Math.max(0, consumidos));
}

/** Arranca el partido: valida el semáforo y pone a correr el 1er tiempo. */
export async function iniciarPartido(matchId: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const reloj = await obtenerReloj(supabase, matchId);
    if (!reloj) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, reloj.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal inicia el partido." };
    if (reloj.live_status !== "sin_iniciar" && reloj.live_status !== "pre_partido") {
      return { error: "El partido ya está en curso." };
    }

    // ---- Validación del semáforo (server-side, no se saltea) ----
    const { data: sheet } = await supabase
      .from("match_sheets")
      .select(
        "id, confirmada_local, confirmada_visitante, capitan_local_id, capitan_visitante_id, staff_confirmado"
      )
      .eq("match_id", matchId)
      .maybeSingle();
    if (!sheet) return { error: "Todavía no hay planilla: los clubes tienen que convocar primero." };
    if (!sheet.confirmada_local || !sheet.confirmada_visitante) {
      return { error: "Falta que alguno de los clubes confirme su convocatoria." };
    }
    if (!sheet.capitan_local_id || !sheet.capitan_visitante_id) {
      return { error: "Marcá el capitán de cada equipo antes de empezar." };
    }

    const { data: convocados } = await supabase
      .from("match_sheet_players")
      .select("team_id, es_titular, numero_camiseta")
      .eq("sheet_id", sheet.id);

    const delEquipo = (teamId: string) => (convocados ?? []).filter((c) => c.team_id === teamId);
    const titLocal = delEquipo(reloj.home_team_id).filter((c) => c.es_titular).length;
    const titVisitante = delEquipo(reloj.away_team_id).filter((c) => c.es_titular).length;
    if (titLocal < TITULARES_REQUERIDOS || titVisitante < TITULARES_REQUERIDOS) {
      return {
        error: `Faltan titulares: local ${titLocal}/${TITULARES_REQUERIDOS}, visitante ${titVisitante}/${TITULARES_REQUERIDOS}.`,
      };
    }
    const dupLocal = numerosDuplicados(delEquipo(reloj.home_team_id).map((c) => c.numero_camiseta));
    const dupVisitante = numerosDuplicados(delEquipo(reloj.away_team_id).map((c) => c.numero_camiseta));
    if (dupLocal.length || dupVisitante.length) {
      return {
        error: `Hay números de camiseta repetidos${dupLocal.length ? ` (local: ${dupLocal.join(", ")})` : ""}${dupVisitante.length ? ` (visitante: ${dupVisitante.join(", ")})` : ""}.`,
      };
    }

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("matches")
      .update({
        live_status: "primer_tiempo",
        reloj_corriendo: true,
        reloj_iniciado_at: ahora,
        reloj_segundos_base: 0,
        en_vivo_desde: ahora,
      })
      .eq("id", matchId);
    if (error) return { error: "No se pudo iniciar el partido." };

    // Aviso a los clubes: "su partido arrancó" (una sola vez)
    if (!reloj.avisos?.aviso_inicio) {
      const { data: equipos } = await supabase
        .from("teams")
        .select("id, club_id, name")
        .in("id", [reloj.home_team_id, reloj.away_team_id]);
      const local = (equipos ?? []).find((t) => t.id === reloj.home_team_id);
      const visitante = (equipos ?? []).find((t) => t.id === reloj.away_team_id);
      const texto = `⚽ ¡Arrancó el partido! ${local?.name ?? "Local"} vs ${visitante?.name ?? "Visitante"}. Seguilo en vivo en la plataforma (sección "En vivo").`;
      await notificarClub((local?.club_id ?? null) as string | null, texto, user.id);
      await notificarClub((visitante?.club_id ?? null) as string | null, texto, user.id);
      await supabase
        .from("matches")
        .update({ avisos: { ...(reloj.avisos ?? {}), aviso_inicio: ahora } })
        .eq("id", matchId);
    }

    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

async function moverReloj(
  matchId: string,
  accion: "pausar" | "reanudar" | "entretiempo" | "segundo_tiempo"
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const reloj = await obtenerReloj(supabase, matchId);
    if (!reloj) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, reloj.referee_id);
    // Pausa/reanudación y cambios de tiempo: principal y 2do (los dos dirigen)
    if (!permisos.puedeCargar) return { error: "No tenés permisos sobre este partido." };

    const ahora = new Date().toISOString();
    let update: Record<string, unknown> | null = null;

    if (accion === "pausar") {
      if (!reloj.reloj_corriendo) return { error: "El reloj ya está pausado." };
      update = {
        reloj_corriendo: false,
        reloj_segundos_base: segundosConsumidosServidor(reloj),
        reloj_iniciado_at: null,
      };
    } else if (accion === "reanudar") {
      if (reloj.reloj_corriendo) return { error: "El reloj ya está corriendo." };
      if (reloj.live_status !== "primer_tiempo" && reloj.live_status !== "segundo_tiempo" && reloj.live_status !== "entretiempo") {
        return { error: "El partido no está en curso." };
      }
      update = { reloj_corriendo: true, reloj_iniciado_at: ahora };
    } else if (accion === "entretiempo") {
      if (reloj.live_status !== "primer_tiempo") return { error: "Todavía no se juega el primer tiempo." };
      update = {
        live_status: "entretiempo",
        reloj_corriendo: true,
        reloj_iniciado_at: ahora,
        reloj_segundos_base: 0,
      };
    } else if (accion === "segundo_tiempo") {
      if (reloj.live_status !== "entretiempo") return { error: "Primero tiene que terminar el primer tiempo." };
      update = {
        live_status: "segundo_tiempo",
        reloj_corriendo: true,
        reloj_iniciado_at: ahora,
        reloj_segundos_base: 0,
      };
    }

    if (!update) return { error: "Acción inválida." };
    const { error } = await supabase.from("matches").update(update).eq("id", matchId);
    if (error) return { error: "No se pudo actualizar el reloj." };
    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function pausarReloj(matchId: string) {
  return moverReloj(matchId, "pausar");
}
export async function reanudarReloj(matchId: string) {
  return moverReloj(matchId, "reanudar");
}
export async function terminarPrimerTiempo(matchId: string) {
  return moverReloj(matchId, "entretiempo");
}
export async function iniciarSegundoTiempo(matchId: string) {
  return moverReloj(matchId, "segundo_tiempo");
}

// ---------- Eventos en vivo ----------

export interface InputEventoVivo {
  tipo: TipoEvento;
  teamId: string;
  playerId?: string | null; // en 'cambio' es el que ENTRA
  relacionadoId?: string | null; // en 'cambio' es el que SALE
  asistenteId?: string | null; // solo en goles
}

const TIPOS_CON_JUGADOR: TipoEvento[] = ["gol", "gol_en_contra", "amarilla", "roja", "cambio", "falta"];

export async function registrarEventoEnVivo(
  matchId: string,
  input: InputEventoVivo
): Promise<{ ok?: boolean; eventoId?: string; alertas?: AlertasEvento; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const reloj = await obtenerReloj(supabase, matchId);
    if (!reloj) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, reloj.referee_id);
    if (!permisos.puedeCargar) {
      return { error: "Solo el árbitro principal o el 2do cargan eventos." };
    }

    const enJuego =
      reloj.live_status === "primer_tiempo" || reloj.live_status === "segundo_tiempo";
    if (!enJuego) {
      return {
        error:
          reloj.live_status === "entretiempo"
            ? "Estamos en el entretiempo: esperá al segundo tiempo."
            : "El partido no está en juego.",
      };
    }

    const teamOk = input.teamId === reloj.home_team_id || input.teamId === reloj.away_team_id;
    if (!teamOk) return { error: "El equipo no juega este partido." };

    if (TIPOS_CON_JUGADOR.includes(input.tipo) && !input.playerId) {
      return { error: "Elegí el jugador del evento." };
    }
    if (input.tipo === "cambio" && !input.relacionadoId) {
      return { error: "En el cambio elegí también quién sale." };
    }

    // Minuto automático desde el reloj
    const duracion = reloj.duracion_tiempo_min;
    const consumidos = segundosConsumidosServidor(reloj);
    const minuto = Math.min(duracion, Math.floor(consumidos / 60) + 1);
    const tiempo: "PT" | "ST" = reloj.live_status === "segundo_tiempo" ? "ST" : "PT";

    const { data: insertado, error } = await supabase
      .from("match_events")
      .insert({
        match_id: matchId,
        team_id: input.teamId,
        player_id: input.playerId ?? null,
        jugador_relacionado_id: input.relacionadoId ?? null,
        asistente_id: input.tipo === "gol" ? input.asistenteId ?? null : null,
        tipo: input.tipo,
        minuto,
        tiempo,
        minuto_total: calcularMinutoTotal(minuto, tiempo, duracion),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error || !insertado) {
      return { error: `No se pudo guardar el evento: ${error?.message ?? "error desconocido"}` };
    }

    // Alertas en caliente para la interfaz
    const { data: evRaw } = await supabase
      .from("match_events")
      .select("tipo, team_id, player_id, tiempo")
      .eq("match_id", matchId);
    const eventos = (evRaw ?? []) as {
      tipo: TipoEvento;
      team_id: string;
      player_id: string | null;
      tiempo: "PT" | "ST" | null;
    }[];

    const amarillasJugador = input.playerId
      ? eventos.filter((e) => e.tipo === "amarilla" && e.player_id === input.playerId).length
      : 0;
    const faltas = faltasAcumuladas(
      eventos.map((e) => ({ tipo: e.tipo, teamId: e.team_id, playerId: e.player_id, tiempo: e.tiempo })),
      reloj.home_team_id,
      reloj.away_team_id
    );
    const lado = input.teamId === reloj.home_team_id ? "local" : "visitante";
    const faltasEquipo = faltas[lado][tiempo];

    const alertas: AlertasEvento = {
      dobleAmarilla: input.tipo === "amarilla" && amarillasJugador >= 2,
      jugadorExpulsadoAntes: false,
      faltasEquipo,
      nivelFaltas: nivelFaltas(faltasEquipo),
    };

    revalidarVivo(matchId);
    return { ok: true, eventoId: insertado.id as string, alertas };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Deshacer: borra el último evento cargado en el partido. */
export async function deshacerUltimoEvento(
  matchId: string
): Promise<{ ok?: boolean; descripcion?: string; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCargar) return { error: "No tenés permisos para deshacer." };
    if (match.live_status === "finalizado") {
      return { error: "El partido ya finalizó: pedile a la federación que lo corrija." };
    }

    const { data: ultimo } = await supabase
      .from("match_events")
      .select("id, tipo, minuto, tiempo")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ultimo) return { error: "No hay eventos para deshacer." };

    const { error } = await supabase.from("match_events").delete().eq("id", ultimo.id);
    if (error) return { error: "No se pudo deshacer el último evento." };

    revalidarVivo(matchId);
    const minutoTxt = ultimo.minuto ? ` (${ultimo.minuto}' ${ultimo.tiempo ?? "PT"})` : "";
    return { ok: true, descripcion: `${ultimo.tipo}${minutoTxt}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Tiempo pedido: 1 por equipo por tiempo, dura 60 segundos. */
export async function pedirTiempoMuerto(
  matchId: string,
  teamId: string
): Promise<{ ok?: boolean; duracionSeg?: number; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const reloj = await obtenerReloj(supabase, matchId);
    if (!reloj) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, reloj.referee_id);
    if (!permisos.puedeCargar) return { error: "No tenés permisos sobre este partido." };

    const enJuego =
      reloj.live_status === "primer_tiempo" || reloj.live_status === "segundo_tiempo";
    if (!enJuego) return { error: "Solo se puede pedir tiempo con el partido en juego." };

    const tiempo: "PT" | "ST" = reloj.live_status === "segundo_tiempo" ? "ST" : "PT";
    const { data: evRaw } = await supabase
      .from("match_events")
      .select("tipo, team_id, player_id, tiempo")
      .eq("match_id", matchId);
    const eventos = (evRaw ?? []).map((e) => ({
      tipo: e.tipo as TipoEvento,
      teamId: e.team_id as string,
      playerId: (e.player_id ?? null) as string | null,
      tiempo: (e.tiempo ?? null) as "PT" | "ST" | null,
    }));

    if (!puedePedirTiempo(eventos, teamId, tiempo)) {
      return { error: "Este equipo ya pidió su tiempo en este tiempo de juego." };
    }

    const resultado = await registrarEventoEnVivo(matchId, {
      tipo: "tiempo_muerto",
      teamId,
      playerId: null,
    });
    if (!resultado.ok) return { error: resultado.error };
    return { ok: true, duracionSeg: 60 };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Finalización, ausencia y suspensión ----------

/** Termina el partido: frena el reloj, calcula el marcador y avisa. */
export async function finalizarPartido(
  matchId: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const reloj = await obtenerReloj(supabase, matchId);
    if (!reloj) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, reloj.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal finaliza el partido." };
    if (reloj.live_status === "finalizado") return { error: "El partido ya está finalizado." };
    if (reloj.live_status === "sin_iniciar" || reloj.live_status === "pre_partido") {
      return { error: "El partido todavía no arrancó." };
    }

    const { data: evRaw } = await supabase
      .from("match_events")
      .select("tipo, team_id, player_id, tiempo")
      .eq("match_id", matchId);
    const eventos = (evRaw ?? []).map((e) => ({
      tipo: e.tipo as TipoEvento,
      teamId: e.team_id as string,
      playerId: (e.player_id ?? null) as string | null,
      tiempo: (e.tiempo ?? null) as "PT" | "ST" | null,
    }));
    const marcador = marcadorDesdeEventos(eventos, reloj.home_team_id, reloj.away_team_id);

    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("matches")
      .update({
        live_status: "finalizado",
        reloj_corriendo: false,
        reloj_iniciado_at: null,
        home_score: marcador.local,
        away_score: marcador.visitante,
        status: "jugado",
      })
      .eq("id", matchId);
    if (error) return { error: "No se pudo finalizar el partido." };

    // Aviso con el resultado (una sola vez)
    if (!reloj.avisos?.aviso_resultado) {
      const { data: equipos } = await supabase
        .from("teams")
        .select("id, club_id, name")
        .in("id", [reloj.home_team_id, reloj.away_team_id]);
      const local = (equipos ?? []).find((t) => t.id === reloj.home_team_id);
      const visitante = (equipos ?? []).find((t) => t.id === reloj.away_team_id);
      const texto = `🏁 Finalizó: ${local?.name ?? "Local"} ${marcador.local} - ${marcador.visitante} ${visitante?.name ?? "Visitante"}. La planilla queda a revisión de la federación.`;
      await notificarClub((local?.club_id ?? null) as string | null, texto, user.id);
      await notificarClub((visitante?.club_id ?? null) as string | null, texto, user.id);
      await supabase
        .from("matches")
        .update({ avisos: { ...(reloj.avisos ?? {}), aviso_resultado: ahora } })
        .eq("id", matchId);
    }

    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/**
 * AUSENCIA (antes "W.O."): un equipo no se presentó y gana el rival.
 * El marcador sale de la configuración del torneo (igual que el W.O.
 * administrativo) y se genera la multa automática al club ausente.
 */
export async function registrarAusencia(
  matchId: string,
  equipoAusenteId: string,
  motivo: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select(
        "referee_id, competition_id, home_team_id, away_team_id, live_status, status, result_confirmed"
      )
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal registra la ausencia." };
    if (match.status === "jugado" || match.status === "wo") {
      return { error: "Este partido ya tiene un resultado cargado." };
    }
    if (
      equipoAusenteId !== match.home_team_id &&
      equipoAusenteId !== match.away_team_id
    ) {
      return { error: "El equipo ausente no juega este partido." };
    }
    const motivoLimpio = motivo.trim().slice(0, 300);
    if (motivoLimpio.length < 5) return { error: "Contanos brevemente el motivo." };

    const ganaLocal = equipoAusenteId === match.away_team_id;
    const { data: torneo } = await supabase
      .from("competitions")
      .select("wo_home_goals, wo_away_goals")
      .eq("id", match.competition_id)
      .single();
    const golesGanador = (torneo?.wo_home_goals ?? 5) as number;
    const golesPerdedor = (torneo?.wo_away_goals ?? 0) as number;

    const { error } = await supabase
      .from("matches")
      .update({
        home_score: ganaLocal ? golesGanador : golesPerdedor,
        away_score: ganaLocal ? golesPerdedor : golesGanador,
        status: "wo",
        result_confirmed: true,
        live_status: "finalizado",
        reloj_corriendo: false,
        reloj_iniciado_at: null,
        ausente_team_id: equipoAusenteId,
        motivo_estado: motivoLimpio,
      })
      .eq("id", matchId);
    if (error) return { error: "No se pudo registrar la ausencia." };

    // Multa automática al club ausente (misma regla que el W.O. del admin)
    const { data: ausente } = await supabase
      .from("teams")
      .select("club_id, name")
      .eq("id", equipoAusenteId)
      .single();
    if (ausente?.club_id) {
      await crearMultaAutomatica({
        clubId: ausente.club_id,
        competitionId: match.competition_id,
        tipo: "multa_wo",
        descripcion: `${ausente.name} — Ausencia (no se presentó al partido)`,
        eventoOrigenId: null,
      });
    }

    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Suspende el partido con motivo (mal clima, incidentes, etc.). */
export async function suspenderPartido(
  matchId: string,
  motivo: string
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, status, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) return { error: "Solo el árbitro principal suspende el partido." };
    if (match.status === "jugado" || match.status === "wo") {
      return { error: "Este partido ya tiene resultado: no se puede suspender." };
    }
    const motivoLimpio = motivo.trim().slice(0, 300);
    if (motivoLimpio.length < 5) return { error: "Contanos brevemente el motivo." };

    const { error } = await supabase
      .from("matches")
      .update({
        status: "suspendido",
        live_status: "finalizado",
        reloj_corriendo: false,
        reloj_iniciado_at: null,
        motivo_estado: motivoLimpio,
      })
      .eq("id", matchId);
    if (error) return { error: "No se pudo suspender el partido." };

    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Firmas digitales y votación de la figura ----------

const ROLES_VALIDOS: RolFirma[] = [
  "principal",
  "segundo_arbitro",
  "planillero",
  "dt_local",
  "dt_visitante",
  "capitan_local",
  "capitan_visitante",
];

const VOTANTES: VotanteFigura[] = ["principal", "segundo_arbitro", "planillero", "dt_local", "dt_visitante"];

function dataUrlABuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

/**
 * Registra la firma (canvas) de un rol y, si el rol vota, su voto a la
 * figura del partido. Flujo "pasando el teléfono": todo se hace desde
 * el dispositivo del árbitro. También registra el "No firmó".
 */
export async function registrarFirmaYVoto(
  matchId: string,
  input: {
    rol: RolFirma;
    nombreFirmante: string;
    dataUrl: string | null; // null cuando registra "No firmó"
    votoJugadorId: string | null; // solo si el rol vota
  }
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) {
      return { error: "Solo el árbitro principal registra las firmas." };
    }
    if (!ROLES_VALIDOS.includes(input.rol)) return { error: "Rol de firma inválido." };

    const nombre = limpiarNombre(input.nombreFirmante);
    if (!nombre) return { error: "Falta el nombre del que firma." };

    const { data: sheet } = await supabase
      .from("match_sheets")
      .select("id, firmas, votos_figura")
      .eq("match_id", matchId)
      .maybeSingle();
    if (!sheet) return { error: "No hay planilla para firmar." };

    const firmas = { ...((sheet.firmas ?? {}) as MapaFirmas) };
    const firmo = Boolean(input.dataUrl);

    if (firmo && input.dataUrl) {
      const buffer = dataUrlABuffer(input.dataUrl);
      if (!buffer || buffer.length === 0) {
        return { error: "La firma llegó vacía. Dibujala de nuevo, por favor." };
      }
      if (buffer.length > 500 * 1024) {
        return { error: "La imagen de la firma es muy pesada." };
      }
      const path = rutaFirma(matchId, input.rol);
      const { error: errorSubida } = await supabase.storage
        .from("firmas-planillas")
        .upload(path, buffer, { contentType: "image/png", upsert: true });
      if (errorSubida) {
        return { error: "No se pudo guardar la firma. Probá de nuevo." };
      }
      firmas[input.rol] = { path, nombre, firmo: true, firmadoAt: new Date().toISOString() };
    } else {
      // Queda registrado que NO firmó (la planilla cierra igual)
      firmas[input.rol] = { path: null, nombre, firmo: false, firmadoAt: null };
    }

    // Voto de la figura (oficiales + DTs; no se imprime en la planilla)
    let votos = ((sheet.votos_figura ?? []) as VotoFigura[]).filter((v) =>
      VOTANTES.includes(v.votante)
    );
    if (input.votoJugadorId && (VOTANTES as string[]).includes(input.rol)) {
      votos = registrarVoto(votos, input.rol as VotanteFigura, input.votoJugadorId);
    }

    const { error } = await supabase
      .from("match_sheets")
      .update({ firmas, votos_figura: votos })
      .eq("id", sheet.id);
    if (error) return { error: "No se pudo registrar la firma." };

    revalidarVivo(matchId);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/**
 * Cierre premium de la planilla: exige la firma del principal, calcula
 * la figura del partido, guarda observaciones y la deja lista para la
 * aprobación de la federación. Finaliza el partido si sigue en juego.
 */
export async function cerrarPlanillaPremium(
  matchId: string,
  input: { observaciones: string }
): Promise<{ ok?: boolean; figuraNombre?: string | null; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    const { data: match } = await supabase
      .from("matches")
      .select("referee_id, live_status")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    const permisos = await permisosDePartido(supabase, user.id, role, matchId, match.referee_id);
    if (!permisos.puedeCerrar) {
      return { error: "Solo el árbitro principal cierra la planilla." };
    }

    const { data: sheet } = await supabase
      .from("match_sheets")
      .select("id, firmas, votos_figura")
      .eq("match_id", matchId)
      .maybeSingle();
    if (!sheet) return { error: "No hay planilla para cerrar." };

    const firmas = (sheet.firmas ?? {}) as MapaFirmas;
    if (!firmas.principal?.firmo) {
      return { error: "Falta tu firma: es la única obligatoria para cerrar." };
    }

    // Figura del partido (empate sin principal → queda sin definir)
    const votos = (sheet.votos_figura ?? []) as VotoFigura[];
    const ganador = ganadorFigura(votos);

    // Si todavía está en juego, lo finaliza (calcula marcador y avisa)
    if (match.live_status !== "finalizado") {
      const fin = await finalizarPartido(matchId);
      if (!fin.ok) return { error: fin.error };
    }

    const observaciones = input.observaciones.trim().slice(0, 2000);
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("match_sheets")
      .update({
        observaciones,
        cerrada_por: user.id,
        cerrada_at: ahora,
      })
      .eq("id", sheet.id);
    if (error) return { error: "No se pudo cerrar la planilla." };

    let figuraNombre: string | null = null;
    if (ganador) {
      await supabase
        .from("matches")
        .update({ figura_player_id: ganador.jugadorId })
        .eq("id", matchId);
      const { data: fig } = await supabase
        .from("players")
        .select("first_name, last_name")
        .eq("id", ganador.jugadorId)
        .maybeSingle();
      if (fig) figuraNombre = `${fig.first_name} ${fig.last_name}`;
    }

    revalidarVivo(matchId);
    return { ok: true, figuraNombre };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Multi-oficial (2do árbitro + planillero de mesa) ----------

/** La federación designa oficiales (directa) o les propone (propuesta). */
export async function designarOficial(
  matchId: string,
  userId: string,
  rol: "segundo_arbitro" | "planillero",
  modo: "directa" | "propuesta"
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    if (role !== "admin") return { error: "Solo la federación designa oficiales." };

    const { data: perfil } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", userId)
      .single();
    if (!perfil || !["arbitro", "arbitro_asistente"].includes(perfil.role as string)) {
      return { error: "El usuario elegido no es árbitro." };
    }

    const { data: match } = await supabase
      .from("matches")
      .select("referee_id")
      .eq("id", matchId)
      .single();
    if (!match) return { error: "No se encontró el partido." };
    if (match.referee_id === userId) {
      return { error: "Ese árbitro ya es el principal del partido." };
    }

    // Un rol, una persona por partido
    const { data: existente } = await supabase
      .from("match_officials")
      .select("id")
      .eq("match_id", matchId)
      .eq("rol", rol)
      .neq("designacion_estado", "rechazada")
      .maybeSingle();
    if (existente) {
      return {
        error: `Ya hay un ${rol === "segundo_arbitro" ? "2do árbitro" : "planillero"} designado. Quitá ese primero.`,
      };
    }

    const { error } = await supabase.from("match_officials").insert({
      match_id: matchId,
      user_id: userId,
      rol,
      designacion_modo: modo,
      designacion_estado: modo === "directa" ? "aceptada" : "pendiente",
      propuesto_por: user.id,
      respondido_at: modo === "directa" ? new Date().toISOString() : null,
    });
    if (error) return { error: "No se pudo designar el oficial." };

    if (modo === "propuesta") {
      await notificarArbitro(
        userId,
        `📋 La liga te propuso como ${rol === "segundo_arbitro" ? "2do árbitro" : "planillero de mesa"} de un partido. Entrá a Designaciones para aceptar o rechazar.`,
        user.id
      );
    }

    revalidarVivo(matchId);
    revalidatePath("/admin/designaciones");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

export async function quitarOficial(oficialId: string): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, role } = await obtenerContexto();
    if (role !== "admin") return { error: "Solo la federación quita oficiales." };
    const { data: oficial } = await supabase
      .from("match_officials")
      .select("match_id")
      .eq("id", oficialId)
      .single();
    if (!oficial) return { error: "No se encontró la designación." };
    const { error } = await supabase.from("match_officials").delete().eq("id", oficialId);
    if (error) return { error: "No se pudo quitar el oficial." };
    revalidarVivo(oficial.match_id as string);
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** El oficial acepta o rechaza la propuesta que le hizo la liga. */
export async function responderDesignacionOficial(
  oficialId: string,
  aceptar: boolean
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const { supabase, user } = await obtenerContexto();
    const { data: oficial } = await supabase
      .from("match_officials")
      .select("id, user_id, match_id, designacion_modo, designacion_estado")
      .eq("id", oficialId)
      .single();
    if (!oficial) return { error: "No se encontró la propuesta." };
    if (oficial.user_id !== user.id) return { error: "Esta propuesta no es tuya." };
    if (oficial.designacion_estado !== "pendiente") {
      return { error: "Esta propuesta ya fue respondida." };
    }

    const { error } = await supabase
      .from("match_officials")
      .update({
        designacion_estado: aceptar ? "aceptada" : "rechazada",
        respondido_at: new Date().toISOString(),
      })
      .eq("id", oficialId);
    if (error) return { error: "No se pudo responder la propuesta." };

    revalidarVivo(oficial.match_id as string);
    revalidatePath("/arbitro/designaciones");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** Lista de árbitros del colegio para designar como oficiales. */
export async function listarArbitrosParaOficiales(): Promise<{
  data?: { id: string; nombre: string }[];
  error?: string;
}> {
  try {
    const { supabase, role } = await obtenerContexto();
    if (role !== "admin") return { error: "Solo la federación ve el colegio." };
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["arbitro", "arbitro_asistente"])
      .order("full_name", { ascending: true });
    return {
      data: (data ?? []).map((p) => ({
        id: p.id as string,
        nombre: (p.full_name ?? "Sin nombre") as string,
      })),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Transmisión pública ----------

/** Datos públicos del partido en vivo (RPC security definer). */
export async function obtenerTransmision(matchId: string): Promise<{
  data?: Record<string, unknown> | null;
  error?: string;
}> {
  try {
    const supabase = await createLfsServerClient();
    const { data, error } = await supabase.rpc("obtener_transmision_publica", {
      p_match_id: matchId,
    });
    if (error) return { error: "No se pudo cargar la transmisión." };
    return { data: (data ?? null) as Record<string, unknown> | null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

/** En vivo + próximos de hoy + últimos resultados (para la home). */
export async function obtenerSeccionEnVivo(): Promise<{
  data?: {
    enVivo: Record<string, unknown>[];
    proximosHoy: Record<string, unknown>[];
    ultimosResultados: Record<string, unknown>[];
  };
  error?: string;
}> {
  try {
    const supabase = await createLfsServerClient();
    const { data, error } = await supabase.rpc("obtener_partidos_en_vivo");
    if (error) return { error: "No se pudo cargar la sección en vivo." };
    const d = (data ?? {}) as Record<string, unknown>;
    return {
      data: {
        enVivo: (d.enVivo ?? []) as Record<string, unknown>[],
        proximosHoy: (d.proximosHoy ?? []) as Record<string, unknown>[],
        ultimosResultados: (d.ultimosResultados ?? []) as Record<string, unknown>[],
      },
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}

// ---------- Avisos automáticos (recordatorio 1 día antes) ----------

/**
 * Recordatorio a los árbitros de los partidos de MAÑANA.
 * Se llama al cargar el panel del árbitro (autocuración, sin pg_cron)
 * y marca matches.avisos.recordatorio para no repetir.
 */
export async function procesarAvisosAutomaticos(): Promise<{ ok: boolean }> {
  try {
    const { supabase, user, role } = await obtenerContexto();
    if (role !== "admin" && role !== "arbitro" && role !== "arbitro_asistente") {
      return { ok: true };
    }
    const admin = createLfsAdminClient();

    const ahora = new Date();
    const desde = new Date(ahora.getTime() + 20 * 60 * 60 * 1000).toISOString(); // +20 h
    const hasta = new Date(ahora.getTime() + 32 * 60 * 60 * 1000).toISOString(); // +32 h

    const { data: partidos } = await admin
      .from("matches")
      .select("id, referee_id, scheduled_at, avisos, home_team_id, away_team_id")
      .eq("status", "programado")
      .not("referee_id", "is", null)
      .gte("scheduled_at", desde)
      .lte("scheduled_at", hasta)
      .limit(20);

    for (const p of partidos ?? []) {
      const avisos = (p.avisos ?? {}) as Record<string, unknown>;
      if (avisos.recordatorio_arbitro) continue;

      const { data: equipos } = await admin
        .from("teams")
        .select("id, name")
        .in("id", [p.home_team_id, p.away_team_id]);
      const local = (equipos ?? []).find((t) => t.id === p.home_team_id);
      const visitante = (equipos ?? []).find((t) => t.id === p.away_team_id);
      const fecha = new Date(p.scheduled_at as string).toLocaleString("es-AR", {
        timeZone: "America/Argentina/Ushuaia",
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });

      await notificarArbitro(
        p.referee_id as string,
        `⏰ Recordatorio: mañana dirigís ${local?.name ?? "Local"} vs ${visitante?.name ?? "Visitante"} (${fecha} hs). Revisá tu planilla en la plataforma.`,
        user.id
      );
      await admin
        .from("matches")
        .update({ avisos: { ...avisos, recordatorio_arbitro: new Date().toISOString() } })
        .eq("id", p.id);
    }

    return { ok: true };
  } catch {
    return { ok: true }; // los avisos nunca rompen la página
  }
}

/** Propuestas pendientes del oficial logueado (para su panel). */
export async function obtenerMisPropuestasOficial(): Promise<{
  data?: {
    id: string;
    rol: "segundo_arbitro" | "planillero";
    matchId: string;
    local: string;
    visitante: string;
    fecha: string | null;
    cancha: string | null;
  }[];
  error?: string;
}> {
  try {
    const { supabase, user } = await obtenerContexto();

    const { data: propuestas } = await supabase
      .from("match_officials")
      .select("id, rol, match_id")
      .eq("user_id", user.id)
      .eq("designacion_estado", "pendiente")
      .order("created_at", { ascending: true });

    if (!propuestas || propuestas.length === 0) return { data: [] };

    const matchIds = propuestas.map((p) => p.match_id as string);
    const { data: partidos } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id, scheduled_at, venue_id")
      .in("id", matchIds);

    const teamIds = [
      ...new Set(
        (partidos ?? []).flatMap((m) => [m.home_team_id as string, m.away_team_id as string])
      ),
    ];
    const venueIds = [...new Set((partidos ?? []).map((m) => m.venue_id as string).filter(Boolean))];
    const [{ data: equipos }, { data: canchas }] = await Promise.all([
      teamIds.length
        ? supabase.from("teams").select("id, name").in("id", teamIds)
        : Promise.resolve({ data: [] }),
      venueIds.length
        ? supabase.from("venues").select("id, name").in("id", venueIds)
        : Promise.resolve({ data: [] }),
    ]);
    const nombreEquipo = new Map((equipos ?? []).map((t) => [t.id as string, t.name as string]));
    const nombreCancha = new Map((canchas ?? []).map((v) => [v.id as string, v.name as string]));

    return {
      data: propuestas.map((p) => {
        const partido = (partidos ?? []).find((m) => m.id === p.match_id);
        return {
          id: p.id as string,
          rol: p.rol as "segundo_arbitro" | "planillero",
          matchId: p.match_id as string,
          local: nombreEquipo.get(partido?.home_team_id as string) ?? "Local",
          visitante: nombreEquipo.get(partido?.away_team_id as string) ?? "Visitante",
          fecha: (partido?.scheduled_at ?? null) as string | null,
          cancha: partido?.venue_id
            ? (nombreCancha.get(partido.venue_id as string) ?? null)
            : null,
        };
      }),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error inesperado." };
  }
}
