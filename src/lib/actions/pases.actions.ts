"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import { esEstadoTerminal } from "@/lib/core/rules/pasesRules";

/**
 * PASES Y TRANSFERENCIAS — Acciones de servidor (Paso 9)
 *
 * Reglas de oro:
 *  · Los pases NUNCA se borran: se rechazan (8) o cancelan (9) con motivo.
 *  · Un jugador no puede tener dos pases en curso (índice único en la base).
 *  · Iniciar un pase exige ventana de mercado abierta — salvo el admin
 *    (excepción registrada como "excepcional" en metadata).
 *  · La firma del jugador es pública (token + DNI, 72 hs) y la valida
 *    la función firmar_pase de la base; acá no hay acción de firma.
 *  · Las notificaciones por mensajería interna son best-effort: nunca
 *    bloquean el trámite si fallan.
 */

type SupabaseLfs = Awaited<ReturnType<typeof createLfsServerClient>>;

async function requireAdminPases() {
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
  if (profile?.role !== "admin") throw new Error("Solo la liga puede hacer esto.");

  return { supabase, user };
}

async function requireClubPases() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay una sesión activa.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "club" && profile.role !== "admin")) {
    throw new Error("Solo los clubes pueden hacer esto.");
  }

  return { supabase, user, clubId: profile.club_id as string | null };
}

function revalidarPases() {
  revalidatePath("/admin/tramites");
  revalidatePath("/club/tramites");
  revalidatePath("/club/dashboard");
}

/** Aviso automático por la mensajería interna (nunca rompe el trámite). */
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
    // silencioso: el aviso es un plus, el trámite manda
  }
}

interface PaseRow {
  id: string;
  player_id: string;
  from_club_id: string | null;
  to_club_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  players?: { first_name: string; last_name: string; dni: string } | null;
}

async function obtenerPase(supabase: SupabaseLfs, id: string): Promise<PaseRow | null> {
  const { data } = await supabase
    .from("transfers")
    .select("id, player_id, from_club_id, to_club_id, status, metadata, players(first_name, last_name, dni)")
    .eq("id", id)
    .single();
  return (data as unknown as PaseRow) ?? null;
}

function nombreJugador(p: PaseRow): string {
  if (!p.players) return "el jugador";
  return `${p.players.last_name}, ${p.players.first_name}`;
}

// ============================================================================
// BÚSQUEDA E INICIO
// ============================================================================

/** Buscar jugador por DNI exacto (función de la base, datos mínimos). */
export async function buscarJugadorParaPase(dni: string) {
  const { supabase } = await requireClubPases();

  const limpio = dni.trim();
  if (!/^\d{6,10}$/.test(limpio)) {
    return { error: "El DNI debe tener entre 6 y 10 números, sin puntos ni letras." };
  }

  const { data, error } = await supabase.rpc("buscar_jugador_pase", { p_dni: limpio });
  if (error) return { error: "No se pudo buscar el jugador." };

  const fila = Array.isArray(data) ? data[0] : data;
  if (!fila) {
    return {
      error:
        "No existe ningún jugador con ese DNI. Si es un jugador nuevo, el alta la hace la liga desde Equipos.",
    };
  }
  return {
    jugador: fila as {
      player_id: string;
      nombre: string;
      apellido: string;
      dni: string;
      club_actual: string | null;
      club_actual_id: string | null;
    },
  };
}

/** Inicia la solicitud de pase. Club destino (su propio club) o admin (elige). */
export async function iniciarPase(dni: string, toClubIdAdmin?: string) {
  const { supabase, user, clubId } = await requireClubPases();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const esAdmin = profile?.role === "admin";

  const toClub = esAdmin && toClubIdAdmin ? toClubIdAdmin : clubId;
  if (!toClub) return { error: "No se pudo determinar el club destino." };

  // Ventana de mercado: los clubes solo inician con mercado abierto
  const { data: ventanaAbierta } = await supabase.rpc("hay_ventana_pases");
  const excepcional = esAdmin && !ventanaAbierta;
  if (!ventanaAbierta && !esAdmin) {
    return {
      error:
        "El mercado de pases está cerrado. Cuando la liga abra una ventana vas a poder iniciar la solicitud.",
    };
  }

  // Datos del jugador vía función (el club no puede leer planteles ajenos)
  const busqueda = await buscarJugadorParaPase(dni);
  if (busqueda.error || !busqueda.jugador) {
    return { error: busqueda.error ?? "Jugador no encontrado." };
  }
  const j = busqueda.jugador;

  if (!j.club_actual_id) {
    return {
      error:
        "Ese jugador está libre (sin club). Su incorporación es un alta, no un pase: gestionala con la liga.",
    };
  }
  if (j.club_actual_id === toClub) {
    return { error: "Ese jugador ya está en el club destino." };
  }

  const { error } = await supabase.from("transfers").insert({
    player_id: j.player_id,
    from_club_id: j.club_actual_id,
    to_club_id: toClub,
    status: "1_INIT_CLUB_A",
    metadata: excepcional
      ? { excepcional: true, excepcion_motivo: "Iniciado por la liga fuera de ventana." }
      : {},
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese jugador ya tiene un pase en curso." };
    }
    return { error: "No se pudo iniciar el pase." };
  }

  revalidarPases();
  return { ok: true };
}

// ============================================================================
// REVISIÓN DE LA LIGA
// ============================================================================

/** La liga aprueba la revisión → pasa a dictamen del club de origen. */
export async function aprobarRevisionPase(transferId: string) {
  const { supabase, user } = await requireAdminPases();
  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "1_INIT_CLUB_A" && pase.status !== "2_FVF_REVIEW") {
    return { error: "Este pase ya no está en revisión." };
  }

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "4_CLUB_B_DECISION",
      metadata: { ...pase.metadata, notificado_at: new Date().toISOString() },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo aprobar la revisión." };

  await notificarClub(
    pase.from_club_id,
    `📋 Pase de ${nombreJugador(pase)}: la liga aprobó la revisión y el trámite espera tu DICTAMEN. Entrá a Trámites para aprobar o rechazar.`,
    user.id
  );

  revalidarPases();
  return { ok: true };
}

/** La liga rechaza el pase (con motivo, queda el registro). */
export async function rechazarPaseAdmin(transferId: string, motivo: string) {
  const { supabase, user } = await requireAdminPases();
  if (!motivo?.trim()) return { error: "El motivo del rechazo es obligatorio." };

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (esEstadoTerminal(pase.status)) return { error: "Este pase ya terminó." };

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "8_RECHAZADO",
      metadata: {
        ...pase.metadata,
        rechazo_motivo: motivo.trim(),
        rechazado_por: "liga",
        rechazado_at: new Date().toISOString(),
      },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo rechazar el pase." };

  await notificarClub(
    pase.to_club_id,
    `❌ El pase de ${nombreJugador(pase)} fue RECHAZADO por la liga. Motivo: ${motivo.trim()}`,
    user.id
  );

  revalidarPases();
  return { ok: true };
}

// ============================================================================
// DICTAMEN DEL CLUB DE ORIGEN
// ============================================================================

/** El club de origen aprueba (habilita la firma) o rechaza (con motivo). */
export async function decidirPaseOrigen(
  transferId: string,
  aprobar: boolean,
  motivo?: string
) {
  const { supabase, user, clubId } = await requireClubPases();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const esAdmin = profile?.role === "admin";

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "4_CLUB_B_DECISION") {
    return { error: "Este pase no está esperando dictamen." };
  }
  if (!esAdmin && pase.from_club_id !== clubId) {
    return { error: "Solo el club de origen puede dictaminar este pase." };
  }

  if (aprobar) {
    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("transfers")
      .update({
        status: "5_PLAYER_SIGNATURE",
        approved_at: new Date().toISOString(),
        metadata: { ...pase.metadata, firma_token: token },
      })
      .eq("id", transferId);
    if (error) return { error: "No se pudo aprobar el pase." };

    await notificarClub(
      pase.to_club_id,
      `✅ Tu club de origen APROBÓ el pase de ${nombreJugador(pase)}. Ahora tiene que firmar el jugador: entrá a Trámites y compartile el link de firma (dura 72 hs).`,
      user.id
    );
  } else {
    if (!motivo?.trim()) return { error: "Para rechazar, el motivo es obligatorio." };
    const { error } = await supabase
      .from("transfers")
      .update({
        status: "8_RECHAZADO",
        metadata: {
          ...pase.metadata,
          rechazo_motivo: motivo.trim(),
          rechazado_por: "club_origen",
          rechazado_at: new Date().toISOString(),
        },
      })
      .eq("id", transferId);
    if (error) return { error: "No se pudo rechazar el pase." };

    await notificarClub(
      pase.to_club_id,
      `❌ El club de origen RECHAZÓ el pase de ${nombreJugador(pase)}. Motivo: ${motivo.trim()}`,
      user.id
    );
  }

  revalidarPases();
  return { ok: true };
}

/** El club destino retira su solicitud (solo antes de la revisión). */
export async function retirarSolicitudPase(transferId: string, motivo?: string) {
  const { supabase, clubId } = await requireClubPases();

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "1_INIT_CLUB_A") {
    return { error: "Solo se puede retirar una solicitud recién iniciada." };
  }
  if (pase.to_club_id !== clubId) {
    return { error: "Solo el club que pidió el pase puede retirarlo." };
  }

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "9_CANCELADO",
      metadata: {
        ...pase.metadata,
        cancelacion_motivo: motivo?.trim() || "Retirado por el club destino.",
        cancelado_at: new Date().toISOString(),
      },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo retirar la solicitud." };
  revalidarPases();
  return { ok: true };
}

// ============================================================================
// AUDITORÍA FINAL Y COMPLETADO
// ============================================================================

/** La liga cancela un pase trabado en cualquier punto (con motivo). */
export async function cancelarPase(transferId: string, motivo: string) {
  const { supabase } = await requireAdminPases();
  if (!motivo?.trim()) return { error: "El motivo de la cancelación es obligatorio." };

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (esEstadoTerminal(pase.status)) return { error: "Este pase ya terminó." };

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "9_CANCELADO",
      metadata: {
        ...pase.metadata,
        cancelacion_motivo: motivo.trim(),
        cancelado_at: new Date().toISOString(),
      },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo cancelar el pase." };
  revalidarPases();
  return { ok: true };
}

/** Regenera el link de firma si se vencieron las 72 hs. */
export async function regenerarLinkFirma(transferId: string) {
  const { supabase, user } = await requireAdminPases();

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "5_PLAYER_SIGNATURE") {
    return { error: "Este pase no está esperando la firma." };
  }

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("transfers")
    .update({
      approved_at: new Date().toISOString(),
      metadata: { ...pase.metadata, firma_token: token },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo regenerar el link." };

  await notificarClub(
    pase.to_club_id,
    `🔗 Se generó un link NUEVO de firma para el pase de ${nombreJugador(pase)}. Entrá a Trámites y compartíselo al jugador (dura 72 hs).`,
    user.id
  );

  revalidarPases();
  return { ok: true };
}

/**
 * Auditoría final aprobada → el pase queda EFECTIVO:
 *  1. El jugador cambia de club en todas sus categorías.
 *  2. Se le asigna el número de comprobante (PASE-2026-0001…).
 *  3. Si hay derecho de pase configurado, se genera el cargo automático.
 */
export async function completarPase(transferId: string) {
  const { supabase, user } = await requireAdminPases();

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "6_FINAL_AUDIT") {
    return { error: "El pase tiene que estar firmado por el jugador (auditoría final)." };
  }

  // 1) Mover al jugador de club (todas sus categorías)
  if (pase.from_club_id && pase.to_club_id) {
    const { error: errorMov } = await supabase
      .from("player_categories")
      .update({ club_id: pase.to_club_id })
      .eq("player_id", pase.player_id)
      .eq("club_id", pase.from_club_id);
    if (errorMov) return { error: "No se pudo mover al jugador al club nuevo." };
  }

  // 2) Número de comprobante + estado final
  const anio = new Date().getFullYear();
  const { data: numero } = await supabase.rpc("asignar_numero_pase", { p_anio: anio });

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "7_COMPLETED",
      numero_pase: numero ?? null,
      metadata: { ...pase.metadata, completado_at: new Date().toISOString() },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo completar el pase." };

  // 3) Cargo automático de derecho de pase (nunca bloquea el pase)
  try {
    const admin = createLfsAdminClient();
    const { data: settings } = await admin
      .from("treasury_settings")
      .select("transfer_fee")
      .eq("id", 1)
      .single();
    const monto = Number(settings?.transfer_fee ?? 0);
    if (monto > 0 && pase.to_club_id) {
      const { data: clubes } = await admin
        .from("clubs")
        .select("id, name")
        .in("id", [pase.from_club_id, pase.to_club_id].filter(Boolean) as string[]);
      const nombreOrigen =
        clubes?.find((c) => c.id === pase.from_club_id)?.name ?? "Jugador libre";
      const nombreDestino =
        clubes?.find((c) => c.id === pase.to_club_id)?.name ?? "Club destino";

      await admin.from("treasury_charges").insert({
        club_id: pase.to_club_id,
        tipo: "derecho_pase",
        descripcion: `Derecho de pase: ${nombreJugador(pase)} — ${nombreOrigen} → ${nombreDestino}`,
        monto,
        transfer_id: transferId,
        creado_por: user.id,
      });
    }
  } catch {
    // silencioso: el cargo se puede cargar a mano si falla
  }

  await notificarClub(
    pase.to_club_id,
    `🎉 El pase de ${nombreJugador(pase)} quedó EFECTIVO (${numero ?? "sin número"}). Ya figura en tu plantel.`,
    user.id
  );
  await notificarClub(
    pase.from_club_id,
    `📤 El pase de ${nombreJugador(pase)} quedó efectivo: el jugador ya no forma parte de tu plantel.`,
    user.id
  );

  revalidarPases();
  revalidatePath("/admin/tesoreria/movimientos");
  return { ok: true };
}

/** Anota el número federativo (Comet/AFA) como referencia. Solo admin. */
export async function guardarNroFederativo(transferId: string, nro: string) {
  const { supabase } = await requireAdminPases();

  const { error } = await supabase
    .from("transfers")
    .update({ nro_federativo: nro.trim() || null })
    .eq("id", transferId);

  if (error) return { error: "No se pudo guardar el número federativo." };
  revalidarPases();
  return { ok: true };
}

// ============================================================================
// FIRMA PÚBLICA DEL JUGADOR (sin login: el token del link es la llave)
// ============================================================================

export async function firmarPasePublico(token: string, dni: string) {
  const supabase = await createLfsServerClient();
  const { data, error } = await supabase.rpc("firmar_pase", {
    p_token: token,
    p_dni: dni.trim(),
  });
  if (error) return { error: "No se pudo registrar la firma. Probá de nuevo." };
  if (data !== "OK") return { error: String(data) };
  revalidarPases();
  return { ok: true };
}

// ============================================================================
// DOCUMENTOS ADJUNTOS (opcionales)
// ============================================================================

export async function subirDocumentoPase(formData: FormData) {
  const { supabase, user } = await requireClubPases();

  const transferId = formData.get("transfer_id") as string;
  const archivo = formData.get("documento") as File | null;
  if (!transferId) return { error: "Falta el pase." };
  if (!archivo || archivo.size === 0) return { error: "Elegí un archivo." };
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: "El documento no puede pesar más de 5 MB." };
  }

  const ext = archivo.name.split(".").pop()?.toLowerCase() ?? "pdf";
  const path = `${transferId}/${crypto.randomUUID()}.${ext}`;
  const { error: errorSubida } = await supabase.storage
    .from("documentos-pases")
    .upload(path, archivo, { contentType: archivo.type });
  if (errorSubida) return { error: "No se pudo subir el documento." };

  const { error } = await supabase.from("transfer_documents").insert({
    transfer_id: transferId,
    path,
    nombre: archivo.name,
    subido_por: user.id,
  });
  if (error) return { error: "Se subió el archivo pero no se pudo registrar." };

  revalidarPases();
  return { ok: true };
}

export async function obtenerUrlDocumentoPase(path: string) {
  const { supabase } = await requireClubPases();

  const { data, error } = await supabase.storage
    .from("documentos-pases")
    .createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return { error: "No se pudo abrir el documento." };
  return { url: data.signedUrl };
}

// ============================================================================
// BAJA DE JUGADOR (queda libre, con registro)
// ============================================================================

export async function bajaJugador(playerId: string, motivo: string) {
  const { supabase } = await requireClubPases();

  const { data, error } = await supabase.rpc("dar_baja_jugador", {
    p_player_id: playerId,
    p_motivo: motivo ?? "",
  });

  if (error) return { error: "No se pudo dar de baja al jugador." };
  if (data !== "OK") return { error: String(data) };

  revalidarPases();
  return { ok: true };
}

// ============================================================================
// VENTANAS DE MERCADO (solo admin)
// ============================================================================

export async function crearVentana(formData: FormData) {
  const { supabase, user } = await requireAdminPases();

  const nombre = (formData.get("nombre") as string)?.trim();
  const desde = (formData.get("fecha_desde") as string)?.trim();
  const hasta = (formData.get("fecha_hasta") as string)?.trim();
  if (!nombre) return { error: "Ponele un nombre a la ventana (ej: Mercado de Verano 2026)." };
  if (!desde || !hasta) return { error: "Faltan las fechas." };
  if (hasta < desde) return { error: "La fecha de fin no puede ser anterior a la de inicio." };

  const { error } = await supabase.from("transfer_windows").insert({
    nombre,
    fecha_desde: desde,
    fecha_hasta: hasta,
    creado_por: user.id,
  });

  if (error) return { error: "No se pudo crear la ventana." };
  revalidarPases();
  return { ok: true };
}

export async function eliminarVentana(ventanaId: string) {
  const { supabase } = await requireAdminPases();

  const { error } = await supabase
    .from("transfer_windows")
    .delete()
    .eq("id", ventanaId);

  if (error) return { error: "No se pudo eliminar la ventana." };
  revalidarPases();
  return { ok: true };
}
