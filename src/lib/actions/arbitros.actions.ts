"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  calcularEstadisticasArbitro,
  calcularLiquidacion,
  nombrePeriodo,
  partidoLiquidable,
  tarifaEfectiva,
  validarBloqueDisponibilidad,
  validarEventoArbitral,
  validarNivelArbitro,
  validarRegistroArbitro,
  type BloqueNoDisponible,
  type EstadoDesignacion,
  type EstadisticasArbitro,
  type ModoDesignacion,
  type PartidoParaStats,
} from "@/lib/core/rules/arbitrosRules";

/**
 * MÓDULO ÁRBITRO — Acciones de servidor (Paso 16)
 *
 * Dos mundos conectados:
 *  · ADMIN (la liga): designaciones (directa o con confirmación), colegio
 *    (padrón + niveles + estado), eventos arbitrales y liquidaciones de
 *    honorarios vinculadas a tesorería.
 *  · ÁRBITRO: responde designaciones, edita su perfil (foto/teléfono/firma),
 *    carga su disponibilidad y ve calendario, estadísticas, planillas y pagos.
 *
 * Reglas de oro: toda escritura valida rol acá Y en RLS; el árbitro toca
 * solo lo suyo vía RPCs security definer; los avisos son por mensajería
 * interna (conversations.arbitro_id) y nunca bloquean la operación.
 */

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

async function requerirArbitro() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "arbitro" && profile?.role !== "arbitro_asistente") {
    throw new Error("Esta sección es solo para árbitros.");
  }
  return { supabase, user, nombre: profile.full_name ?? "Árbitro" };
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
    module: "arbitros",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

/** Aviso interno al árbitro por mensajería (conversations.arbitro_id, Paso 13). */
async function avisarArbitro(refereeId: string | null, texto: string, senderId: string) {
  if (!refereeId) return;
  try {
    const admin = createLfsAdminClient();
    let { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("arbitro_id", refereeId)
      .maybeSingle();
    if (!conv) {
      const { data: nueva } = await admin
        .from("conversations")
        .insert({ arbitro_id: refereeId, last_message_at: new Date().toISOString() })
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
    // silencioso: el aviso es un plus, la operación manda
  }
}

function revalidarArbitros() {
  revalidatePath("/admin/designaciones");
  revalidatePath("/admin/colegiodearbitros");
  revalidatePath("/arbitro/dashboard");
  revalidatePath("/arbitro/designaciones");
  revalidatePath("/arbitro/calendario");
  revalidatePath("/arbitro/estadisticas");
  revalidatePath("/arbitro/perfil");
  revalidatePath("/arbitro/planillas");
}

// ---------------------------------------------------------------------------
// Tipos UI
// ---------------------------------------------------------------------------

export interface NivelArbitroUI {
  id: string;
  nombre: string;
  orden: number;
  tarifa_partido: number;
}

export interface PartidoDesignacionUI {
  id: string;
  torneoNombre: string;
  categoriaNombre: string | null;
  matchday: number | null;
  scheduled_at: string | null;
  venueNombre: string | null;
  homeNombre: string;
  awayNombre: string;
  referee_id: string | null;
  arbitroNombre: string | null;
  designacion_modo: ModoDesignacion | null;
  designacion_estado: EstadoDesignacion | null;
  designacion_rechazo_motivo: string | null;
}

export interface ArbitroOpcionUI {
  id: string;
  nombre: string;
  nivelNombre: string | null;
  nivelOrden: number | null;
  estado: string;
  bloques: BloqueNoDisponible[];
  partidos: Array<{ id: string; scheduled_at: string | null }>;
}

export interface PanelDesignaciones {
  partidos: PartidoDesignacionUI[];
  arbitros: ArbitroOpcionUI[];
}

export interface PadronArbitroUI {
  id: string;
  nombre: string;
  email: string | null;
  rol: string;
  telefono: string | null;
  fotoUrl: string | null;
  nivelId: string | null;
  nivelNombre: string | null;
  nivelOrden: number | null;
  estado: string;
  tarifaOverride: number | null;
  dirigidos: number;
  amarillasPromedio: number;
  rojasTotal: number;
}

export interface EventoArbitralUI {
  id: string;
  fecha: string;
  hora: string | null;
  titulo: string;
  descripcion: string | null;
  obligatorio: boolean;
}

export interface LiquidacionUI {
  referee_id: string;
  nombre: string;
  nivelNombre: string | null;
  partidos: number;
  tarifa: number;
  monto: number;
  paymentId: string | null;
  status: "pendiente" | "pagado" | null;
  yaEnTesoreria: boolean;
}


// ============================================================================
// ADMIN — DESIGNACIONES (pantalla mejorada, manual, con confirmación opcional)
// ============================================================================

/** Datos para la pantalla de designaciones: partidos programados + árbitros. */
export async function obtenerPanelDesignaciones(): Promise<PanelDesignaciones> {
  const { supabase } = await requerirAdmin();

  const [
    { data: partidos },
    { data: arbitros },
    { data: perfilesRef },
    { data: niveles },
    { data: bloques },
    { data: partidosArbitros },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, competition_id, matchday, scheduled_at, venue_id, home_team_id, away_team_id, referee_id, designacion_modo, designacion_estado, designacion_rechazo_motivo, competitions(name, categories(name)), venues(name)"
      )
      .eq("status", "programado")
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .limit(300),
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["arbitro", "arbitro_asistente"])
      .order("full_name"),
    supabase.from("referee_profiles").select("user_id, level_id, estado"),
    supabase.from("referee_levels").select("id, nombre, orden, tarifa_partido").order("orden"),
    supabase
      .from("referee_unavailability")
      .select("referee_id, desde, hasta, motivo")
      .gte("hasta", new Date().toISOString().slice(0, 10)),
    supabase
      .from("matches")
      .select("id, referee_id, scheduled_at")
      .eq("status", "programado")
      .not("referee_id", "is", null)
      .not("scheduled_at", "is", null),
  ]);

  // Nombres de equipos (mapa aparte, como en designaciones del árbitro)
  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["sin-equipos"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  const nombreArbitro = new Map((arbitros ?? []).map((a) => [a.id, a.full_name ?? "Árbitro"]));

  const partidosUI: PartidoDesignacionUI[] = (partidos ?? []).map((p) => {
    const comp = p.competitions as unknown as {
      name: string;
      categories: { name: string } | null;
    } | null;
    return {
      id: p.id,
      torneoNombre: comp?.name ?? "Torneo",
      categoriaNombre: comp?.categories?.name ?? null,
      matchday: p.matchday,
      scheduled_at: p.scheduled_at,
      venueNombre: (p.venues as unknown as { name: string } | null)?.name ?? null,
      homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
      awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
      referee_id: p.referee_id,
      arbitroNombre: p.referee_id ? nombreArbitro.get(p.referee_id) ?? "—" : null,
      designacion_modo: (p.designacion_modo as ModoDesignacion | null) ?? null,
      designacion_estado: (p.designacion_estado as EstadoDesignacion | null) ?? null,
      designacion_rechazo_motivo: p.designacion_rechazo_motivo,
    };
  });

  const nivelPorId = new Map((niveles ?? []).map((n) => [n.id, n]));
  const perfilPorId = new Map((perfilesRef ?? []).map((r) => [r.user_id, r]));

  const arbitrosUI: ArbitroOpcionUI[] = (arbitros ?? []).map((a) => {
    const rp = perfilPorId.get(a.id);
    const nivel = rp?.level_id ? nivelPorId.get(rp.level_id) : null;
    return {
      id: a.id,
      nombre: a.full_name ?? "Árbitro",
      nivelNombre: nivel?.nombre ?? null,
      nivelOrden: nivel?.orden ?? null,
      estado: rp?.estado ?? "activo",
      bloques: (bloques ?? [])
        .filter((b) => b.referee_id === a.id)
        .map((b) => ({ desde: b.desde, hasta: b.hasta, motivo: b.motivo })),
      partidos: (partidosArbitros ?? [])
        .filter((m) => m.referee_id === a.id)
        .map((m) => ({ id: m.id, scheduled_at: m.scheduled_at })),
    };
  });

  return { partidos: partidosUI, arbitros: arbitrosUI };
}

/**
 * Designa un árbitro a uno o VARIOS partidos de una.
 * modo 'directa': queda designado y se le avisa.
 * modo 'propuesta': queda pendiente y el árbitro acepta o rechaza.
 */
export async function designarArbitro(
  matchIds: string[],
  refereeId: string,
  modo: ModoDesignacion
) {
  const { supabase, user } = await requerirAdmin();

  if (!Array.isArray(matchIds) || matchIds.length === 0) {
    return { error: "Elegí al menos un partido." };
  }
  if (modo !== "directa" && modo !== "propuesta") {
    return { error: "Modo de designación inválido." };
  }

  const { data: arbitro } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", refereeId)
    .single();
  if (!arbitro || !["arbitro", "arbitro_asistente"].includes(arbitro.role)) {
    return { error: "Ese usuario no es árbitro de la liga." };
  }

  const { data: rp } = await supabase
    .from("referee_profiles")
    .select("estado")
    .eq("user_id", refereeId)
    .maybeSingle();
  if (rp?.estado === "suspendido") {
    return { error: "Ese árbitro está suspendido. Reactivalo desde el Colegio de Árbitros." };
  }

  const ahora = new Date().toISOString();
  const update = {
    referee_id: refereeId,
    designacion_modo: modo,
    designacion_estado: modo === "propuesta" ? "pendiente" : null,
    designacion_rechazo_motivo: null,
    designado_at: ahora,
    designado_por: user.id,
  };

  const { error } = await supabase.from("matches").update(update).in("id", matchIds);
  if (error) return { error: "No se pudo designar. Avisame y lo vemos." };

  // Aviso interno con el detalle de los partidos
  const { data: partidos } = await supabase
    .from("matches")
    .select("scheduled_at, home_team_id, away_team_id")
    .in("id", matchIds);
  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["x"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  const detalles = (partidos ?? []).map((p) => {
    const fecha = p.scheduled_at
      ? new Date(p.scheduled_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
      : "fecha a confirmar";
    return `${nombreEquipo.get(p.home_team_id) ?? "—"} vs ${nombreEquipo.get(p.away_team_id) ?? "—"} (${fecha})`;
  });

  const texto =
    modo === "directa"
      ? `🟧 La liga te DESIGNÓ para ${matchIds.length === 1 ? "este partido" : `estos ${matchIds.length} partidos`}:\n• ${detalles.join("\n• ")}\nMirá el detalle en Designaciones.`
      : `📩 La liga te PROPUSO dirigir ${matchIds.length === 1 ? "este partido" : `estos ${matchIds.length} partidos`}:\n• ${detalles.join("\n• ")}\nEntrá a Designaciones para ACEPTAR o RECHAZAR.`;

  await avisarArbitro(refereeId, texto, user.id);
  await auditar(supabase, user.id, "arbitro_designado", null, { matchIds, refereeId, modo });
  revalidarArbitros();
  return { ok: true };
}

/** Quita la designación de un partido (con aviso al árbitro que estaba). */
export async function quitarDesignacion(matchId: string) {
  const { supabase, user } = await requerirAdmin();

  const { data: partido } = await supabase
    .from("matches")
    .select("referee_id")
    .eq("id", matchId)
    .single();
  if (!partido) return { error: "El partido no existe." };
  if (!partido.referee_id) return { error: "Ese partido no tiene árbitro designado." };

  const { error } = await supabase
    .from("matches")
    .update({
      referee_id: null,
      designacion_modo: null,
      designacion_estado: null,
      designacion_rechazo_motivo: null,
      designado_at: null,
      designado_por: null,
    })
    .eq("id", matchId);
  if (error) return { error: "No se pudo quitar la designación." };

  await avisarArbitro(
    partido.referee_id,
    "⚠️ La liga te quitó la designación de un partido. Si tenías la fecha reservada, ya quedó liberada.",
    user.id
  );
  await auditar(supabase, user.id, "arbitro_designacion_quitada", { matchId, anterior: partido.referee_id }, null);
  revalidarArbitros();
  return { ok: true };
}


// ============================================================================
// ADMIN — COLEGIO DE ÁRBITROS (padrón completo + niveles + estado)
// ============================================================================

const BUCKET_PERFILES = "perfiles-arbitros";

function urlFotoArbitro(fotoPath: string | null): string | null {
  if (!fotoPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET_PERFILES}/${fotoPath}`;
}

/** Padrón completo del colegio: datos, nivel, estado, contacto y stats reales. */
export async function obtenerColegio(): Promise<{
  padron: PadronArbitroUI[];
  niveles: NivelArbitroUI[];
}> {
  const { supabase } = await requerirAdmin();

  const [{ data: arbitros }, { data: perfilesRef }, { data: niveles }, { data: partidos }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .in("role", ["arbitro", "arbitro_asistente"])
        .order("full_name"),
      supabase
        .from("referee_profiles")
        .select("user_id, level_id, estado, telefono, foto_path, tarifa_override"),
      supabase.from("referee_levels").select("id, nombre, orden, tarifa_partido").order("orden"),
      supabase
        .from("matches")
        .select("id, referee_id, status, home_score, away_score")
        .in("status", ["jugado", "wo"])
        .not("referee_id", "is", null),
    ]);

  // Tarjetas por partido (para los promedios del padrón)
  const matchIds = (partidos ?? []).map((m) => m.id);
  const { data: eventos } = matchIds.length
    ? await supabase
        .from("match_events")
        .select("match_id, tipo")
        .in("match_id", matchIds)
        .in("tipo", ["amarilla", "roja"])
    : { data: [] as Array<{ match_id: string; tipo: string }> };

  const tarjetasPorPartido = new Map<string, { amarillas: number; rojas: number }>();
  for (const e of eventos ?? []) {
    const t = tarjetasPorPartido.get(e.match_id) ?? { amarillas: 0, rojas: 0 };
    if (e.tipo === "amarilla") t.amarillas++;
    if (e.tipo === "roja") t.rojas++;
    tarjetasPorPartido.set(e.match_id, t);
  }

  const perfilPorId = new Map((perfilesRef ?? []).map((r) => [r.user_id, r]));
  const nivelPorId = new Map((niveles ?? []).map((n) => [n.id, n]));

  const padron: PadronArbitroUI[] = (arbitros ?? []).map((a) => {
    const rp = perfilPorId.get(a.id);
    const nivel = rp?.level_id ? nivelPorId.get(rp.level_id) : null;
    const stats: EstadisticasArbitro = calcularEstadisticasArbitro(
      (partidos ?? [])
        .filter((m) => m.referee_id === a.id)
        .map((m): PartidoParaStats => {
          const t = tarjetasPorPartido.get(m.id) ?? { amarillas: 0, rojas: 0 };
          return {
            status: m.status,
            home_score: m.home_score,
            away_score: m.away_score,
            amarillas: t.amarillas,
            rojas: t.rojas,
          };
        })
    );
    return {
      id: a.id,
      nombre: a.full_name ?? "Árbitro",
      email: a.email ?? null,
      rol: a.role,
      telefono: rp?.telefono ?? null,
      fotoUrl: urlFotoArbitro(rp?.foto_path ?? null),
      nivelId: rp?.level_id ?? null,
      nivelNombre: nivel?.nombre ?? null,
      nivelOrden: nivel?.orden ?? null,
      estado: rp?.estado ?? "activo",
      tarifaOverride: rp?.tarifa_override ?? null,
      dirigidos: stats.dirigidos,
      amarillasPromedio: stats.amarillasPromedio,
      rojasTotal: stats.rojasTotal,
    };
  });

  return {
    padron,
    niveles: (niveles ?? []).map((n) => ({
      id: n.id,
      nombre: n.nombre,
      orden: n.orden,
      tarifa_partido: Number(n.tarifa_partido),
    })),
  };
}

/** Crea un nivel arbitral nuevo (nombre, orden, tarifa por partido). */
export async function guardarNivelArbitro(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const input = {
    nombre: String(formData.get("nombre") ?? ""),
    orden: Number(formData.get("orden") ?? 0),
    tarifa_partido: Number(formData.get("tarifa_partido") ?? 0),
  };
  const valido = validarNivelArbitro(input);
  if (!valido.ok) return { error: valido.error };

  const { error } = await supabase.from("referee_levels").insert({
    nombre: input.nombre.trim(),
    orden: input.orden,
    tarifa_partido: input.tarifa_partido,
  });
  if (error) {
    if (error.code === "23505") return { error: "Ya existe un nivel con ese nombre u orden." };
    return { error: "No se pudo guardar el nivel." };
  }

  await auditar(supabase, user.id, "nivel_arbitro_creado", null, input);
  revalidarArbitros();
  return { ok: true };
}

/** Actualiza la tarifa de un nivel (lo demás no se toca para no romper orden). */
export async function actualizarTarifaNivel(nivelId: string, tarifa: number) {
  const { supabase, user } = await requerirAdmin();
  if (tarifa < 0 || tarifa > 999999) return { error: "Tarifa inválida." };
  const { error } = await supabase
    .from("referee_levels")
    .update({ tarifa_partido: tarifa })
    .eq("id", nivelId);
  if (error) return { error: "No se pudo actualizar la tarifa." };
  await auditar(supabase, user.id, "nivel_arbitro_tarifa", null, { nivelId, tarifa });
  revalidarArbitros();
  return { ok: true };
}

/** Elimina un nivel (falla si hay árbitros que lo usan). */
export async function eliminarNivelArbitro(nivelId: string) {
  const { supabase, user } = await requerirAdmin();
  const { data: enUso } = await supabase
    .from("referee_profiles")
    .select("user_id")
    .eq("level_id", nivelId)
    .limit(1);
  if ((enUso ?? []).length > 0) {
    return { error: "Hay árbitros con ese nivel. Cambiales el nivel primero." };
  }
  const { error } = await supabase.from("referee_levels").delete().eq("id", nivelId);
  if (error) return { error: "No se pudo eliminar el nivel." };
  await auditar(supabase, user.id, "nivel_arbitro_eliminado", { nivelId }, null);
  revalidarArbitros();
  return { ok: true };
}

/** La liga fija nivel, estado y tarifa personalizada de un árbitro. */
export async function actualizarArbitroAdmin(input: {
  userId: string;
  levelId: string | null;
  estado: "activo" | "suspendido";
  tarifaOverride: number | null;
}) {
  const { supabase, user } = await requerirAdmin();

  if (input.estado !== "activo" && input.estado !== "suspendido") {
    return { error: "Estado inválido." };
  }
  if (input.tarifaOverride !== null && (input.tarifaOverride < 0 || input.tarifaOverride > 999999)) {
    return { error: "La tarifa personalizada no es válida." };
  }

  const { data: anterior } = await supabase
    .from("referee_profiles")
    .select("*")
    .eq("user_id", input.userId)
    .maybeSingle();

  const { error } = await supabase.from("referee_profiles").upsert(
    {
      user_id: input.userId,
      level_id: input.levelId,
      estado: input.estado,
      tarifa_override: input.tarifaOverride,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { error: "No se pudo guardar. Avisame y lo vemos." };

  await auditar(supabase, user.id, "arbitro_actualizado_admin", anterior, input);
  revalidarArbitros();
  return { ok: true };
}

/**
 * ADMIN — REGISTRAR ÁRBITRO CON CUENTA DE ACCESO
 * Crea el usuario en Supabase Auth (email + contraseña), asegura su fila en profiles
 * con el rol arbitral (arbitro o arbitro_asistente) y guarda sus datos en referee_profiles.
 */
export async function registrarArbitro(formData: FormData): Promise<{
  ok: boolean;
  error?: string;
  arbitroId?: string;
}> {
  const { supabase, user } = await requerirAdmin();

  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  const dni = String(formData.get("dni") ?? "").trim() || null;
  const rolInput = String(formData.get("rol") ?? "arbitro").trim();
  const levelId = String(formData.get("levelId") ?? "").trim() || null;
  const tarifaRaw = formData.get("tarifaOverride");
  const tarifaOverride =
    tarifaRaw !== null && String(tarifaRaw).trim() !== ""
      ? Number(tarifaRaw)
      : null;

  const rol = rolInput === "arbitro_asistente" ? "arbitro_asistente" : "arbitro";

  const validacion = validarRegistroArbitro({
    nombre,
    email,
    password,
    telefono,
    dni,
    rol,
    tarifaOverride,
  });

  if (!validacion.ok) {
    return { ok: false, error: validacion.error };
  }

  // Usar service_role para crear el usuario en Auth sin requerir confirmación por email
  const admin = createLfsAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: nombre,
      dni,
      role: rol,
    },
  });

  if (authError) {
    const msg = authError.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists")) {
      return { ok: false, error: `El correo ${email} ya está registrado en la plataforma.` };
    }
    return { ok: false, error: `No se pudo crear la cuenta: ${authError.message}` };
  }

  if (!authData?.user) {
    return { ok: false, error: "No se pudo obtener el usuario creado." };
  }

  const nuevoUserId = authData.user.id;

  // Asegurar fila en profiles
  const { error: profileError } = await admin.from("profiles").upsert({
    id: nuevoUserId,
    full_name: nombre,
    email,
    role: rol,
  });

  if (profileError) {
    return {
      ok: false,
      error: `Usuario de Auth creado, pero falló el perfil: ${profileError.message}`,
    };
  }

  // Crear perfil extendido en referee_profiles
  const { error: refError } = await admin.from("referee_profiles").upsert({
    user_id: nuevoUserId,
    level_id: levelId,
    estado: "activo",
    telefono,
    tarifa_override: tarifaOverride,
    updated_at: new Date().toISOString(),
  });

  if (refError) {
    return {
      ok: false,
      error: `Perfil arbitral no guardado: ${refError.message}`,
    };
  }

  await auditar(supabase, user.id, "arbitro_registrado", null, {
    id: nuevoUserId,
    nombre,
    email,
    rol,
    levelId,
    telefono,
    dni,
  });

  revalidarArbitros();
  return { ok: true, arbitroId: nuevoUserId };
}

// ============================================================================
// ADMIN — EVENTOS ARBITRALES (capacitaciones, congresos)
// ============================================================================

export async function obtenerEventosArbitrales(): Promise<EventoArbitralUI[]> {
  const { supabase } = await requerirAdmin();
  const { data } = await supabase
    .from("referee_events")
    .select("id, fecha, hora, titulo, descripcion, obligatorio")
    .order("fecha", { ascending: true });
  return (data ?? []).map((e) => ({
    id: e.id,
    fecha: e.fecha,
    hora: e.hora,
    titulo: e.titulo,
    descripcion: e.descripcion,
    obligatorio: e.obligatorio,
  }));
}

export async function crearEventoArbitral(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const input = {
    fecha: String(formData.get("fecha") ?? ""),
    hora: String(formData.get("hora") ?? "").trim() || null,
    titulo: String(formData.get("titulo") ?? ""),
    descripcion: String(formData.get("descripcion") ?? "").trim() || null,
    obligatorio: formData.get("obligatorio") === "on",
  };
  const valido = validarEventoArbitral(input);
  if (!valido.ok) return { error: valido.error };

  const { error } = await supabase.from("referee_events").insert({
    fecha: input.fecha,
    hora: input.hora,
    titulo: input.titulo.trim(),
    descripcion: input.descripcion,
    obligatorio: input.obligatorio,
    created_by: user.id,
  });
  if (error) return { error: "No se pudo crear el evento." };

  await auditar(supabase, user.id, "evento_arbitral_creado", null, input);
  revalidarArbitros();
  return { ok: true };
}

export async function eliminarEventoArbitral(eventoId: string) {
  const { supabase, user } = await requerirAdmin();
  const { error } = await supabase.from("referee_events").delete().eq("id", eventoId);
  if (error) return { error: "No se pudo eliminar el evento." };
  await auditar(supabase, user.id, "evento_arbitral_eliminado", { eventoId }, null);
  revalidarArbitros();
  return { ok: true };
}


// ============================================================================
// ADMIN — LIQUIDACIONES MENSUALES (honorarios ↔ tesorería)
// ============================================================================

/** Datos del mes elegido: partidos liquidables por árbitro + pagos ya hechos. */
export async function obtenerLiquidaciones(periodo: string): Promise<{
  periodo: string;
  filas: LiquidacionUI[];
}> {
  const { supabase } = await requerirAdmin();

  const desde = `${periodo}-01`;
  const [anio, mes] = periodo.split("-").map(Number);
  const hasta = new Date(anio, mes, 1).toISOString().slice(0, 10); // 1° del mes siguiente

  const [
    { data: partidos },
    { data: arbitros },
    { data: perfilesRef },
    { data: niveles },
    { data: pagos },
  ] = await Promise.all([
    supabase
      .from("matches")
      .select("referee_id, status, result_confirmed")
      .in("status", ["jugado", "wo"])
      .gte("scheduled_at", desde)
      .lt("scheduled_at", hasta)
      .not("referee_id", "is", null),
    supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["arbitro", "arbitro_asistente"])
      .order("full_name"),
    supabase.from("referee_profiles").select("user_id, level_id, tarifa_override"),
    supabase.from("referee_levels").select("id, nombre, orden, tarifa_partido"),
    supabase
      .from("referee_payments")
      .select("id, referee_id, status, treasury_expense_id")
      .eq("periodo", periodo),
  ]);

  const perfilPorId = new Map((perfilesRef ?? []).map((r) => [r.user_id, r]));
  const nivelPorId = new Map((niveles ?? []).map((n) => [n.id, n]));
  const pagoPorRef = new Map((pagos ?? []).map((p) => [p.referee_id, p]));

  const filas: LiquidacionUI[] = (arbitros ?? [])
    .map((a) => {
      const rp = perfilPorId.get(a.id);
      const nivel = rp?.level_id ? nivelPorId.get(rp.level_id) : null;
      const tarifa = tarifaEfectiva(
        rp?.tarifa_override != null ? Number(rp.tarifa_override) : null,
        nivel ? Number(nivel.tarifa_partido) : null
      );
      const cantidad = (partidos ?? []).filter(
        (m) => m.referee_id === a.id && partidoLiquidable(m.status, m.result_confirmed)
      ).length;
      const pago = pagoPorRef.get(a.id);
      return {
        referee_id: a.id,
        nombre: a.full_name ?? "Árbitro",
        nivelNombre: nivel?.nombre ?? null,
        partidos: cantidad,
        tarifa,
        monto: calcularLiquidacion(cantidad, tarifa),
        paymentId: pago?.id ?? null,
        status: (pago?.status as "pendiente" | "pagado" | undefined) ?? null,
        yaEnTesoreria: !!pago?.treasury_expense_id,
      };
    })
    // Solo mostramos árbitros con actividad o con pago registrado
    .filter((f) => f.partidos > 0 || f.paymentId !== null);

  return { periodo, filas };
}

/**
 * Genera (o actualiza) la liquidación de UN árbitro para un mes.
 * Si registrarEnTesoreria=true, crea el gasto en tesorería (categoría
 * 'arbitros') y marca la liquidación como pagada — todo vinculado.
 */
export async function generarLiquidacion(
  refereeId: string,
  periodo: string,
  registrarEnTesoreria: boolean
) {
  const { supabase, user } = await requerirAdmin();

  const { filas } = await obtenerLiquidaciones(periodo);
  const fila = filas.find((f) => f.referee_id === refereeId);
  if (!fila) return { error: "Ese árbitro no dirigió partidos confirmados en ese mes." };
  if (fila.monto <= 0) {
    return { error: "La liquidación da $ 0: revisá la tarifa del nivel o del árbitro." };
  }
  if (fila.yaEnTesoreria) {
    return { error: "Esa liquidación ya fue registrada en tesorería." };
  }

  let expenseId: string | null = null;
  if (registrarEnTesoreria) {
    const { data: gasto, error: errorGasto } = await supabase
      .from("treasury_expenses")
      .insert({
        categoria: "arbitros",
        concepto: `Honorarios arbitrales ${nombrePeriodo(periodo)} — ${fila.nombre} (${fila.partidos} partidos × $${fila.tarifa.toLocaleString("es-AR")})`,
        monto: fila.monto,
        fecha: new Date().toISOString().slice(0, 10),
        club_id: null,
        creado_por: user.id,
      })
      .select("id")
      .single();
    if (errorGasto) {
      return { error: "No se pudo registrar el gasto en tesorería (¿el mes está cerrado?)." };
    }
    expenseId = gasto.id;
  }

  const { error } = await supabase.from("referee_payments").upsert(
    {
      referee_id: refereeId,
      periodo,
      partidos: fila.partidos,
      tarifa: fila.tarifa,
      monto: fila.monto,
      status: registrarEnTesoreria ? "pagado" : "pendiente",
      treasury_expense_id: expenseId,
      created_by: user.id,
    },
    { onConflict: "referee_id,periodo" }
  );
  if (error) return { error: "No se pudo guardar la liquidación." };

  await avisarArbitro(
    refereeId,
    registrarEnTesoreria
      ? `💰 La liga registró tu liquidación de ${nombrePeriodo(periodo)}: ${fila.partidos} partidos × $${fila.tarifa.toLocaleString("es-AR")} = $${fila.monto.toLocaleString("es-AR")} (PAGADA).`
      : `🧾 La liga generó tu liquidación de ${nombrePeriodo(periodo)}: $${fila.monto.toLocaleString("es-AR")} pendiente de pago.`,
    user.id
  );

  await auditar(supabase, user.id, "liquidacion_arbitro", null, {
    refereeId,
    periodo,
    monto: fila.monto,
    registrarEnTesoreria,
  });
  revalidarArbitros();
  revalidatePath("/admin/tesoreria/gastos");
  return { ok: true };
}


// ============================================================================
// ÁRBITRO — MI MUNDO (panel, designaciones, perfil, disponibilidad, etc.)
// ============================================================================

export interface MiDesignacionUI {
  id: string;
  torneoNombre: string;
  matchday: number | null;
  scheduled_at: string | null;
  venueNombre: string | null;
  homeNombre: string;
  awayNombre: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  result_confirmed: boolean;
  designacion_modo: ModoDesignacion | null;
  designacion_estado: EstadoDesignacion | null;
}

async function listarMisPartidos(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  userId: string,
  incluirFinalizados: boolean
): Promise<MiDesignacionUI[]> {
  const estados = incluirFinalizados ? ["programado", "jugado", "wo", "suspendido"] : ["programado"];
  const { data: partidos } = await supabase
    .from("matches")
    .select(
      "id, competition_id, matchday, scheduled_at, venue_id, home_team_id, away_team_id, status, home_score, away_score, result_confirmed, designacion_modo, designacion_estado, competitions(name), venues(name)"
    )
    .eq("referee_id", userId)
    .in("status", estados)
    .order("scheduled_at", { ascending: true, nullsFirst: false });

  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["sin-equipos"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  return (partidos ?? []).map((p) => ({
    id: p.id,
    torneoNombre: (p.competitions as unknown as { name: string } | null)?.name ?? "Torneo",
    matchday: p.matchday,
    scheduled_at: p.scheduled_at,
    venueNombre: (p.venues as unknown as { name: string } | null)?.name ?? null,
    homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
    awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
    status: p.status,
    home_score: p.home_score,
    away_score: p.away_score,
    result_confirmed: p.result_confirmed,
    designacion_modo: (p.designacion_modo as ModoDesignacion | null) ?? null,
    designacion_estado: (p.designacion_estado as EstadoDesignacion | null) ?? null,
  }));
}

/** Mis designaciones: pendientes de respuesta, próximas e historial. */
export async function obtenerMisDesignaciones(): Promise<MiDesignacionUI[]> {
  const { supabase, user } = await requerirArbitro();
  return listarMisPartidos(supabase, user.id, true);
}

/** El árbitro acepta o rechaza una propuesta de designación. */
export async function responderDesignacion(
  matchId: string,
  aceptar: boolean,
  motivo?: string
) {
  const { supabase, user, nombre } = await requerirArbitro();

  if (!aceptar && !motivo?.trim()) {
    return { error: "Para rechazar, contanos el motivo (así la liga puede reprogramar)." };
  }

  const { error } = await supabase.rpc("arbitro_responder_designacion", {
    p_match_id: matchId,
    p_aceptar: aceptar,
    p_motivo: motivo?.trim() || null,
  });
  if (error) {
    return { error: "No se pudo responder (¿ya la habías contestado?). Actualizá la página." };
  }

  // Aviso en la conversación del árbitro (lo lee la liga en Mensajería)
  const { data: partido } = await supabase
    .from("matches")
    .select("designado_por, home_team_id, away_team_id")
    .eq("id", matchId)
    .single();
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [partido?.home_team_id ?? "x", partido?.away_team_id ?? "y"]);
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));
  const desc = `${nombreEquipo.get(partido?.home_team_id ?? "") ?? "—"} vs ${nombreEquipo.get(partido?.away_team_id ?? "") ?? "—"}`;

  await avisarArbitro(
    user.id,
    aceptar
      ? `✅ ${nombre} ACEPTÓ la designación: ${desc}.`
      : `❌ ${nombre} RECHAZÓ la designación: ${desc}. Motivo: ${motivo?.trim()}.`,
    user.id
  );

  revalidarArbitros();
  return { ok: true };
}

// ---------- Panel (dashboard del árbitro) ----------

export interface PanelArbitroUI {
  nombre: string;
  nivelNombre: string | null;
  estado: string;
  kpis: {
    partidosEsteMes: number;
    pendientesRespuesta: number;
    planillasPorConfirmar: number;
    dirigidosTotal: number;
  };
  proximos: MiDesignacionUI[];
  pendientes: MiDesignacionUI[];
}

export async function obtenerMiPanel(): Promise<PanelArbitroUI> {
  const { supabase, user, nombre } = await requerirArbitro();

  const [{ data: rp }, { data: nivel }, todos] = await Promise.all([
    supabase
      .from("referee_profiles")
      .select("level_id, estado")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("referee_levels").select("id, nombre"),
    listarMisPartidos(supabase, user.id, true),
  ]);

  const nivelNombre = rp?.level_id
    ? (nivel ?? []).find((n) => n.id === rp.level_id)?.nombre ?? null
    : null;

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString();
  const finMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1).toISOString();

  const programados = todos.filter((p) => p.status === "programado");
  const pendientes = programados.filter(
    (p) => p.designacion_modo === "propuesta" && p.designacion_estado === "pendiente"
  );

  return {
    nombre,
    nivelNombre,
    estado: rp?.estado ?? "activo",
    kpis: {
      partidosEsteMes: programados.filter(
        (p) => p.scheduled_at && p.scheduled_at >= inicioMes && p.scheduled_at < finMes
      ).length,
      pendientesRespuesta: pendientes.length,
      planillasPorConfirmar: todos.filter(
        (p) => (p.status === "jugado" || p.status === "wo") && !p.result_confirmed
      ).length,
      dirigidosTotal: todos.filter((p) => p.status === "jugado" || p.status === "wo").length,
    },
    proximos: programados
      .filter((p) => !pendientes.includes(p))
      .slice(0, 5),
    pendientes,
  };
}

// ---------- Perfil (foto, teléfono, firma) ----------

export interface MiPerfilUI {
  nombre: string;
  email: string | null;
  rol: string;
  telefono: string | null;
  fotoUrl: string | null;
  firmaUrl: string | null;
  nivelNombre: string | null;
  estado: string;
}

export async function obtenerMiPerfil(): Promise<MiPerfilUI> {
  const { supabase, user, nombre } = await requerirArbitro();

  const [{ data: profile }, { data: rp }, { data: nivel }] = await Promise.all([
    supabase.from("profiles").select("email, role").eq("id", user.id).single(),
    supabase
      .from("referee_profiles")
      .select("level_id, estado, telefono, foto_path, firma_path")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("referee_levels").select("id, nombre"),
  ]);

  return {
    nombre,
    email: profile?.email ?? user.email ?? null,
    rol: profile?.role ?? "arbitro",
    telefono: rp?.telefono ?? null,
    fotoUrl: urlFotoArbitro(rp?.foto_path ?? null),
    firmaUrl: urlFotoArbitro(rp?.firma_path ?? null),
    nivelNombre: rp?.level_id
      ? (nivel ?? []).find((n) => n.id === rp.level_id)?.nombre ?? null
      : null,
    estado: rp?.estado ?? "activo",
  };
}

/** Guarda teléfono + foto + firma (los archivos se suben acá mismo). */
export async function guardarMiPerfil(formData: FormData) {
  const { supabase, user } = await requerirArbitro();

  const telefono = String(formData.get("telefono") ?? "").trim() || null;
  if (telefono && telefono.length > 25) {
    return { error: "El teléfono es demasiado largo." };
  }

  let fotoPath: string | null = null;
  let firmaPath: string | null = null;

  const foto = formData.get("foto");
  if (foto instanceof File && foto.size > 0) {
    if (foto.size > 5 * 1024 * 1024) return { error: "La foto no puede pesar más de 5 MB." };
    const ext = foto.name.split(".").pop()?.toLowerCase() ?? "jpg";
    fotoPath = `${user.id}/foto.${ext}`;
    const { error: errFoto } = await supabase.storage
      .from(BUCKET_PERFILES)
      .upload(fotoPath, foto, { contentType: foto.type, upsert: true });
    if (errFoto) return { error: "No se pudo subir la foto." };
  }

  const firma = formData.get("firma");
  if (firma instanceof File && firma.size > 0) {
    if (firma.size > 2 * 1024 * 1024) return { error: "La firma no puede pesar más de 2 MB." };
    firmaPath = `${user.id}/firma.png`;
    const { error: errFirma } = await supabase.storage
      .from(BUCKET_PERFILES)
      .upload(firmaPath, firma, { contentType: "image/png", upsert: true });
    if (errFirma) return { error: "No se pudo subir la firma." };
  }

  const { error } = await supabase.rpc("arbitro_actualizar_perfil", {
    p_telefono: telefono,
    p_foto_path: fotoPath,
    p_firma_path: firmaPath,
  });
  if (error) return { error: "No se pudo guardar el perfil." };

  revalidarArbitros();
  return { ok: true };
}

// ---------- Disponibilidad ----------

export interface MiBloqueUI {
  id: string;
  desde: string;
  hasta: string;
  motivo: string | null;
}

export async function obtenerMiDisponibilidad(): Promise<MiBloqueUI[]> {
  const { supabase, user } = await requerirArbitro();
  const { data } = await supabase
    .from("referee_unavailability")
    .select("id, desde, hasta, motivo")
    .eq("referee_id", user.id)
    .gte("hasta", new Date().toISOString().slice(0, 10))
    .order("desde");
  return (data ?? []).map((b) => ({
    id: b.id,
    desde: b.desde,
    hasta: b.hasta,
    motivo: b.motivo,
  }));
}

export async function guardarBloqueDisponibilidad(formData: FormData) {
  const { supabase, user } = await requerirArbitro();

  const input = {
    desde: String(formData.get("desde") ?? ""),
    hasta: String(formData.get("hasta") ?? ""),
    motivo: String(formData.get("motivo") ?? "").trim() || null,
  };
  const valido = validarBloqueDisponibilidad(input);
  if (!valido.ok) return { error: valido.error };

  const { error } = await supabase.from("referee_unavailability").insert({
    referee_id: user.id,
    desde: input.desde,
    hasta: input.hasta,
    motivo: input.motivo,
  });
  if (error) return { error: "No se pudo guardar el bloque." };

  revalidarArbitros();
  return { ok: true };
}

export async function eliminarBloqueDisponibilidad(bloqueId: string) {
  const { supabase, user } = await requerirArbitro();
  const { error } = await supabase
    .from("referee_unavailability")
    .delete()
    .eq("id", bloqueId)
    .eq("referee_id", user.id);
  if (error) return { error: "No se pudo eliminar el bloque." };
  revalidarArbitros();
  return { ok: true };
}


// ---------- Calendario (partidos + eventos de la liga + mis bloques) ----------

export interface DiaCalendarioUI {
  fecha: string; // 'YYYY-MM-DD'
  partidos: Array<{
    id: string;
    hora: string | null;
    descripcion: string;
    torneo: string;
    status: string;
  }>;
  eventos: EventoArbitralUI[];
  bloqueado: string | null; // motivo del bloque, si hay
}

export async function obtenerMiCalendario(mes: string): Promise<DiaCalendarioUI[]> {
  const { supabase, user } = await requerirArbitro();

  const desde = `${mes}-01`;
  const [anio, m] = mes.split("-").map(Number);
  const hasta = new Date(anio, m, 1).toISOString().slice(0, 10);

  const [{ data: partidos }, { data: eventos }, { data: bloques }] = await Promise.all([
    supabase
      .from("matches")
      .select(
        "id, scheduled_at, status, home_team_id, away_team_id, competitions(name)"
      )
      .eq("referee_id", user.id)
      .gte("scheduled_at", desde)
      .lt("scheduled_at", hasta)
      .order("scheduled_at"),
    supabase
      .from("referee_events")
      .select("id, fecha, hora, titulo, descripcion, obligatorio")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha"),
    supabase
      .from("referee_unavailability")
      .select("desde, hasta, motivo")
      .eq("referee_id", user.id)
      .lte("desde", hasta)
      .gte("hasta", desde),
  ]);

  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["sin-equipos"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  const dias = new Map<string, DiaCalendarioUI>();
  const diaDe = (fecha: string): DiaCalendarioUI => {
    const d = dias.get(fecha) ?? { fecha, partidos: [], eventos: [], bloqueado: null };
    dias.set(fecha, d);
    return d;
  };

  for (const p of partidos ?? []) {
    if (!p.scheduled_at) continue;
    const fecha = p.scheduled_at.slice(0, 10);
    diaDe(fecha).partidos.push({
      id: p.id,
      hora: new Date(p.scheduled_at).toLocaleTimeString("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      descripcion: `${nombreEquipo.get(p.home_team_id) ?? "—"} vs ${nombreEquipo.get(p.away_team_id) ?? "—"}`,
      torneo: (p.competitions as unknown as { name: string } | null)?.name ?? "Torneo",
      status: p.status,
    });
  }
  for (const e of eventos ?? []) {
    diaDe(e.fecha).eventos.push({
      id: e.id,
      fecha: e.fecha,
      hora: e.hora,
      titulo: e.titulo,
      descripcion: e.descripcion,
      obligatorio: e.obligatorio,
    });
  }
  // Bloques: marcan TODOS los días del rango dentro del mes
  for (const b of bloques ?? []) {
    let d = b.desde < desde ? desde : b.desde;
    const fin = b.hasta < hasta ? b.hasta : hasta;
    while (d < fin || d === b.hasta) {
      if (d >= desde && d < hasta) {
        diaDe(d).bloqueado = b.motivo ?? "No disponible";
      }
      if (d >= fin && d >= b.hasta) break;
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      d = next.toISOString().slice(0, 10);
      if (d > b.hasta) break;
    }
  }

  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------- Estadísticas ----------

export interface StatsPorTorneoUI {
  torneoId: string;
  torneoNombre: string;
  stats: EstadisticasArbitro;
}

export async function obtenerMisEstadisticas(): Promise<{
  total: EstadisticasArbitro;
  porTorneo: StatsPorTorneoUI[];
}> {
  const { supabase, user } = await requerirArbitro();

  const { data: partidos } = await supabase
    .from("matches")
    .select("id, competition_id, status, home_score, away_score, competitions(name)")
    .eq("referee_id", user.id)
    .in("status", ["jugado", "wo"]);

  const matchIds = (partidos ?? []).map((m) => m.id);
  const { data: eventos } = matchIds.length
    ? await supabase
        .from("match_events")
        .select("match_id, tipo")
        .in("match_id", matchIds)
        .in("tipo", ["amarilla", "roja"])
    : { data: [] as Array<{ match_id: string; tipo: string }> };

  const tarjetasPorPartido = new Map<string, { amarillas: number; rojas: number }>();
  for (const e of eventos ?? []) {
    const t = tarjetasPorPartido.get(e.match_id) ?? { amarillas: 0, rojas: 0 };
    if (e.tipo === "amarilla") t.amarillas++;
    if (e.tipo === "roja") t.rojas++;
    tarjetasPorPartido.set(e.match_id, t);
  }

  interface MatchStatsRow {
    id: string;
    competition_id: string;
    status: string;
    home_score: number | null;
    away_score: number | null;
  }
  const filas = (partidos ?? []) as unknown as MatchStatsRow[];
  const aStats = (m: MatchStatsRow): PartidoParaStats => {
    const t = tarjetasPorPartido.get(m.id) ?? { amarillas: 0, rojas: 0 };
    return {
      status: m.status,
      home_score: m.home_score,
      away_score: m.away_score,
      amarillas: t.amarillas,
      rojas: t.rojas,
    };
  };

  const total = calcularEstadisticasArbitro(filas.map(aStats));

  const nombreTorneo = new Map<string, string>();
  for (const p of partidos ?? []) {
    nombreTorneo.set(
      p.competition_id,
      (p.competitions as unknown as { name: string } | null)?.name ?? "Torneo"
    );
  }
  const torneos = new Map<string, StatsPorTorneoUI>();
  for (const p of filas) {
    if (!torneos.has(p.competition_id)) {
      torneos.set(p.competition_id, {
        torneoId: p.competition_id,
        torneoNombre: nombreTorneo.get(p.competition_id) ?? "Torneo",
        stats: { dirigidos: 0, golesPromedio: 0, amarillasPromedio: 0, rojasTotal: 0, wo: 0 },
      });
    }
  }
  for (const [id, t] of torneos) {
    const delTorneo = filas.filter((p) => p.competition_id === id);
    t.stats = calcularEstadisticasArbitro(delTorneo.map(aStats));
  }

  return {
    total,
    porTorneo: [...torneos.values()].sort((a, b) => b.stats.dirigidos - a.stats.dirigidos),
  };
}

// ---------- Historial de planillas (read-only con resumen) ----------

export interface PlanillaHistorialUI {
  matchId: string;
  torneoNombre: string;
  fecha: string | null;
  homeNombre: string;
  awayNombre: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  result_confirmed: boolean;
  goles: number;
  amarillas: number;
  rojas: number;
}

export async function obtenerMisPlanillasHistorial(): Promise<PlanillaHistorialUI[]> {
  const { supabase, user } = await requerirArbitro();

  const { data: partidos } = await supabase
    .from("matches")
    .select(
      "id, scheduled_at, status, home_score, away_score, result_confirmed, home_team_id, away_team_id, competitions(name)"
    )
    .eq("referee_id", user.id)
    .in("status", ["jugado", "wo"])
    .order("scheduled_at", { ascending: false })
    .limit(100);

  const teamIds = new Set<string>();
  for (const p of partidos ?? []) {
    teamIds.add(p.home_team_id);
    teamIds.add(p.away_team_id);
  }
  const { data: equipos } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", Array.from(teamIds.size > 0 ? teamIds : ["sin-equipos"]));
  const nombreEquipo = new Map((equipos ?? []).map((e) => [e.id, e.name]));

  const matchIds = (partidos ?? []).map((m) => m.id);
  const { data: eventos } = matchIds.length
    ? await supabase
        .from("match_events")
        .select("match_id, tipo")
        .in("match_id", matchIds)
    : { data: [] as Array<{ match_id: string; tipo: string }> };

  const resumenPorPartido = new Map<string, { goles: number; amarillas: number; rojas: number }>();
  for (const e of eventos ?? []) {
    const r = resumenPorPartido.get(e.match_id) ?? { goles: 0, amarillas: 0, rojas: 0 };
    if (e.tipo === "gol" || e.tipo === "gol_en_contra") r.goles++;
    if (e.tipo === "amarilla") r.amarillas++;
    if (e.tipo === "roja") r.rojas++;
    resumenPorPartido.set(e.match_id, r);
  }

  return (partidos ?? []).map((p) => {
    const r = resumenPorPartido.get(p.id) ?? { goles: 0, amarillas: 0, rojas: 0 };
    return {
      matchId: p.id,
      torneoNombre: (p.competitions as unknown as { name: string } | null)?.name ?? "Torneo",
      fecha: p.scheduled_at,
      homeNombre: nombreEquipo.get(p.home_team_id) ?? "—",
      awayNombre: nombreEquipo.get(p.away_team_id) ?? "—",
      home_score: p.home_score,
      away_score: p.away_score,
      status: p.status,
      result_confirmed: p.result_confirmed,
      goles: r.goles,
      amarillas: r.amarillas,
      rojas: r.rojas,
    };
  });
}

// ---------- Mis liquidaciones ----------

export interface MiPagoUI {
  id: string;
  periodo: string;
  periodoLindo: string;
  partidos: number;
  tarifa: number;
  monto: number;
  status: "pendiente" | "pagado";
}

export async function obtenerMisLiquidaciones(): Promise<MiPagoUI[]> {
  const { supabase, user } = await requerirArbitro();
  const { data } = await supabase
    .from("referee_payments")
    .select("id, periodo, partidos, tarifa, monto, status")
    .eq("referee_id", user.id)
    .order("periodo", { ascending: false });
  return (data ?? []).map((p) => ({
    id: p.id,
    periodo: p.periodo,
    periodoLindo: nombrePeriodo(p.periodo),
    partidos: p.partidos,
    tarifa: Number(p.tarifa),
    monto: Number(p.monto),
    status: p.status as "pendiente" | "pagado",
  }));
}
