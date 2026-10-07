"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  puedeApelar,
  validarSancionManual,
  validarModificacionSancion,
  validarAnulacion,
  validarResolucionApelacion,
  validarMotivoApelacion,
  type TipoSancionado,
} from "@/lib/core/rules/tribunalRules";

/**
 * TRIBUNAL DE DISCIPLINA LFS — Acciones de servidor
 * Sanciones automáticas modificables (con auditoría), sanciones manuales
 * (jugador / cuerpo técnico / club), catálogo de infracciones, apelaciones
 * del club (72 hs) y multas vinculadas a tesorería.
 */

// ---------- Tipos compartidos ----------

export interface PagoResumen {
  status: string;
  resueltoAt: string | null;
}

export interface CargoMulta {
  id: string;
  status: "pendiente" | "parcial" | "pagado" | "anulado";
  monto: number;
  ultimoPago: PagoResumen | null;
}

export interface ApelacionResumen {
  id: string;
  estado: "pendiente" | "aceptada" | "rechazada";
}

export interface ApelacionFila extends ApelacionResumen {
  motivo: string;
  adjuntos: Array<{ path: string; nombre: string }>;
  resolucion: string | null;
  resueltoAt: string | null;
  createdAt: string;
  sancionId: string;
}

export interface SancionFila {
  id: string;
  origen: "automatica" | "manual";
  sancionadoTipo: TipoSancionado;
  sancionadoNombre: string;
  playerId: string | null;
  clubId: string | null;
  clubNombre: string;
  equipoNombre: string | null;
  competitionId: string | null;
  competitionNombre: string | null;
  infraccion: string;
  partidosPendientes: number;
  montoMulta: number | null;
  anuladaAt: string | null;
  anuladaMotivo: string | null;
  createdAt: string;
  cargo: CargoMulta | null;
  apelacion: ApelacionResumen | null;
}

export interface InfraccionCatalogo {
  id: string;
  nombre: string;
  descripcion: string | null;
  aplicaA: "jugador" | "cuerpo_tecnico" | "club" | "todos";
  fechasDefault: number;
  multaDefault: number;
  activo: boolean;
  orden: number;
}

export interface OpcionBasica {
  id: string;
  nombre: string;
}

export interface PanelTribunal {
  sanciones: SancionFila[];
  apelaciones: ApelacionFila[];
  catalogo: InfraccionCatalogo[];
  clubes: OpcionBasica[];
  competencias: OpcionBasica[];
}

export interface EventoTarjeta {
  id: string;
  tipo: "amarilla" | "roja";
  minuto: number | null;
  fechaPartido: string | null;
  rival: string;
  torneo: string;
}

export interface FichaDisciplinaria {
  jugador: { id: string; nombre: string; dni: string };
  clubNombre: string;
  tarjetas: EventoTarjeta[];
  sanciones: SancionFila[];
  apelaciones: ApelacionFila[];
}

// ---------- Helpers internos ----------

async function obtenerUsuarioOError() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");
  return { supabase, user };
}

async function requerirAdmin() {
  const { supabase, user } = await obtenerUsuarioOError();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") throw new Error("Solo la federación puede usar el tribunal.");
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
    module: "tribunal",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

function revalidarTribunal() {
  revalidatePath("/admin/tribunal/sanciones");
  revalidatePath("/admin/tribunal");
  revalidatePath("/club/tribunal");
  revalidatePath("/club/finanzas");
  revalidatePath("/admin/tesoreria");
}

// ---------- Armado de filas (queries → tipos de UI) ----------

type FilaSuspension = {
  id: string;
  origen: string;
  sancionado_tipo: string;
  sancionado_nombre: string | null;
  player_id: string | null;
  team_id: string | null;
  club_id: string | null;
  competition_id: string | null;
  motivo: string;
  partidos_pendientes: number;
  monto_multa: number | null;
  treasury_charge_id: string | null;
  anulada_at: string | null;
  anulada_motivo: string | null;
  created_at: string;
  players: { first_name: string; last_name: string } | null;
  teams: { name: string; club_id: string; clubs: { name: string } | null } | null;
  competitions: { name: string } | null;
};

function armarSanciones(
  filas: FilaSuspension[],
  clubesPorId: Map<string, string>,
  cargosPorSuspension: Map<string, CargoMulta>,
  apelacionPorSuspension: Map<string, ApelacionResumen>
): SancionFila[] {
  return filas.map((f) => {
    const clubId = f.club_id ?? f.teams?.club_id ?? null;
    const sancionadoNombre =
      f.sancionado_tipo === "jugador" && f.players
        ? `${f.players.first_name} ${f.players.last_name}`
        : f.sancionado_tipo === "club"
          ? (clubId ? (clubesPorId.get(clubId) ?? "Club") : (f.sancionado_nombre ?? "Club"))
          : (f.sancionado_nombre ?? "Sin nombre");
    return {
      id: f.id,
      origen: f.origen === "manual" ? "manual" : "automatica",
      sancionadoTipo: (f.sancionado_tipo as TipoSancionado) ?? "jugador",
      sancionadoNombre,
      playerId: f.player_id,
      clubId,
      clubNombre: clubId ? (clubesPorId.get(clubId) ?? "—") : (f.teams?.clubs?.name ?? "—"),
      equipoNombre: f.teams?.name ?? null,
      competitionId: f.competition_id,
      competitionNombre: f.competitions?.name ?? null,
      infraccion: f.motivo,
      partidosPendientes: f.partidos_pendientes,
      montoMulta: f.monto_multa,
      anuladaAt: f.anulada_at,
      anuladaMotivo: f.anulada_motivo,
      createdAt: f.created_at,
      cargo: cargosPorSuspension.get(f.id) ?? null,
      apelacion: apelacionPorSuspension.get(f.id) ?? null,
    };
  });
}

const SELECT_SANCION =
  "id, origen, sancionado_tipo, sancionado_nombre, player_id, team_id, club_id, competition_id, motivo, partidos_pendientes, monto_multa, treasury_charge_id, anulada_at, anulada_motivo, created_at, players(first_name, last_name), teams(name, club_id, clubs(name)), competitions(name)";

/** Carga cargos de tesorería vinculados + su último pago (estado para el club). */
async function cargarCargosMultas(
  supabase: Awaited<ReturnType<typeof createLfsServerClient>>,
  suspensionIds: string[]
): Promise<Map<string, CargoMulta>> {
  const mapa = new Map<string, CargoMulta>();
  if (!suspensionIds.length) return mapa;

  const { data: cargos } = await supabase
    .from("treasury_charges")
    .select("id, suspension_id, status, monto")
    .in("suspension_id", suspensionIds);

  const cargoIds = (cargos ?? []).map((c) => c.id);
  const { data: pagos } = cargoIds.length
    ? await supabase
        .from("treasury_payments")
        .select("charge_id, status, resuelto_at, created_at")
        .in("charge_id", cargoIds)
        .order("created_at", { ascending: false })
    : { data: [] as Array<{ charge_id: string; status: string; resuelto_at: string | null }> };

  const ultimoPagoPorCargo = new Map<string, PagoResumen>();
  for (const p of pagos ?? []) {
    if (!ultimoPagoPorCargo.has(p.charge_id)) {
      ultimoPagoPorCargo.set(p.charge_id, { status: p.status, resueltoAt: p.resuelto_at });
    }
  }

  for (const c of cargos ?? []) {
    if (!c.suspension_id) continue;
    mapa.set(c.suspension_id, {
      id: c.id,
      status: c.status as CargoMulta["status"],
      monto: Number(c.monto),
      ultimoPago: ultimoPagoPorCargo.get(c.id) ?? null,
    });
  }
  return mapa;
}

type FilaApelacion = {
  id: string;
  suspension_id: string;
  club_id: string;
  motivo: string;
  adjuntos: unknown;
  estado: string;
  resolucion: string | null;
  resuelto_at: string | null;
  created_at: string;
};

function armarApelacion(f: FilaApelacion): ApelacionFila {
  return {
    id: f.id,
    sancionId: f.suspension_id,
    estado: (f.estado as ApelacionFila["estado"]) ?? "pendiente",
    motivo: f.motivo,
    adjuntos: Array.isArray(f.adjuntos)
      ? (f.adjuntos as Array<{ path: string; nombre: string }>)
      : [],
    resolucion: f.resolucion,
    resueltoAt: f.resuelto_at,
    createdAt: f.created_at,
  };
}

// ---------- Consultas ----------

/** Panel completo del tribunal para la federación. */
export async function obtenerPanelTribunalAdmin(): Promise<PanelTribunal> {
  const { supabase } = await requerirAdmin();

  const [
    { data: sancionesRaw, error },
    { data: apelacionesRaw },
    { data: catalogoRaw },
    { data: clubesRaw },
    { data: competenciasRaw },
  ] = await Promise.all([
    supabase
      .from("player_suspensions")
      .select(SELECT_SANCION)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("sanction_appeals")
      .select("id, suspension_id, club_id, motivo, adjuntos, estado, resolucion, resuelto_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("infraction_catalog")
      .select("id, nombre, descripcion, aplica_a, fechas_default, multa_default, activo, orden")
      .order("orden"),
    supabase.from("clubs").select("id, name").order("name"),
    supabase.from("competitions").select("id, name").order("name"),
  ]);

  if (error) throw new Error("No se pudieron cargar las sanciones.");

  const filas = (sancionesRaw ?? []) as unknown as FilaSuspension[];
  const clubesPorId = new Map((clubesRaw ?? []).map((c) => [c.id, c.name]));

  const cargos = await cargarCargosMultas(
    supabase,
    filas.map((f) => f.id)
  );

  const apelaciones = (apelacionesRaw ?? []).map((a) => armarApelacion(a as FilaApelacion));
  const apelacionPorSuspension = new Map(apelaciones.map((a) => [a.sancionId, a]));

  return {
    sanciones: armarSanciones(filas, clubesPorId, cargos, apelacionPorSuspension),
    apelaciones,
    catalogo: (catalogoRaw ?? []).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descripcion: c.descripcion,
      aplicaA: c.aplica_a as InfraccionCatalogo["aplicaA"],
      fechasDefault: c.fechas_default,
      multaDefault: Number(c.multa_default),
      activo: c.activo,
      orden: c.orden,
    })),
    clubes: (clubesRaw ?? []).map((c) => ({ id: c.id, nombre: c.name })),
    competencias: (competenciasRaw ?? []).map((c) => ({ id: c.id, nombre: c.name })),
  };
}

/** Vista del CLUB: sus sanciones (jugadores, CT e institucionales) + multas + apelaciones. */
export async function obtenerTribunalClub(): Promise<{
  clubId: string;
  clubNombre: string;
  sanciones: SancionFila[];
  apelaciones: ApelacionFila[];
}> {
  const { supabase, user } = await obtenerUsuarioOError();

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id) throw new Error("Tu usuario no está vinculado a ningún club.");

  const clubId = profile.club_id as string;

  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  // Sanciones del club: institucionales (club_id) o de sus equipos (teams.club_id)
  const { data: sancionesRaw, error } = await supabase
    .from("player_suspensions")
    .select(SELECT_SANCION)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error("No se pudieron cargar las sanciones.");

  const filas = ((sancionesRaw ?? []) as unknown as FilaSuspension[]).filter(
    (f) => f.club_id === clubId || f.teams?.club_id === clubId
  );

  const clubesPorId = new Map([[clubId, club?.name ?? "Mi Club"]]);
  const cargos = await cargarCargosMultas(
    supabase,
    filas.map((f) => f.id)
  );

  const { data: apelacionesRaw } = await supabase
    .from("sanction_appeals")
    .select("id, suspension_id, club_id, motivo, adjuntos, estado, resolucion, resuelto_at, created_at")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });

  const apelaciones = (apelacionesRaw ?? []).map((a) => armarApelacion(a as FilaApelacion));
  const apelacionPorSuspension = new Map(apelaciones.map((a) => [a.sancionId, a]));

  return {
    clubId,
    clubNombre: club?.name ?? "Mi Club",
    sanciones: armarSanciones(filas, clubesPorId, cargos, apelacionPorSuspension),
    apelaciones,
  };
}

/** Ficha disciplinaria completa de un jugador (admin): tarjetas + sanciones + apelaciones. */
export async function obtenerFichaDisciplinaria(playerId: string): Promise<FichaDisciplinaria> {
  const { supabase } = await requerirAdmin();

  const { data: jugador, error } = await supabase
    .from("players")
    .select("id, first_name, last_name, dni")
    .eq("id", playerId)
    .single();
  if (error || !jugador) throw new Error("Jugador no encontrado.");

  // Club actual del jugador (última categoría asignada → equipo → club)
  const { data: categoria } = await supabase
    .from("player_categories")
    .select("clubs(name)")
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clubNombre =
    ((categoria as { clubs?: { name?: string } | null } | null)?.clubs?.name) ?? "Sin club";

  // Tarjetas de planillas (amarillas y rojas) con partido y rival
  const { data: eventosRaw } = await supabase
    .from("match_events")
    .select(
      "id, tipo, minuto, created_at, team_id, matches(matchday, scheduled_at, home_team_id, away_team_id, competitions(name))"
    )
    .eq("player_id", playerId)
    .in("tipo", ["amarilla", "roja"])
    .order("created_at", { ascending: false })
    .limit(100);

  // Necesitamos los nombres de ambos equipos de cada partido para el rival
  const eventos = (eventosRaw ?? []) as unknown as Array<{
    id: string;
    tipo: string;
    minuto: number | null;
    created_at: string;
    team_id: string;
    matches: {
      matchday: number | null;
      scheduled_at: string | null;
      home_team_id: string;
      away_team_id: string;
      competitions: { name: string } | null;
    } | null;
  }>;

  const teamIds = new Set<string>();
  for (const e of eventos) {
    if (e.matches) {
      teamIds.add(e.matches.home_team_id);
      teamIds.add(e.matches.away_team_id);
    }
  }
  const { data: equiposRaw } = teamIds.size
    ? await supabase.from("teams").select("id, name").in("id", [...teamIds])
    : { data: [] as Array<{ id: string; name: string }> };
  const nombreEquipo = new Map((equiposRaw ?? []).map((t) => [t.id, t.name]));

  const tarjetas: EventoTarjeta[] = eventos.map((e) => {
    const rivalId =
      e.matches && e.team_id === e.matches.home_team_id
        ? e.matches?.away_team_id
        : e.matches?.home_team_id;
    return {
      id: e.id,
      tipo: e.tipo as "amarilla" | "roja",
      minuto: e.minuto,
      fechaPartido: e.matches?.scheduled_at ?? null,
      rival: rivalId ? (nombreEquipo.get(rivalId) ?? "—") : "—",
      torneo: e.matches?.competitions?.name ?? "—",
    };
  });

  // Sanciones y apelaciones del jugador
  const { data: sancionesRaw } = await supabase
    .from("player_suspensions")
    .select(SELECT_SANCION)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false });

  const filas = (sancionesRaw ?? []) as unknown as FilaSuspension[];
  const clubIds = new Set(filas.map((f) => f.club_id ?? f.teams?.club_id).filter(Boolean) as string[]);
  const { data: clubesRaw } = clubIds.size
    ? await supabase.from("clubs").select("id, name").in("id", [...clubIds])
    : { data: [] as Array<{ id: string; name: string }> };
  const clubesPorId = new Map((clubesRaw ?? []).map((c) => [c.id, c.name]));

  const cargos = await cargarCargosMultas(
    supabase,
    filas.map((f) => f.id)
  );

  const { data: apelacionesRaw } = filas.length
    ? await supabase
        .from("sanction_appeals")
        .select("id, suspension_id, club_id, motivo, adjuntos, estado, resolucion, resuelto_at, created_at")
        .in("suspension_id", filas.map((f) => f.id))
    : { data: [] as FilaApelacion[] };

  const apelaciones = (apelacionesRaw ?? []).map((a) => armarApelacion(a as FilaApelacion));
  const apelacionPorSuspension = new Map(apelaciones.map((a) => [a.sancionId, a]));

  return {
    jugador: {
      id: jugador.id,
      nombre: `${jugador.first_name} ${jugador.last_name}`,
      dni: jugador.dni,
    },
    clubNombre,
    tarjetas,
    sanciones: armarSanciones(filas, clubesPorId, cargos, apelacionPorSuspension),
    apelaciones,
  };
}

// ---------- Mutaciones (admin) ----------

/** Sanción MANUAL: jugador, cuerpo técnico o club. Multa opcional → cargo en tesorería. */
export async function crearSancionManual(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const input = {
    sancionadoTipo: String(formData.get("sancionadoTipo") ?? "jugador") as TipoSancionado,
    playerId: (formData.get("playerId") as string | null) || null,
    nombreLibre: String(formData.get("nombreLibre") ?? "").trim(),
    clubId: String(formData.get("clubId") ?? ""),
    infraccion: String(formData.get("infraccion") ?? "").trim(),
    fechas: Number(formData.get("fechas") ?? 0),
    montoMulta: Number(formData.get("montoMulta") ?? 0),
  };
  const competitionId = (formData.get("competitionId") as string | null) || null;

  const valido = validarSancionManual(input);
  if (!valido.ok) return { error: valido.error };

  // Nombre del sancionado (jugador → desde su ficha; CT → texto libre; club → nombre del club)
  let sancionadoNombre: string | null = null;
  if (input.sancionadoTipo === "jugador" && input.playerId) {
    const { data: jugador } = await supabase
      .from("players")
      .select("first_name, last_name")
      .eq("id", input.playerId)
      .single();
    if (!jugador) return { error: "El jugador elegido no existe." };
    sancionadoNombre = `${jugador.first_name} ${jugador.last_name}`;
  } else if (input.sancionadoTipo === "cuerpo_tecnico") {
    sancionadoNombre = input.nombreLibre;
  }

  const { data: sancion, error } = await supabase
    .from("player_suspensions")
    .insert({
      player_id: input.sancionadoTipo === "jugador" ? input.playerId : null,
      team_id: null,
      competition_id: competitionId,
      club_id: input.clubId,
      motivo: input.infraccion,
      partidos_pendientes: input.fechas,
      origen: "manual",
      sancionado_tipo: input.sancionadoTipo,
      sancionado_nombre: sancionadoNombre,
      monto_multa: input.montoMulta > 0 ? input.montoMulta : null,
    })
    .select("id")
    .single();

  if (error || !sancion) return { error: "No se pudo cargar la sanción." };

  // Multa → cargo automático en tesorería (vinculado a la sanción)
  if (input.montoMulta > 0) {
    const { data: cargo, error: errorCargo } = await supabase
      .from("treasury_charges")
      .insert({
        club_id: input.clubId,
        competition_id: competitionId,
        tipo: "multa_tribunal",
        descripcion: `Multa del tribunal: ${input.infraccion} — ${sancionadoNombre ?? "sanción institucional"}`,
        monto: input.montoMulta,
        creado_por: user.id,
        suspension_id: sancion.id,
      })
      .select("id")
      .single();

    if (errorCargo) {
      await supabase.from("player_suspensions").delete().eq("id", sancion.id);
      return { error: "No se pudo generar la multa en tesorería. No se cargó nada." };
    }
    await supabase
      .from("player_suspensions")
      .update({ treasury_charge_id: cargo.id })
      .eq("id", sancion.id);
  }

  await auditar(supabase, user.id, "sancion_manual_creada", null, { ...input, sancionId: sancion.id });
  revalidarTribunal();
  return { ok: true };
}

/** Modificar una sanción existente (fechas y/o motivo). Queda en auditoría. */
export async function modificarSancion(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const id = String(formData.get("id") ?? "");
  const fechas = Number(formData.get("fechas") ?? -1);
  const infraccion = String(formData.get("infraccion") ?? "").trim();

  const valido = validarModificacionSancion({ fechas, infraccion });
  if (!valido.ok) return { error: valido.error };

  const { data: anterior } = await supabase
    .from("player_suspensions")
    .select("partidos_pendientes, motivo")
    .eq("id", id)
    .single();
  if (!anterior) return { error: "La sanción no existe." };

  const { error } = await supabase
    .from("player_suspensions")
    .update({ partidos_pendientes: fechas, motivo: infraccion })
    .eq("id", id);

  if (error) return { error: "No se pudo modificar la sanción." };

  await auditar(supabase, user.id, "sancion_modificada", anterior, {
    id,
    partidos_pendientes: fechas,
    motivo: infraccion,
  });
  revalidarTribunal();
  return { ok: true };
}

/** Anular una sanción (con motivo). Si tenía multa pendiente, también se anula. */
export async function anularSancion(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const id = String(formData.get("id") ?? "");
  const motivo = String(formData.get("motivo") ?? "");

  const valido = validarAnulacion(motivo);
  if (!valido.ok) return { error: valido.error };

  const { data: anterior } = await supabase
    .from("player_suspensions")
    .select("id, motivo, partidos_pendientes, anulada_at, treasury_charge_id")
    .eq("id", id)
    .single();
  if (!anterior) return { error: "La sanción no existe." };
  if (anterior.anulada_at) return { error: "La sanción ya estaba anulada." };

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("player_suspensions")
    .update({
      anulada_at: ahora,
      anulada_motivo: motivo.trim(),
      anulada_por: user.id,
      partidos_pendientes: 0,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo anular la sanción." };

  // Anular el cargo de tesorería vinculado (nunca se borra: queda "anulado")
  if (anterior.treasury_charge_id) {
    await supabase
      .from("treasury_charges")
      .update({
        status: "anulado",
        anulado_motivo: `Sanción anulada: ${motivo.trim()}`,
        anulado_por: user.id,
        anulado_at: ahora,
      })
      .eq("id", anterior.treasury_charge_id)
      .in("status", ["pendiente", "parcial"]);
  }

  await auditar(supabase, user.id, "sancion_anulada", anterior, { id, motivo: motivo.trim() });
  revalidarTribunal();
  return { ok: true };
}

/** Resolver una apelación. Si se acepta: la sanción se anula (y su multa). */
export async function resolverApelacion(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const apelacionId = String(formData.get("apelacionId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const resolucion = String(formData.get("resolucion") ?? "");

  if (decision !== "aceptada" && decision !== "rechazada") {
    return { error: "Decisión inválida." };
  }
  const valido = validarResolucionApelacion(resolucion);
  if (!valido.ok) return { error: valido.error };

  const { data: apelacion } = await supabase
    .from("sanction_appeals")
    .select("id, suspension_id, estado")
    .eq("id", apelacionId)
    .single();
  if (!apelacion) return { error: "La apelación no existe." };
  if (apelacion.estado !== "pendiente") return { error: "Esta apelación ya fue resuelta." };

  const ahora = new Date().toISOString();
  const { error } = await supabase
    .from("sanction_appeals")
    .update({
      estado: decision,
      resolucion: resolucion.trim(),
      resuelto_por: user.id,
      resuelto_at: ahora,
    })
    .eq("id", apelacionId);
  if (error) return { error: "No se pudo guardar el fallo." };

  // Apelación aceptada → la sanción queda anulada (y su multa pendiente también)
  if (decision === "aceptada") {
    const fd = new FormData();
    fd.set("id", apelacion.suspension_id);
    fd.set("motivo", `Apelación aceptada: ${resolucion.trim()}`);
    await anularSancion(fd);
  }

  await auditar(supabase, user.id, "apelacion_resuelta", apelacion, {
    apelacionId,
    decision,
    resolucion: resolucion.trim(),
  });
  revalidarTribunal();
  return { ok: true };
}

// ---------- Catálogo de infracciones (admin) ----------

export async function guardarInfraccionCatalogo(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const id = (formData.get("id") as string | null) || null;
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim() || null;
  const aplicaA = String(formData.get("aplicaA") ?? "jugador");
  const fechasDefault = Number(formData.get("fechasDefault") ?? 0);
  const multaDefault = Number(formData.get("multaDefault") ?? 0);

  if (nombre.length < 3) return { error: "El nombre de la infracción es muy corto." };
  if (!["jugador", "cuerpo_tecnico", "club", "todos"].includes(aplicaA)) {
    return { error: "Tipo de destinatario inválido." };
  }
  if (!Number.isInteger(fechasDefault) || fechasDefault < 0 || fechasDefault > 30) {
    return { error: "Las fechas por defecto deben ser un número entre 0 y 30." };
  }
  if (multaDefault < 0) return { error: "La multa por defecto no puede ser negativa." };

  const datos = {
    nombre,
    descripcion,
    aplica_a: aplicaA,
    fechas_default: fechasDefault,
    multa_default: multaDefault,
  };

  const { error } = id
    ? await supabase.from("infraction_catalog").update(datos).eq("id", id)
    : await supabase.from("infraction_catalog").insert(datos);

  if (error) return { error: "No se pudo guardar la infracción (¿nombre repetido?)." };

  await auditar(supabase, user.id, id ? "catalogo_infraccion_editada" : "catalogo_infraccion_creada", null, datos);
  revalidarTribunal();
  return { ok: true };
}

export async function alternarInfraccionCatalogo(id: string, activo: boolean) {
  const { supabase, user } = await requerirAdmin();
  const { error } = await supabase
    .from("infraction_catalog")
    .update({ activo })
    .eq("id", id);
  if (error) return { error: "No se pudo actualizar la infracción." };
  await auditar(supabase, user.id, "catalogo_infraccion_estado", null, { id, activo });
  revalidarTribunal();
  return { ok: true };
}

// ---------- Apelación del club ----------

const TIPOS_PRUEBA = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_PRUEBAS = 3;
const TAMANO_MAX_PRUEBA = 10 * 1024 * 1024;

/** El club apela una sanción (72 hs, con motivo y hasta 3 pruebas adjuntas). */
export async function apelarSancion(formData: FormData) {
  const { supabase, user } = await obtenerUsuarioOError();

  const suspensionId = String(formData.get("suspensionId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");

  const motivoValido = validarMotivoApelacion(motivo);
  if (!motivoValido.ok) return { error: motivoValido.error };

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id) return { error: "Tu usuario no está vinculado a ningún club." };
  const clubId = profile.club_id as string;

  // La sanción tiene que ser del club (institucional o de uno de sus equipos)
  const { data: sancion } = await supabase
    .from("player_suspensions")
    .select("id, club_id, created_at, anulada_at, teams(club_id)")
    .eq("id", suspensionId)
    .single();
  if (!sancion) return { error: "La sanción no existe." };

  const clubDeLaSancion =
    sancion.club_id ??
    ((sancion.teams as { club_id?: string } | null)?.club_id ?? null);
  if (clubDeLaSancion !== clubId) {
    return { error: "Esta sanción no pertenece a tu club." };
  }

  // ¿Ya apeló?
  const { data: previa } = await supabase
    .from("sanction_appeals")
    .select("id")
    .eq("suspension_id", suspensionId)
    .maybeSingle();

  const habilitado = puedeApelar({
    creadaAtIso: sancion.created_at,
    yaApelo: !!previa,
    anulada: !!sancion.anulada_at,
  });
  if (!habilitado.ok) return { error: habilitado.motivo };

  // Pruebas (opcional, hasta 3): bucket mensajeria-adjuntos, carpeta del club
  const archivos = formData.getAll("pruebas").filter((a): a is File => a instanceof File && a.size > 0);
  if (archivos.length > MAX_PRUEBAS) {
    return { error: `Podés adjuntar hasta ${MAX_PRUEBAS} pruebas.` };
  }

  const adjuntos: Array<{ path: string; nombre: string }> = [];
  for (const archivo of archivos) {
    if (!TIPOS_PRUEBA.includes(archivo.type)) {
      return { error: "Las pruebas solo pueden ser fotos (JPG, PNG, WebP) o PDF." };
    }
    if (archivo.size > TAMANO_MAX_PRUEBA) {
      return { error: "Cada prueba puede pesar hasta 10 MB." };
    }
    const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clubId}/apelaciones/${crypto.randomUUID()}-${nombreSeguro}`;
    const { error: errorSubida } = await supabase.storage
      .from("mensajeria-adjuntos")
      .upload(path, archivo, { contentType: archivo.type });
    if (errorSubida) return { error: "No se pudo subir una de las pruebas. Intentá de nuevo." };
    adjuntos.push({ path, nombre: archivo.name });
  }

  const { error } = await supabase.from("sanction_appeals").insert({
    suspension_id: suspensionId,
    club_id: clubId,
    motivo: motivo.trim(),
    adjuntos,
  });
  if (error) return { error: "No se pudo presentar la apelación." };

  revalidarTribunal();
  return { ok: true };
}
