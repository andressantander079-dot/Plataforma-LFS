"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  aprobarRevisionPase,
  decidirPaseOrigen,
  regenerarLinkFirma,
  completarPase,
} from "@/lib/actions/pases.actions";
import {
  validarReglasMercado,
  ultimaActividadPase,
  estaTrabado,
  tabDelPase,
  accionPrincipalAdmin,
  calcularCargoPrevisto,
  armarChecklist,
  timelineDePase,
  type RecargoModo,
  type FeeRegla,
  type TabBandeja,
  type AccionPrincipal,
  type ItemChecklist,
  type EventoTimelinePase,
} from "@/lib/core/rules/tramitesRules";
import type { EstadoPase } from "@/lib/core/rules/pasesRules";
import { esEstadoTerminal } from "@/lib/core/rules/pasesRules";

/**
 * TRÁMITES — Acciones de servidor (Paso 15)
 * Configuración unificada del mercado (pase_settings como fuente única),
 * bandeja con KPIs y pestañas, detalle del pase con checklist + cargo
 * previsto + timeline, y herramientas para pases trabados
 * (recordar / destrabar / cancelar) con auditoría y avisos por mensajería.
 */

// ---------- Tipos ----------

export interface SettingsMercado {
  tenencia_anios: number;
  recargo_modo: RecargoModo;
  recargo_valor: number;
  alerta_trabado_horas: number;
  cancelacion_trabado_horas: number;
  aviso_retorno_horas: number;
  cupo_plantel: number;
  firma_obligatoria: boolean;
}

export interface VentanaUI {
  id: string;
  nombre: string;
  fechaDesde: string;
  fechaHasta: string;
}

export interface CategoriaMercadoUI {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

export interface FeeMercadoUI {
  id: string;
  category_id: string;
  competition_id: string | null;
  tipo: "definitivo" | "prestamo";
  monto: number;
  categoriaNombre: string;
  torneoNombre: string | null;
}

export interface ConfigMercado {
  settings: SettingsMercado;
  ventanas: VentanaUI[];
  categorias: CategoriaMercadoUI[];
  fees: FeeMercadoUI[];
  torneos: Array<{ id: string; nombre: string }>;
}

export interface FilaBandeja {
  id: string;
  jugador: string;
  dni: string;
  origen: string;
  destino: string;
  estado: EstadoPase;
  tipoPase: string;
  numeroPase: string | null;
  createdAt: string;
  ultimaActividad: string;
  trabado: boolean;
  tab: TabBandeja;
}

export interface Bandeja {
  filas: FilaBandeja[];
  kpis: {
    pendientesLiga: number;
    trabados: number;
    esperandoFirma: number;
    efectivosAnio: number;
  };
  horasAlerta: number;
}

export interface CargoRealUI {
  id: string;
  tipo: string;
  descripcion: string;
  monto: number;
  status: string;
}

export interface DetallePase {
  pase: Record<string, unknown>;
  jugadorNombre: string;
  jugadorDni: string;
  origen: string;
  destino: string;
  estado: EstadoPase;
  trabado: boolean;
  ultimaActividad: string;
  accion: AccionPrincipal;
  checklist: ItemChecklist[];
  cargoPrevisto: { monto: number; origen: "torneo" | "general" | null };
  cargosReales: CargoRealUI[];
  timeline: EventoTimelinePase[];
  documentos: Array<{ id: string; nombre: string; path: string; created_at: string }>;
  historial: Array<{
    id: string;
    status: string;
    numero_pase: string | null;
    created_at: string;
    origen: string;
    destino: string;
  }>;
}

// ---------- Helpers ----------

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
    module: "pases",
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });
}

/** El embed players(...) llega tipado como array; en la práctica es 1 objeto. */
type PlayersEmbed = { first_name: string; last_name: string; dni: string }[] | null;

function jugadorObj(players: unknown): { first_name: string; last_name: string; dni: string } | null {
  const v = players as PlayersEmbed | { first_name: string; last_name: string; dni: string } | null;
  if (Array.isArray(v)) return v.length > 0 ? v[0] : null;
  if (v && typeof v === "object" && "first_name" in v) return v;
  return null;
}

function jugadorApellidoNombre(players: unknown): string {
  const j = jugadorObj(players);
  return j ? `${j.last_name}, ${j.first_name}` : "—";
}

function jugadorDni(players: unknown): string {
  return jugadorObj(players)?.dni ?? "—";
}

function jugadorNombrePila(players: unknown): string {
  const j = jugadorObj(players);
  return j ? `${j.first_name} ${j.last_name}` : "el jugador";
}

/** Aviso interno al club por mensajería (mismo mecanismo que los avisos de pases). */
async function avisarClub(clubId: string | null, texto: string, senderId: string) {
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
    // El aviso es un plus: nunca corta el trámite
  }
}

function revalidarTramites() {
  revalidatePath("/admin/tramites");
  revalidatePath("/admin/tramites/configuracion");
  revalidatePath("/admin/configuracion");
  revalidatePath("/club/tramites");
}

function mapearSettings(row: Record<string, unknown>): SettingsMercado {
  return {
    tenencia_anios: Number(row.tenencia_anios ?? 1),
    recargo_modo: (row.recargo_modo as RecargoModo) ?? "fijo",
    recargo_valor: Number(row.recargo_rescision ?? 0),
    alerta_trabado_horas: Number(row.alerta_trabado_horas ?? 48),
    cancelacion_trabado_horas: Number(row.cancelacion_trabado_horas ?? 72),
    aviso_retorno_horas: Number(row.aviso_retorno_horas ?? 72),
    cupo_plantel: Number(row.cupo_plantel ?? 25),
    firma_obligatoria: row.firma_obligatoria !== false,
  };
}

// ---------- Configuración unificada del mercado ----------

export async function obtenerConfigMercado(): Promise<ConfigMercado> {
  const { supabase } = await requerirAdmin();

  const [{ data: settings }, { data: ventanas }, { data: categorias }, { data: fees }, { data: torneos }] =
    await Promise.all([
      supabase.from("pase_settings").select("*").eq("id", 1).single(),
      supabase
        .from("transfer_windows")
        .select("id, nombre, fecha_desde, fecha_hasta")
        .order("fecha_desde", { ascending: false }),
      supabase
        .from("categories")
        .select("id, name, level_hierarchy, anio_desde, anio_hasta")
        .order("level_hierarchy"),
      supabase
        .from("transfer_fees")
        .select("id, category_id, competition_id, tipo, monto, categories(name), competitions(name)"),
      supabase.from("competitions").select("id, name").order("name"),
    ]);

  return {
    settings: mapearSettings((settings ?? {}) as Record<string, unknown>),
    ventanas: (ventanas ?? []).map((v) => ({
      id: v.id,
      nombre: v.nombre,
      fechaDesde: v.fecha_desde,
      fechaHasta: v.fecha_hasta,
    })),
    categorias: (categorias ?? []) as CategoriaMercadoUI[],
    fees: (fees ?? []).map((f) => ({
      id: f.id,
      category_id: f.category_id,
      competition_id: f.competition_id,
      tipo: f.tipo as "definitivo" | "prestamo",
      monto: Number(f.monto),
      categoriaNombre: (f.categories as unknown as { name: string } | null)?.name ?? "—",
      torneoNombre: (f.competitions as unknown as { name: string } | null)?.name ?? null,
    })),
    torneos: (torneos ?? []).map((t) => ({ id: t.id, nombre: t.name })),
  };
}

/** Guarda las reglas del mercado (única puerta de edición: Configuración LFS). */
export async function guardarReglasMercado(formData: FormData) {
  const { supabase, user } = await requerirAdmin();

  const input = {
    tenencia_anios: Number(formData.get("tenencia_anios") ?? 0),
    recargo_modo: String(formData.get("recargo_modo") ?? "fijo") as RecargoModo,
    recargo_valor: Number(formData.get("recargo_valor") ?? 0),
    alerta_trabado_horas: Number(formData.get("alerta_trabado_horas") ?? 48),
    cancelacion_trabado_horas: Number(formData.get("cancelacion_trabado_horas") ?? 72),
    aviso_retorno_horas: Number(formData.get("aviso_retorno_horas") ?? 72),
    cupo_plantel: Number(formData.get("cupo_plantel") ?? 25),
    firma_obligatoria: formData.get("firma_obligatoria") === "on",
  };

  const valido = validarReglasMercado(input);
  if (!valido.ok) return { error: valido.error };

  const { data: anterior } = await supabase
    .from("pase_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const { error } = await supabase
    .from("pase_settings")
    .update({
      tenencia_anios: input.tenencia_anios,
      recargo_modo: input.recargo_modo,
      recargo_rescision: input.recargo_valor,
      alerta_trabado_horas: input.alerta_trabado_horas,
      cancelacion_trabado_horas: input.cancelacion_trabado_horas,
      aviso_retorno_horas: input.aviso_retorno_horas,
      cupo_plantel: input.cupo_plantel,
      firma_obligatoria: input.firma_obligatoria,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: "No se pudo guardar la configuración." };

  await auditar(supabase, user.id, "mercado_reglas_actualizadas", anterior, input);
  revalidarTramites();
  return { ok: true };
}

// ---------- Bandeja de trámites ----------

export async function obtenerBandejaTramites(): Promise<Bandeja> {
  const { supabase, user } = await requerirAdmin();

  const [{ data: pases }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("transfers")
      .select(
        "id, status, tipo_pase, numero_pase, from_club_id, to_club_id, created_at, approved_at, metadata, players(first_name, last_name, dni), from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
      )
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("pase_settings").select("alerta_trabado_horas").eq("id", 1).single(),
  ]);

  const horasAlerta = Number(settingsRow?.alerta_trabado_horas ?? 48);
  const admin = createLfsAdminClient();

  const filas: FilaBandeja[] = [];
  for (const p of pases ?? []) {
    const estado = p.status as EstadoPase;
    const ultima = ultimaActividadPase({
      created_at: p.created_at,
      approved_at: p.approved_at,
      metadata: p.metadata as Record<string, unknown>,
    });
    const trabado = estaTrabado(estado, ultima, horasAlerta);
    filas.push({
      id: p.id,
      jugador: jugadorApellidoNombre(p.players),
      dni: jugadorDni(p.players),
      origen: (p.from as unknown as { name: string } | null)?.name ?? "Jugador libre",
      destino: (p.to as unknown as { name: string } | null)?.name ?? "—",
      estado,
      tipoPase: p.tipo_pase ?? "definitivo",
      numeroPase: p.numero_pase,
      createdAt: p.created_at,
      ultimaActividad: ultima,
      trabado,
      tab: tabDelPase(estado, ultima, horasAlerta),
    });

    // Aviso automático UNA sola vez cuando se detecta trabado
    const meta = (p.metadata ?? {}) as Record<string, unknown>;
    if (trabado && !meta.trabado_notificado_at) {
      const jugador = jugadorNombrePila(p.players);
      const texto = `⚠️ El pase de ${jugador} está TRABADO (superó las ${horasAlerta} hs de espera). La federación ya está al tanto; si te toca decidir, entrá a Trámites.`;
      await avisarClub(p.to_club_id, texto, user.id);
      await avisarClub(p.from_club_id, texto, user.id);
      await admin
        .from("transfers")
        .update({ metadata: { ...meta, trabado_notificado_at: new Date().toISOString() } })
        .eq("id", p.id);
    }
  }

  const anio = new Date().getFullYear();
  return {
    filas,
    kpis: {
      pendientesLiga: filas.filter((f) => f.tab === "pendientes").length,
      trabados: filas.filter((f) => f.tab === "trabados").length,
      esperandoFirma: filas.filter((f) => f.estado === "5_PLAYER_SIGNATURE").length,
      efectivosAnio: filas.filter(
        (f) => f.estado === "7_COMPLETED" && new Date(f.createdAt).getFullYear() === anio
      ).length,
    },
    horasAlerta,
  };
}

// ---------- Detalle del pase (admin) ----------

export async function obtenerDetallePaseAdmin(transferId: string): Promise<DetallePase> {
  const { supabase } = await requerirAdmin();

  const { data: pase } = await supabase
    .from("transfers")
    .select(
      "*, players(first_name, last_name, dni), from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
    )
    .eq("id", transferId)
    .single();
  if (!pase) throw new Error("El pase no existe.");

  const estado = pase.status as EstadoPase;
  const meta = (pase.metadata ?? {}) as Record<string, unknown>;

  const [
    { data: documentos },
    { data: historialRaw },
    { data: settingsRow },
    { data: fees },
    { data: catsJugador },
    { data: cargos },
    { data: ventanaAbierta },
  ] = await Promise.all([
    supabase
      .from("transfer_documents")
      .select("id, nombre, path, created_at")
      .eq("transfer_id", transferId)
      .order("created_at"),
    supabase
      .from("transfers")
      .select(
        "id, status, numero_pase, created_at, from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
      )
      .eq("player_id", pase.player_id)
      .neq("id", transferId)
      .order("created_at", { ascending: false }),
    supabase.from("pase_settings").select("*").eq("id", 1).single(),
    supabase.from("transfer_fees").select("category_id, competition_id, tipo, monto"),
    supabase
      .from("player_categories")
      .select("category_id, categories(level_hierarchy)")
      .eq("player_id", pase.player_id),
    supabase
      .from("treasury_charges")
      .select("id, tipo, descripcion, monto, status")
      .eq("transfer_id", transferId),
    supabase.rpc("hay_ventana_pases"),
  ]);

  const settings = mapearSettings((settingsRow ?? {}) as Record<string, unknown>);

  // Categoría base del jugador (la de menor jerarquía) para el cargo previsto
  const categoriaBase = (catsJugador ?? [])
    .map((f) => ({
      category_id: f.category_id as string,
      nivel: (f.categories as unknown as { level_hierarchy: number } | null)?.level_hierarchy ?? 999,
    }))
    .sort((a, b) => a.nivel - b.nivel)[0];

  const cargoPrevisto = calcularCargoPrevisto({
    fees: (fees ?? []) as FeeRegla[],
    categoriaBaseId: categoriaBase?.category_id ?? null,
    competitionId: pase.competition_id,
    tipoPase: pase.tipo_pase ?? "definitivo",
  });

  // Cupo actual del plantel destino
  let jugadoresActuales = 0;
  if (pase.to_club_id) {
    const { data: plantel } = await supabase
      .from("player_categories")
      .select("player_id")
      .eq("club_id", pase.to_club_id);
    jugadoresActuales = new Set((plantel ?? []).map((f) => f.player_id)).size;
  }

  const ultima = ultimaActividadPase({
    created_at: pase.created_at,
    approved_at: pase.approved_at,
    metadata: meta,
  });
  const trabado = estaTrabado(estado, ultima, settings.alerta_trabado_horas);

  const checklist = armarChecklist({
    tieneDocumentos: (documentos ?? []).length > 0,
    ventanaAbierta: !!ventanaAbierta,
    tieneDeudaBloqueante: pase.deuda_modo === "bloqueante" && Number(pase.deuda_monto ?? 0) > 0,
    deudaSaldada: !!pase.deuda_saldada || !!meta.deuda_saldada_at,
    firmaObligatoria: settings.firma_obligatoria,
    firmado: !!meta.firmado_at || estado === "6_FINAL_AUDIT" || estado === "7_COMPLETED",
    cupoPlantel: settings.cupo_plantel,
    jugadoresActuales,
  });

  return {
    pase: pase as unknown as Record<string, unknown>,
    jugadorNombre: pase.players ? `${pase.players.last_name}, ${pase.players.first_name}` : "—",
    jugadorDni: pase.players?.dni ?? "—",
    origen: (pase.from as unknown as { name: string } | null)?.name ?? "Jugador libre",
    destino: (pase.to as unknown as { name: string } | null)?.name ?? "—",
    estado,
    trabado,
    ultimaActividad: ultima,
    accion: accionPrincipalAdmin(estado, trabado),
    checklist,
    cargoPrevisto,
    cargosReales: (cargos ?? []).map((c) => ({
      id: c.id,
      tipo: c.tipo,
      descripcion: c.descripcion,
      monto: Number(c.monto),
      status: c.status,
    })),
    timeline: timelineDePase({
      created_at: pase.created_at,
      approved_at: pase.approved_at,
      metadata: meta,
    }),
    documentos: (documentos ?? []) as DetallePase["documentos"],
    historial: (historialRaw ?? []).map((h) => ({
      id: h.id,
      status: h.status,
      numero_pase: h.numero_pase,
      created_at: h.created_at,
      origen: (h.from as unknown as { name: string } | null)?.name ?? "Jugador libre",
      destino: (h.to as unknown as { name: string } | null)?.name ?? "—",
    })),
  };
}

// ---------- Herramientas de pases trabados ----------

/** Le manda un recordatorio interno al responsable actual del pase. */
export async function recordarPase(transferId: string) {
  const { supabase, user } = await requerirAdmin();

  const { data: pase } = await supabase
    .from("transfers")
    .select("id, status, from_club_id, to_club_id, metadata, players(first_name, last_name)")
    .eq("id", transferId)
    .single();
  if (!pase) return { error: "El pase no existe." };
  if (esEstadoTerminal(pase.status)) return { error: "Este trámite ya terminó." };

  const jugador = jugadorNombrePila(pase.players);
  const meta = (pase.metadata ?? {}) as Record<string, unknown>;

  let destinoClub: string | null = null;
  let texto = "";
  switch (pase.status as EstadoPase) {
    case "4_CLUB_B_DECISION":
      destinoClub = pase.from_club_id;
      texto = `⏰ Recordatorio de la federación: el pase de ${jugador} espera el DICTAMEN de tu club. Entrá a Trámites y aprobá o rechazá con motivo.`;
      break;
    case "5_PLAYER_SIGNATURE":
      destinoClub = pase.to_club_id;
      texto = `⏰ Recordatorio de la federación: el pase de ${jugador} espera la FIRMA del jugador. Compartile el link de firma desde Trámites (dura 72 hs).`;
      break;
    default:
      // Turno de la liga: se notifica a ambos para que sepan que está en revisión
      texto = `⏰ El pase de ${jugador} está en revisión de la federación. Les avisamos apenas avance.`;
      await avisarClub(pase.from_club_id, texto, user.id);
      await avisarClub(pase.to_club_id, texto, user.id);
  }
  if (destinoClub) await avisarClub(destinoClub, texto, user.id);

  await supabase
    .from("transfers")
    .update({ metadata: { ...meta, recordatorio_at: new Date().toISOString() } })
    .eq("id", transferId);

  await auditar(supabase, user.id, "pase_recordatorio", null, { transferId, estado: pase.status });
  revalidarTramites();
  revalidatePath(`/admin/tramites/pases/${transferId}`);
  return { ok: true };
}

/**
 * Destrabar: la federación fuerza el avance del pase según donde esté.
 *  - Revisión de la liga → aprueba la revisión.
 *  - Dictamen del club origen → la liga dictamina A FAVOR en su nombre (auditado).
 *  - Firma del jugador → regenera el link de firma.
 *  - Auditoría final → completa el pase.
 */
export async function destrabarPase(transferId: string) {
  const { supabase, user } = await requerirAdmin();

  const { data: pase } = await supabase
    .from("transfers")
    .select("id, status")
    .eq("id", transferId)
    .single();
  if (!pase) return { error: "El pase no existe." };

  let res: { ok?: boolean; error?: string };
  switch (pase.status as EstadoPase) {
    case "1_INIT_CLUB_A":
    case "2_FVF_REVIEW":
      res = await aprobarRevisionPase(transferId);
      break;
    case "4_CLUB_B_DECISION":
      res = await decidirPaseOrigen(transferId, true);
      break;
    case "5_PLAYER_SIGNATURE":
      res = await regenerarLinkFirma(transferId);
      break;
    case "6_FINAL_AUDIT":
      res = await completarPase(transferId);
      break;
    default:
      return { error: "Este trámite ya terminó, no hay nada que destrabar." };
  }
  if (res?.error) return { error: res.error };

  await auditar(supabase, user.id, "pase_destrabado", { estado: pase.status }, { transferId });
  revalidarTramites();
  revalidatePath(`/admin/tramites/pases/${transferId}`);
  return { ok: true };
}

/** Cancela el trámite desde cualquier estado no terminal, con motivo y aviso a ambos clubes. */
export async function cancelarPaseAdmin(transferId: string, motivo: string) {
  const { supabase, user } = await requerirAdmin();

  if (motivo.trim().length < 5) {
    return { error: "Contá el motivo de la cancelación (mínimo 5 caracteres)." };
  }

  const { data: pase } = await supabase
    .from("transfers")
    .select("id, status, from_club_id, to_club_id, metadata, players(first_name, last_name)")
    .eq("id", transferId)
    .single();
  if (!pase) return { error: "El pase no existe." };
  if (esEstadoTerminal(pase.status)) return { error: "Este trámite ya terminó." };

  const meta = (pase.metadata ?? {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("transfers")
    .update({
      status: "9_CANCELADO",
      metadata: {
        ...meta,
        cancelado_at: new Date().toISOString(),
        cancelado_por: "liga",
        cancelado_motivo: motivo.trim(),
      },
    })
    .eq("id", transferId);
  if (error) return { error: "No se pudo cancelar el trámite." };

  const jugador = jugadorNombrePila(pase.players);
  const texto = `🛑 La federación CANCELÓ el trámite del pase de ${jugador}. Motivo: ${motivo.trim()}`;
  await avisarClub(pase.from_club_id, texto, user.id);
  await avisarClub(pase.to_club_id, texto, user.id);

  await auditar(supabase, user.id, "pase_cancelado", { estado: pase.status }, { transferId, motivo: motivo.trim() });
  revalidarTramites();
  revalidatePath(`/admin/tramites/pases/${transferId}`);
  return { ok: true };
}
