"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  estadoCargo,
  TIPOS_CARGO_MANUALES,
  CATEGORIAS_GASTO,
} from "@/lib/core/tesoreria/money";

/**
 * TESORERÍA LFS — Acciones de servidor (Paso 8A)
 *
 * Reglas de oro:
 *  · NADA se borra: las correcciones son anulaciones con motivo (solo admin).
 *  · El tesorero opera todo lo operativo; el admin configura montos y anula.
 *  · Los pagos nacen "pendiente" (el club sube el comprobante) y recién
 *    al aprobarse se emite el recibo numerado por año (2026-0001…).
 *  · Las multas (roja / W.O. / acumulación) son automáticas y usan el
 *    cliente service_role porque nacen de acciones del árbitro.
 */

type SupabaseLfs = Awaited<ReturnType<typeof createLfsServerClient>>;

async function requireTesoreria() {
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
  if (profile?.role !== "admin" && profile?.role !== "tesorero") {
    throw new Error("Solo la tesorería de la liga puede hacer esto.");
  }
  return { supabase, user, role: profile.role as "admin" | "tesorero" };
}

async function requireAdminTesoreria() {
  const ctx = await requireTesoreria();
  if (ctx.role !== "admin") {
    throw new Error("Solo el administrador puede hacer esto.");
  }
  return ctx;
}

function revalidarTesoreria() {
  revalidatePath("/admin/tesoreria");
  revalidatePath("/admin/tesoreria/movimientos");
  revalidatePath("/admin/tesoreria/configuracion");
  revalidatePath("/admin/tesoreria/gastos");
  revalidatePath("/admin/tesoreria/reportes");
  revalidatePath("/club/finanzas");
  revalidatePath("/club/dashboard");
}

async function obtenerSettings(supabase: SupabaseLfs) {
  const { data } = await supabase
    .from("treasury_settings")
    .select("*")
    .eq("id", 1)
    .single();
  return data;
}

/** ¿El mes de esa fecha está cerrado? (los meses cerrados son intocables) */
async function mesCerrado(supabase: SupabaseLfs, fecha: Date): Promise<boolean> {
  const { data } = await supabase
    .from("treasury_cierres")
    .select("anio, mes, reabierto_at")
    .eq("anio", fecha.getFullYear())
    .eq("mes", fecha.getMonth() + 1)
    .maybeSingle();
  return !!data && !data.reabierto_at;
}

// ============================================================================
// CONFIGURACIÓN (solo admin)
// ============================================================================

export async function guardarConfiguracionTesoreria(formData: FormData) {
  const { supabase, user } = await requireAdminTesoreria();

  const num = (k: string) => {
    const n = Number(formData.get(k));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  const { error } = await supabase
    .from("treasury_settings")
    .update({
      fine_red: num("fine_red"),
      fine_wo: num("fine_wo"),
      fine_yellow_accum: num("fine_yellow_accum"),
      late_fee_percent: num("late_fee_percent"),
      league_legal_name: (formData.get("league_legal_name") as string)?.trim() || null,
      league_cuit: (formData.get("league_cuit") as string)?.trim() || null,
      league_address: (formData.get("league_address") as string)?.trim() || null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: "No se pudo guardar la configuración." };
  revalidarTesoreria();
  return { ok: true };
}

// ============================================================================
// CARGOS
// ============================================================================

/** La tesorería carga un cargo manual (inscripción, cuotas, otro). */
export async function crearCargo(formData: FormData) {
  const { supabase, user } = await requireTesoreria();

  const clubId = formData.get("club_id") as string;
  const tipo = formData.get("tipo") as string;
  const descripcion = (formData.get("descripcion") as string)?.trim();
  const monto = Number(formData.get("monto"));
  const vencimientoRaw = (formData.get("fecha_vencimiento") as string)?.trim();
  const competitionId = (formData.get("competition_id") as string) || null;

  if (!clubId) return { error: "Elegí un club." };
  if (!TIPOS_CARGO_MANUALES.includes(tipo as (typeof TIPOS_CARGO_MANUALES)[number])) {
    return { error: "Tipo de cargo inválido (las multas se generan automáticamente)." };
  }
  if (!descripcion) return { error: "La descripción es obligatoria." };
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto debe ser un número mayor a cero." };
  }

  if (await mesCerrado(supabase, new Date())) {
    return { error: "El mes actual está cerrado. Pedile al administrador que lo reabra." };
  }

  const { error } = await supabase.from("treasury_charges").insert({
    club_id: clubId,
    competition_id: competitionId,
    tipo,
    descripcion,
    monto,
    fecha_vencimiento: vencimientoRaw || null,
    creado_por: user.id,
  });

  if (error) return { error: "No se pudo crear el cargo." };
  revalidarTesoreria();
  return { ok: true };
}

/** Anular un cargo: queda el registro con motivo. SOLO admin. */
export async function anularCargo(chargeId: string, motivo: string) {
  const { supabase, user } = await requireAdminTesoreria();

  if (!motivo?.trim()) return { error: "El motivo de la anulación es obligatorio." };

  const { data: cargo } = await supabase
    .from("treasury_charges")
    .select("status, created_at")
    .eq("id", chargeId)
    .single();
  if (!cargo) return { error: "El cargo no existe." };
  if (cargo.status === "anulado") return { error: "El cargo ya estaba anulado." };

  if (await mesCerrado(supabase, new Date(cargo.created_at))) {
    return { error: "Ese cargo pertenece a un mes cerrado. Reabrilo primero." };
  }

  const { error } = await supabase
    .from("treasury_charges")
    .update({
      status: "anulado",
      anulado_motivo: motivo.trim(),
      anulado_por: user.id,
      anulado_at: new Date().toISOString(),
    })
    .eq("id", chargeId);

  if (error) return { error: "No se pudo anular el cargo." };

  // Los pagos pendientes de ese cargo quedan sin efecto
  await supabase
    .from("treasury_payments")
    .update({
      status: "anulado",
      anulado_motivo: "El cargo asociado fue anulado.",
      anulado_por: user.id,
      anulado_at: new Date().toISOString(),
    })
    .eq("charge_id", chargeId)
    .eq("status", "pendiente");

  revalidarTesoreria();
  return { ok: true };
}

// ============================================================================
// PAGOS — el club sube el comprobante
// ============================================================================

/** El club informa un pago: sube la foto del comprobante y elige el cargo. */
export async function subirComprobantePago(formData: FormData) {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay una sesión activa." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "club" || !profile.club_id) {
    return { error: "Solo los clubes pueden subir comprobantes." };
  }

  const chargeId = formData.get("charge_id") as string;
  const monto = Number(formData.get("monto"));
  const metodo = formData.get("metodo") as string;
  const archivo = formData.get("comprobante") as File | null;

  if (!chargeId) return { error: "Falta el cargo a pagar." };
  if (!["efectivo", "transferencia", "deposito"].includes(metodo)) {
    return { error: "Método de pago inválido." };
  }
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto debe ser mayor a cero." };
  }

  // El cargo tiene que ser del club y seguir vivo
  const { data: cargo } = await supabase
    .from("treasury_charges")
    .select("id, club_id, monto, fecha_vencimiento, status")
    .eq("id", chargeId)
    .single();
  if (!cargo || cargo.club_id !== profile.club_id) {
    return { error: "Ese cargo no pertenece a tu club." };
  }
  if (cargo.status === "anulado") return { error: "Ese cargo fue anulado." };
  if (cargo.status === "pagado") return { error: "Ese cargo ya está pagado." };

  // No se puede informar más que el saldo (con recargo si está vencido)
  const settings = await obtenerSettings(supabase);
  const { data: pagos } = await supabase
    .from("treasury_payments")
    .select("monto")
    .eq("charge_id", chargeId)
    .eq("status", "aprobado");
  const aprobado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const estado = estadoCargo(
    Number(cargo.monto),
    cargo.fecha_vencimiento,
    Number(settings?.late_fee_percent ?? 0),
    aprobado,
    false
  );
  if (monto > estado.saldo) {
    return { error: `El monto supera el saldo del cargo (${estado.saldo.toFixed(2)}).` };
  }

  // Subir el comprobante al bucket (carpeta del club)
  let comprobantePath: string | null = null;
  if (archivo && archivo.size > 0) {
    if (archivo.size > 5 * 1024 * 1024) {
      return { error: "El comprobante no puede pesar más de 5 MB." };
    }
    const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    comprobantePath = `${profile.club_id}/${crypto.randomUUID()}.${ext}`;
    const { error: errorSubida } = await supabase.storage
      .from("comprobantes-tesoreria")
      .upload(comprobantePath, archivo, { contentType: archivo.type });
    if (errorSubida) return { error: "No se pudo subir el comprobante." };
  }

  const { error } = await supabase.from("treasury_payments").insert({
    charge_id: chargeId,
    club_id: profile.club_id,
    monto,
    metodo,
    comprobante_path: comprobantePath,
    status: "pendiente",
  });

  if (error) return { error: "No se pudo registrar el pago." };
  revalidarTesoreria();
  return { ok: true };
}

// ============================================================================
// PAGOS — la tesorería aprueba / rechaza / anula
// ============================================================================

/** Recalcula el estado del cargo según sus pagos aprobados. */
async function recalcularEstadoCargo(supabase: SupabaseLfs, chargeId: string) {
  const { data: cargo } = await supabase
    .from("treasury_charges")
    .select("monto, fecha_vencimiento, status")
    .eq("id", chargeId)
    .single();
  if (!cargo || cargo.status === "anulado") return;

  const settings = await obtenerSettings(supabase);
  const { data: pagos } = await supabase
    .from("treasury_payments")
    .select("monto")
    .eq("charge_id", chargeId)
    .eq("status", "aprobado");
  const aprobado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);

  const estado = estadoCargo(
    Number(cargo.monto),
    cargo.fecha_vencimiento,
    Number(settings?.late_fee_percent ?? 0),
    aprobado,
    false
  );

  const nuevoStatus =
    estado.estado === "pagado" ? "pagado" : aprobado > 0 ? "parcial" : "pendiente";

  await supabase
    .from("treasury_charges")
    .update({ status: nuevoStatus })
    .eq("id", chargeId);
}

/** Aprobar un pago: emite el recibo numerado y actualiza el cargo. */
export async function aprobarPago(paymentId: string) {
  const { supabase, user } = await requireTesoreria();

  const { data: pago } = await supabase
    .from("treasury_payments")
    .select("status, charge_id, created_at")
    .eq("id", paymentId)
    .single();
  if (!pago) return { error: "El pago no existe." };
  if (pago.status !== "pendiente") return { error: "Ese pago ya fue resuelto." };

  if (await mesCerrado(supabase, new Date())) {
    return { error: "El mes actual está cerrado. Pedile al administrador que lo reabra." };
  }

  // Número de recibo atómico por año (2026-0001…)
  const anio = new Date().getFullYear();
  const { data: numeroRecibo, error: errorRecibo } = await supabase.rpc(
    "asignar_numero_recibo",
    { p_anio: anio }
  );
  if (errorRecibo || !numeroRecibo) {
    return { error: "No se pudo asignar el número de recibo." };
  }

  const { error } = await supabase
    .from("treasury_payments")
    .update({
      status: "aprobado",
      receipt_number: numeroRecibo,
      resuelto_por: user.id,
      resuelto_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) return { error: "No se pudo aprobar el pago." };

  await recalcularEstadoCargo(supabase, pago.charge_id);
  revalidarTesoreria();
  return { ok: true, recibo: numeroRecibo };
}

/** Rechazar un pago (comprobante ilegible, monto incorrecto, etc.). */
export async function rechazarPago(paymentId: string, motivo: string) {
  const { supabase, user } = await requireTesoreria();

  if (!motivo?.trim()) return { error: "Indicá el motivo del rechazo." };

  const { data: pago } = await supabase
    .from("treasury_payments")
    .select("status")
    .eq("id", paymentId)
    .single();
  if (!pago) return { error: "El pago no existe." };
  if (pago.status !== "pendiente") return { error: "Ese pago ya fue resuelto." };

  const { error } = await supabase
    .from("treasury_payments")
    .update({
      status: "rechazado",
      rechazo_motivo: motivo.trim(),
      resuelto_por: user.id,
      resuelto_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) return { error: "No se pudo rechazar el pago." };
  revalidarTesoreria();
  return { ok: true };
}

/** Anular un pago YA aprobado (error de carga). SOLO admin. */
export async function anularPago(paymentId: string, motivo: string) {
  const { supabase, user } = await requireAdminTesoreria();

  if (!motivo?.trim()) return { error: "El motivo de la anulación es obligatorio." };

  const { data: pago } = await supabase
    .from("treasury_payments")
    .select("status, charge_id, created_at")
    .eq("id", paymentId)
    .single();
  if (!pago) return { error: "El pago no existe." };
  if (pago.status !== "aprobado") return { error: "Solo se anulan pagos aprobados." };

  if (await mesCerrado(supabase, new Date(pago.created_at))) {
    return { error: "Ese pago pertenece a un mes cerrado. Reabrilo primero." };
  }

  const { error } = await supabase
    .from("treasury_payments")
    .update({
      status: "anulado",
      anulado_motivo: motivo.trim(),
      anulado_por: user.id,
      anulado_at: new Date().toISOString(),
    })
    .eq("id", paymentId);

  if (error) return { error: "No se pudo anular el pago." };

  await recalcularEstadoCargo(supabase, pago.charge_id);
  revalidarTesoreria();
  return { ok: true };
}

// ============================================================================
// MULTAS AUTOMÁTICAS (se llaman desde planilla/competencias)
// Usan el cliente service_role porque nacen de acciones del árbitro.
// ============================================================================

const MONTOS_MULTA = {
  multa_roja: "fine_red",
  multa_wo: "fine_wo",
  multa_acumulacion_amarillas: "fine_yellow_accum",
} as const;

/**
 * Crea el cargo de una multa automática. Si el monto configurado es 0,
 * no genera nada (la liga todavía no fijó ese valor). El índice único
 * por evento evita duplicados en reintentos.
 */
export async function crearMultaAutomatica(params: {
  clubId: string;
  competitionId: string | null;
  tipo: keyof typeof MONTOS_MULTA;
  descripcion: string;
  eventoOrigenId: string | null;
}) {
  try {
    const admin = createLfsAdminClient();
    const { data: settings } = await admin
      .from("treasury_settings")
      .select("fine_red, fine_wo, fine_yellow_accum")
      .eq("id", 1)
      .single();

    const monto = Number(
      (settings as Record<string, number> | null)?.[MONTOS_MULTA[params.tipo]] ?? 0
    );
    if (monto <= 0) return;

    await admin.from("treasury_charges").insert({
      club_id: params.clubId,
      competition_id: params.competitionId,
      tipo: params.tipo,
      descripcion: params.descripcion,
      monto,
      evento_origen_id: params.eventoOrigenId,
    });
  } catch {
    // La multa nunca frena la carga del evento deportivo
  }
}

/** Link firmado (10 min) para ver un comprobante. Tesorería o el club dueño. */
export async function obtenerUrlComprobante(path: string) {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay una sesión activa." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  const carpetaClub = path.split("/")[0];
  const esTesoreria = profile?.role === "admin" || profile?.role === "tesorero";
  const esSuClub = profile?.role === "club" && profile.club_id === carpetaClub;
  if (!esTesoreria && !esSuClub) return { error: "No podés ver este comprobante." };

  const { data, error } = await supabase.storage
    .from("comprobantes-tesoreria")
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { error: "No se pudo abrir el comprobante." };
  return { url: data.signedUrl };
}

// ============================================================================
// GASTOS DE LA LIGA (Paso 8B)
// ============================================================================

/** La tesorería registra un gasto (o devolución a un club). */
export async function registrarGasto(formData: FormData) {
  const { supabase, user } = await requireTesoreria();

  const categoria = formData.get("categoria") as string;
  const concepto = (formData.get("concepto") as string)?.trim();
  const monto = Number(formData.get("monto"));
  const fechaRaw = (formData.get("fecha") as string)?.trim();
  const clubId = (formData.get("club_id") as string) || null;
  const archivo = formData.get("comprobante") as File | null;

  if (!CATEGORIAS_GASTO.includes(categoria)) {
    return { error: "Categoría inválida." };
  }
  if (!concepto) return { error: "El concepto es obligatorio." };
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "El monto debe ser mayor a cero." };
  }
  const fecha = fechaRaw ? new Date(fechaRaw + "T12:00:00") : new Date();
  if (isNaN(fecha.getTime())) return { error: "Fecha inválida." };

  // Una devolución tiene que indicar a qué club se le devolvió
  if (categoria === "devoluciones" && !clubId) {
    return { error: "En una devolución tenés que elegir el club." };
  }

  if (await mesCerrado(supabase, fecha)) {
    return { error: "Ese mes está cerrado. Pedile al administrador que lo reabra." };
  }

  let comprobantePath: string | null = null;
  if (archivo && archivo.size > 0) {
    if (archivo.size > 5 * 1024 * 1024) {
      return { error: "El comprobante no puede pesar más de 5 MB." };
    }
    const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    comprobantePath = `gastos/${crypto.randomUUID()}.${ext}`;
    const { error: errorSubida } = await supabase.storage
      .from("comprobantes-tesoreria")
      .upload(comprobantePath, archivo, { contentType: archivo.type });
    if (errorSubida) return { error: "No se pudo subir el comprobante." };
  }

  const { error } = await supabase.from("treasury_expenses").insert({
    categoria,
    concepto,
    monto,
    fecha: fecha.toISOString().slice(0, 10),
    club_id: clubId,
    comprobante_path: comprobantePath,
    creado_por: user.id,
  });

  if (error) return { error: "No se pudo registrar el gasto." };
  revalidarTesoreria();
  return { ok: true };
}

/** Anular un gasto: queda el registro con motivo. SOLO admin. */
export async function anularGasto(gastoId: string, motivo: string) {
  const { supabase, user } = await requireAdminTesoreria();

  if (!motivo?.trim()) return { error: "El motivo de la anulación es obligatorio." };

  const { data: gasto } = await supabase
    .from("treasury_expenses")
    .select("fecha, anulado_at")
    .eq("id", gastoId)
    .single();
  if (!gasto) return { error: "El gasto no existe." };
  if (gasto.anulado_at) return { error: "El gasto ya estaba anulado." };

  if (await mesCerrado(supabase, new Date(gasto.fecha + "T12:00:00"))) {
    return { error: "Ese gasto pertenece a un mes cerrado. Reabrilo primero." };
  }

  const { error } = await supabase
    .from("treasury_expenses")
    .update({
      anulado_motivo: motivo.trim(),
      anulado_por: user.id,
      anulado_at: new Date().toISOString(),
    })
    .eq("id", gastoId);

  if (error) return { error: "No se pudo anular el gasto." };
  revalidarTesoreria();
  return { ok: true };
}

// ============================================================================
// CIERRE DE CAJA MENSUAL (Paso 8B)
// El tesorero cierra; solo el admin reabre (con motivo registrado).
// ============================================================================

export async function cerrarMes(anio: number, mes: number) {
  const { supabase, user } = await requireTesoreria();

  const { data: existente } = await supabase
    .from("treasury_cierres")
    .select("anio, mes, reabierto_at")
    .eq("anio", anio)
    .eq("mes", mes)
    .maybeSingle();

  if (existente && !existente.reabierto_at) {
    return { error: "Ese mes ya está cerrado." };
  }

  const { error } = await supabase.from("treasury_cierres").upsert({
    anio,
    mes,
    cerrado_por: user.id,
    cerrado_at: new Date().toISOString(),
    reabierto_por: null,
    reabierto_at: null,
    reapertura_motivo: null,
  });

  if (error) return { error: "No se pudo cerrar el mes." };
  revalidarTesoreria();
  return { ok: true };
}

export async function reabrirMes(anio: number, mes: number, motivo: string) {
  const { supabase, user } = await requireAdminTesoreria();

  if (!motivo?.trim()) return { error: "El motivo de la reapertura es obligatorio." };

  const { error } = await supabase
    .from("treasury_cierres")
    .update({
      reabierto_por: user.id,
      reabierto_at: new Date().toISOString(),
      reapertura_motivo: motivo.trim(),
    })
    .eq("anio", anio)
    .eq("mes", mes)
    .is("reabierto_at", null);

  if (error) return { error: "No se pudo reabrir el mes." };
  revalidarTesoreria();
  return { ok: true };
}

/** Anula la multa que nació de un evento de planilla eliminado. */
export async function anularMultaDeEvento(eventoId: string) {
  try {
    const admin = createLfsAdminClient();
    await admin
      .from("treasury_charges")
      .update({
        status: "anulado",
        anulado_motivo: "Se eliminó el evento de planilla que originó la multa.",
        anulado_at: new Date().toISOString(),
      })
      .eq("evento_origen_id", eventoId)
      .neq("status", "anulado");
  } catch {
    // silencioso: la baja del evento deportivo manda
  }
}
