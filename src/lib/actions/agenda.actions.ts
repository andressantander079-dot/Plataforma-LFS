"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  validarEvento,
  esTipoEventoValido,
  esAudienciaValida,
  TIPOS_EVENTO,
  AUDIENCIAS_AVISO,
  type ItemAgenda,
  type TipoEvento,
  type AudienciaAviso,
} from "@/lib/core/rules/agendaRules";
import { enviarComunicado } from "@/lib/actions/mensajeria.actions";

/**
 * MÓDULO AGENDA DE LA LIGA (Paso 17B)
 *
 * · ADMIN: crea/edita/borra/duplica eventos propios (reuniones, congresos,
 *   cierres de inscripción…), con aviso opcional por mensajería a clubes y/o
 *   árbitros. Los PARTIDOS del fixture aparecen automáticamente (solo lectura).
 * · CLUB y ÁRBITRO: la leen completa desde sus paneles (RLS: solo lectura).
 */

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface EventoLigaUI {
  id: string;
  titulo: string;
  tipo: TipoEvento;
  fecha: string; // 'YYYY-MM-DD'
  hora: string | null; // 'HH:MM'
  ubicacion: string | null;
  descripcion: string | null;
  avisar: AudienciaAviso;
  avisadoAt: string | null;
}

export interface AgendaCompleta {
  eventos: EventoLigaUI[];
  /** Ítems unificados (eventos + partidos) listos para listar/calendarizar. */
  items: ItemAgenda[];
}

export interface GuardarEventoInput {
  id?: string;
  titulo: string;
  tipo: TipoEvento;
  fecha: string;
  hora: string | null;
  ubicacion: string | null;
  descripcion: string | null;
  avisar: AudienciaAviso;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requerirAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Solo la federación puede hacer esto.");
  return { supabase, user };
}

async function auditar(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  userId: string,
  action: string,
  oldData: unknown,
  newData: unknown
) {
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action,
    module: "agenda",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

function revalidarAgenda() {
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/dashboard");
  revalidatePath("/club/agenda");
  revalidatePath("/arbitro/calendario");
}

interface FilaEvento {
  id: string;
  titulo: string;
  tipo: string;
  fecha: string;
  hora: string | null;
  ubicacion: string | null;
  descripcion: string | null;
  avisar: string;
  avisado_at: string | null;
}

function mapearEvento(e: FilaEvento): EventoLigaUI {
  return {
    id: e.id,
    titulo: e.titulo,
    tipo: e.tipo as TipoEvento,
    fecha: e.fecha,
    hora: e.hora ? e.hora.slice(0, 5) : null,
    ubicacion: e.ubicacion,
    descripcion: e.descripcion,
    avisar: e.avisar as AudienciaAviso,
    avisadoAt: e.avisado_at,
  };
}

function eventoAItem(e: EventoLigaUI): ItemAgenda {
  return {
    kind: "evento",
    id: e.id,
    fecha: e.fecha,
    hora: e.hora,
    titulo: e.titulo,
    detalle: e.ubicacion,
    tipo: e.tipo,
    href: null,
  };
}

interface FilaMatch {
  id: string;
  scheduled_at: string | null;
  home_team_id: string;
  away_team_id: string;
  competitions: unknown;
  venues: unknown;
}

/** Partidos programados del rango como ítems de agenda (solo lectura). */
async function obtenerPartidosItems(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  desde: string,
  hasta: string,
  filtroTeamIds?: string[]
): Promise<ItemAgenda[]> {
  let query = supabase
    .from("matches")
    .select("id, scheduled_at, home_team_id, away_team_id, competitions(name), venues(name)")
    .eq("status", "programado")
    .gte("scheduled_at", desde)
    .lte("scheduled_at", `${hasta}T23:59:59`)
    .order("scheduled_at", { ascending: true })
    .limit(400);

  if (filtroTeamIds && filtroTeamIds.length > 0) {
    query = query.or(
      `home_team_id.in.(${filtroTeamIds.join(",")}),away_team_id.in.(${filtroTeamIds.join(",")})`
    );
  } else if (filtroTeamIds) {
    return []; // club sin equipos: ningún partido
  }

  const { data: partidos } = await query;
  if (!partidos || partidos.length === 0) return [];

  const teamIds = new Set<string>();
  for (const p of partidos) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  return (partidos as unknown as FilaMatch[]).flatMap((p) => {
    if (!p.scheduled_at) return [];
    const d = new Date(p.scheduled_at);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = nombreEquipo.get(p.home_team_id) ?? "—";
    const visitante = nombreEquipo.get(p.away_team_id) ?? "—";
    const torneo = (p.competitions as { name: string } | null)?.name ?? "Torneo";
    const cancha = (p.venues as { name: string } | null)?.name ?? null;
    return [
      {
        kind: "partido" as const,
        id: p.id,
        fecha: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        titulo: `${local} vs ${visitante}`,
        detalle: [torneo, cancha].filter(Boolean).join(" · "),
        tipo: null,
        href: "/fixture",
      },
    ];
  });
}

// ---------------------------------------------------------------------------
// ADMIN — LECTURA COMPLETA (eventos + partidos automáticos)
// ---------------------------------------------------------------------------

export async function obtenerAgendaAdmin(): Promise<AgendaCompleta> {
  const { supabase } = await requerirAdmin();

  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 4, 0).toISOString().slice(0, 10);

  const [{ data: filas }, partidosItems] = await Promise.all([
    supabase
      .from("league_events")
      .select("*")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    obtenerPartidosItems(supabase, desde, hasta),
  ]);

  const eventos = ((filas ?? []) as FilaEvento[]).map(mapearEvento);
  return {
    eventos,
    items: [...eventos.map(eventoAItem), ...partidosItems],
  };
}

/** Próximos N eventos propios (widget del dashboard admin). */
export async function obtenerProximosEventos(n = 3): Promise<EventoLigaUI[]> {
  const supabase = await createLfsServerClient();
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("league_events")
    .select("*")
    .gte("fecha", hoy)
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true })
    .limit(n);
  return ((data ?? []) as FilaEvento[]).map(mapearEvento);
}

// ---------------------------------------------------------------------------
// ADMIN — GUARDAR (crear/editar) + AVISO OPCIONAL POR MENSAJERÍA
// ---------------------------------------------------------------------------

export async function guardarEvento(
  input: GuardarEventoInput
): Promise<{ ok: boolean; error?: string; id?: string; avisoEnviado?: boolean }> {
  const { supabase, user } = await requerirAdmin();

  const errores = validarEvento(input);
  const primerError = Object.values(errores)[0];
  if (primerError) return { ok: false, error: primerError };
  if (!esTipoEventoValido(input.tipo) || !esAudienciaValida(input.avisar)) {
    return { ok: false, error: "Datos del evento inválidos." };
  }

  const payload = {
    titulo: input.titulo.trim(),
    tipo: input.tipo,
    fecha: input.fecha,
    hora: input.hora || null,
    ubicacion: input.ubicacion?.trim() || null,
    descripcion: input.descripcion?.trim() || null,
    avisar: input.avisar,
    updated_at: new Date().toISOString(),
  };

  let eventoId = input.id;

  if (input.id) {
    const { data: anterior } = await supabase
      .from("league_events")
      .select("titulo, fecha, avisar")
      .eq("id", input.id)
      .single();
    const { error } = await supabase.from("league_events").update(payload).eq("id", input.id);
    if (error) return { ok: false, error: `No se pudo guardar: ${error.message}` };
    await auditar(supabase, user.id, "evento_actualizado", anterior, payload);
  } else {
    const { data: creado, error } = await supabase
      .from("league_events")
      .insert({ ...payload, creado_por: user.id })
      .select("id")
      .single();
    if (error || !creado) {
      return { ok: false, error: `No se pudo crear el evento: ${error?.message ?? "error desconocido"}` };
    }
    eventoId = creado.id as string;
    await auditar(supabase, user.id, "evento_creado", null, { id: eventoId, ...payload });
  }

  // Aviso opcional por mensajería (solo al crear y si pidió audiencia)
  let avisoEnviado = false;
  if (!input.id && input.avisar !== "nadie" && eventoId) {
    const fechaLinda = new Date(`${input.fecha}T12:00:00`).toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const horaTxt = input.hora ? ` a las ${input.hora} hs` : "";
    const dondeTxt = input.ubicacion ? ` en ${input.ubicacion}` : "";

    const fd = new FormData();
    fd.append("asunto", `📅 ${input.titulo.trim()} — ${fechaLinda}`);
    fd.append(
      "cuerpoHtml",
      `<p>La liga agendó un evento: <b>${input.titulo.trim()}</b> (${TIPOS_EVENTO[input.tipo].nombre}).</p>
<p>Se realiza el <b>${fechaLinda}${horaTxt}</b>${dondeTxt}.</p>
${input.descripcion ? `<p>${input.descripcion.trim()}</p>` : ""}
<p>Podés verlo en la Agenda de la plataforma. ¡Te esperamos!</p>`
    );
    fd.append("sinRespuestas", "true");
    fd.append("clubes", JSON.stringify(input.avisar === "arbitros" ? [] : ["*"]));
    fd.append("arbitros", JSON.stringify(input.avisar === "clubes" ? [] : ["*"]));

    const resultado = await enviarComunicado(fd);
    if (!("error" in resultado)) {
      avisoEnviado = true;
      await supabase
        .from("league_events")
        .update({ avisado_at: new Date().toISOString() })
        .eq("id", eventoId);
    }
  }

  revalidarAgenda();
  return { ok: true, id: eventoId, avisoEnviado };
}

export async function eliminarEvento(id: string): Promise<{ ok: boolean; error?: string }> {
  const { supabase, user } = await requerirAdmin();

  const { data: evento } = await supabase
    .from("league_events")
    .select("titulo")
    .eq("id", id)
    .single();
  if (!evento) return { ok: false, error: "No encontré el evento." };

  const { error } = await supabase.from("league_events").delete().eq("id", id);
  if (error) return { ok: false, error: `No se pudo borrar: ${error.message}` };

  await auditar(supabase, user.id, "evento_eliminado", { id, titulo: evento.titulo }, null);
  revalidarAgenda();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// CLUB — SOLO LECTURA (eventos de la liga + partidos de SU club)
// ---------------------------------------------------------------------------

export async function obtenerAgendaClub(): Promise<AgendaCompleta> {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, role")
    .eq("id", user.id)
    .single();

  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().slice(0, 10);
  const hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 4, 0).toISOString().slice(0, 10);

  // Equipos del club (si es admin mirando como club, ve todos los partidos)
  let teamIds: string[] | undefined;
  if (profile?.role === "club" && profile.club_id) {
    const { data: teams } = await supabase
      .from("teams")
      .select("id")
      .eq("club_id", profile.club_id);
    teamIds = (teams ?? []).map((t) => t.id as string);
  }

  const [{ data: filas }, partidosItems] = await Promise.all([
    supabase
      .from("league_events")
      .select("*")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: true }),
    obtenerPartidosItems(supabase, desde, hasta, teamIds),
  ]);

  const eventos = ((filas ?? []) as FilaEvento[]).map(mapearEvento);
  return {
    eventos,
    items: [...eventos.map(eventoAItem), ...partidosItems],
  };
}

// ---------------------------------------------------------------------------
// ÁRBITRO — SOLO LECTURA (eventos de la liga; sus partidos los trae su
// calendario propio de obtenerMiCalendario, que ahora también suma estos)
// ---------------------------------------------------------------------------

export async function obtenerAgendaLigaLectura(desde: string, hasta: string): Promise<EventoLigaUI[]> {
  const supabase = await createLfsServerClient();
  const { data } = await supabase
    .from("league_events")
    .select("*")
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .order("fecha", { ascending: true });
  return ((data ?? []) as FilaEvento[]).map(mapearEvento);
}
