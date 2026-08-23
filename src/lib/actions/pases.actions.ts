"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  esEstadoTerminal,
  fechaRetornoValida,
  type TipoPase,
} from "@/lib/core/rules/pasesRules";

/**
 * PASES Y TRANSFERENCIAS — Acciones de servidor (Pasos 9 y 9B)
 *
 * Reglas de oro:
 *  · Los pases NUNCA se borran: se rechazan (8) o cancelan (9) con motivo.
 *  · Un jugador no puede tener dos pases en curso (índice único en la base).
 *  · NADIE inicia un pase fuera de ventana: ni clubes ni la liga (9B).
 *  · Hay dos tipos de pase: DEFINITIVO y PRÉSTAMO (con retorno automático).
 *  · La firma del jugador es profesional (9B): documento de conformidad,
 *    firma dibujada, foto del DNI en el momento y, si es menor, el bloque
 *    completo del tutor. También puede RECHAZAR el pase con motivo.
 *  · El club de origen declara la deuda en el dictamen: modo "cobrar"
 *    (la paga el destino con el pase) o "bloqueante" (frena el pase hasta
 *    que la liga la marque saldada).
 *  · El derecho de pase lo fija la FEDERACIÓN por categoría y tipo (y por
 *    torneo para préstamos): la plata es de la liga (cargo de Tesorería).
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
  revalidatePath("/transferencias");
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
  tipo_pase: string;
  fecha_retorno: string | null;
  competition_id: string | null;
  deuda_monto: number | null;
  deuda_modo: string | null;
  deuda_descripcion: string | null;
  deuda_saldada: boolean;
  metadata: Record<string, unknown>;
  players?: { first_name: string; last_name: string; dni: string } | null;
}

async function obtenerPase(supabase: SupabaseLfs, id: string): Promise<PaseRow | null> {
  const { data } = await supabase
    .from("transfers")
    .select(
      "id, player_id, from_club_id, to_club_id, status, tipo_pase, fecha_retorno, competition_id, deuda_monto, deuda_modo, deuda_descripcion, deuda_saldada, metadata, players(first_name, last_name, dni)"
    )
    .eq("id", id)
    .single();
  return (data as unknown as PaseRow) ?? null;
}

function nombreJugador(p: PaseRow): string {
  if (!p.players) return "el jugador";
  return `${p.players.last_name}, ${p.players.first_name}`;
}

function nombreTipoPase(tipo: string): string {
  return tipo === "prestamo" ? "préstamo" : "pase definitivo";
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

/**
 * Inicia la solicitud de pase. Club destino (su propio club) o admin (elige).
 * 9B: NADIE puede iniciar fuera de ventana (ni siquiera la liga) y el pase
 * puede ser DEFINITIVO o PRÉSTAMO (con fecha de retorno futura obligatoria).
 */
export async function iniciarPase(
  dni: string,
  toClubIdAdmin?: string,
  tipoPase: TipoPase = "definitivo",
  fechaRetorno?: string,
  competitionId?: string
) {
  const { supabase, user, clubId } = await requireClubPases();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const esAdmin = profile?.role === "admin";

  const toClub = esAdmin && toClubIdAdmin ? toClubIdAdmin : clubId;
  if (!toClub) return { error: "No se pudo determinar el club destino." };

  // Ventana de mercado: SIN excepciones (9B). Nadie inicia fuera de ventana.
  const { data: ventanaAbierta } = await supabase.rpc("hay_ventana_pases");
  if (!ventanaAbierta) {
    return {
      error:
        "El mercado de pases está cerrado. Nadie puede iniciar un pase fuera de ventana, ni siquiera la liga. Cuando se abra una ventana vas a poder hacer la solicitud.",
    };
  }

  // Tipo de pase y fecha de retorno (9B)
  const tipo: TipoPase = tipoPase === "prestamo" ? "prestamo" : "definitivo";
  const validacion = fechaRetornoValida(fechaRetorno ?? null, tipo);
  if (!validacion.ok) return { error: validacion.error };

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
    tipo_pase: tipo,
    fecha_retorno: tipo === "prestamo" ? fechaRetorno : null,
    competition_id: tipo === "prestamo" && competitionId ? competitionId : null,
    metadata: {},
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
    `📋 Pase de ${nombreJugador(pase)}: la liga aprobó la revisión y el trámite espera tu DICTAMEN. Entrá a Trámites para aprobar o rechazar. Si no dictaminás a tiempo, el pase se cancela solo.`,
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
// DICTAMEN DEL CLUB DE ORIGEN (con declaración de deuda — 9B)
// ============================================================================

export interface DeudaDeclarada {
  monto: number;
  modo: "cobrar" | "bloqueante";
  descripcion?: string;
}

/**
 * El club de origen aprueba (habilita la firma) o rechaza (con motivo).
 * 9B: al aprobar puede declarar una DEUDA del jugador con el club:
 *  · modo "cobrar": la paga el club destino junto con el pase.
 *  · modo "bloqueante": el pase no se completa hasta que la liga la
 *    marque saldada (el jugador puede pagarla por fuera del sistema).
 */
export async function decidirPaseOrigen(
  transferId: string,
  aprobar: boolean,
  motivo?: string,
  deuda?: DeudaDeclarada | null
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
    // Validar la deuda declarada (si hay)
    let deudaLimpia: DeudaDeclarada | null = null;
    if (deuda && deuda.monto > 0) {
      if (deuda.modo !== "cobrar" && deuda.modo !== "bloqueante") {
        return { error: "Elegí cómo se resuelve la deuda: la cobra el club destino o bloquea el pase." };
      }
      deudaLimpia = {
        monto: Math.round(deuda.monto * 100) / 100,
        modo: deuda.modo,
        descripcion: deuda.descripcion?.trim() || undefined,
      };
    }

    const token = crypto.randomUUID();
    const { error } = await supabase
      .from("transfers")
      .update({
        status: "5_PLAYER_SIGNATURE",
        approved_at: new Date().toISOString(),
        deuda_monto: deudaLimpia ? deudaLimpia.monto : null,
        deuda_modo: deudaLimpia ? deudaLimpia.modo : null,
        deuda_descripcion: deudaLimpia?.descripcion ?? null,
        metadata: { ...pase.metadata, firma_token: token },
      })
      .eq("id", transferId);
    if (error) return { error: "No se pudo aprobar el pase." };

    let texto = `✅ Tu club de origen APROBÓ el ${nombreTipoPase(pase.tipo_pase)} de ${nombreJugador(pase)}. Ahora tiene que firmar el jugador: entrá a Trámites y compartile el link de firma (dura 72 hs).`;
    if (deudaLimpia) {
      texto +=
        deudaLimpia.modo === "cobrar"
          ? ` El club de origen declaró una deuda de $${deudaLimpia.monto.toLocaleString("es-AR")} que tu club paga junto con el pase.`
          : ` El club de origen declaró una deuda de $${deudaLimpia.monto.toLocaleString("es-AR")} que BLOQUEA el pase hasta que se salde.`;
    }

    await notificarClub(pase.to_club_id, texto, user.id);
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
 *  1. Si hay deuda BLOQUEANTE sin saldar, el pase NO se puede completar.
 *  2. El jugador cambia de club en todas sus categorías.
 *  3. Se le asigna el número de comprobante (PASE-2026-0001…).
 *  4. Derecho de pase: lo fija la FEDERACIÓN por categoría y tipo (y por
 *     torneo para préstamos) → cargo automático para el club destino.
 *  5. Deuda en modo "cobrar" → cargo automático para el club destino.
 */
export async function completarPase(transferId: string) {
  const { supabase, user } = await requireAdminPases();

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "6_FINAL_AUDIT") {
    return { error: "El pase tiene que estar firmado por el jugador (auditoría final)." };
  }

  // 1) Deuda bloqueante: frena el pase hasta que la liga la marque saldada
  const deudaMonto = Number(pase.deuda_monto ?? 0);
  if (pase.deuda_modo === "bloqueante" && deudaMonto > 0 && !pase.deuda_saldada) {
    return {
      error: `Este pase está BLOQUEADO por una deuda de $${deudaMonto.toLocaleString("es-AR")} con el club de origen. Cuando se salde (la puede pagar el jugador por fuera del sistema), marcala como saldada desde el botón "Deuda saldada" y completá el pase.`,
    };
  }

  // 2) Mover al jugador de club (todas sus categorías)
  if (pase.from_club_id && pase.to_club_id) {
    const { error: errorMov } = await supabase
      .from("player_categories")
      .update({ club_id: pase.to_club_id })
      .eq("player_id", pase.player_id)
      .eq("club_id", pase.from_club_id);
    if (errorMov) return { error: "No se pudo mover al jugador al club nuevo." };
  }

  // 3) Número de comprobante + estado final
  const anio = new Date().getFullYear();
  const { data: numero } = await supabase.rpc("asignar_numero_pase", { p_anio: anio });

  const deudaCobradaEnPase = pase.deuda_modo === "cobrar" && deudaMonto > 0;

  const { error } = await supabase
    .from("transfers")
    .update({
      status: "7_COMPLETED",
      numero_pase: numero ?? null,
      deuda_saldada: pase.deuda_saldada || deudaCobradaEnPase,
      metadata: { ...pase.metadata, completado_at: new Date().toISOString() },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo completar el pase." };

  // 4) y 5) Cargos automáticos (nunca bloquean el pase)
  try {
    const admin = createLfsAdminClient();
    const { data: clubes } = await admin
      .from("clubs")
      .select("id, name")
      .in("id", [pase.from_club_id, pase.to_club_id].filter(Boolean) as string[]);
    const nombreOrigen =
      clubes?.find((c) => c.id === pase.from_club_id)?.name ?? "Jugador libre";
    const nombreDestino =
      clubes?.find((c) => c.id === pase.to_club_id)?.name ?? "Club destino";

    // 4) Derecho de pase: regla de la FEDERACIÓN por categoría del jugador
    //    (la de menor nivel = su base), tipo de pase y, si es préstamo por
    //    torneo, primero la regla especial del torneo.
    if (pase.to_club_id) {
      const { data: catsJugador } = await admin
        .from("player_categories")
        .select("category_id, categories(level_hierarchy)")
        .eq("player_id", pase.player_id);

      const categoriaBase = (catsJugador ?? [])
        .map((f) => ({
          category_id: f.category_id as string,
          nivel: (f.categories as unknown as { level_hierarchy: number } | null)
            ?.level_hierarchy ?? 999,
        }))
        .sort((a, b) => a.nivel - b.nivel)[0];

      if (categoriaBase) {
        let montoFee = 0;
        if (pase.competition_id) {
          const { data: reglaTorneo } = await admin
            .from("transfer_fees")
            .select("monto")
            .eq("category_id", categoriaBase.category_id)
            .eq("competition_id", pase.competition_id)
            .eq("tipo", pase.tipo_pase)
            .maybeSingle();
          montoFee = Number(reglaTorneo?.monto ?? 0);
        }
        if (montoFee === 0) {
          const { data: reglaGeneral } = await admin
            .from("transfer_fees")
            .select("monto")
            .eq("category_id", categoriaBase.category_id)
            .is("competition_id", null)
            .eq("tipo", pase.tipo_pase)
            .maybeSingle();
          montoFee = Number(reglaGeneral?.monto ?? 0);
        }

        if (montoFee > 0) {
          await admin.from("treasury_charges").insert({
            club_id: pase.to_club_id,
            tipo: "derecho_pase",
            descripcion: `Derecho de pase (${nombreTipoPase(pase.tipo_pase)}): ${nombreJugador(pase)} — ${nombreOrigen} → ${nombreDestino}`,
            monto: montoFee,
            transfer_id: transferId,
            creado_por: user.id,
          });
        }
      }
    }

    // 5) Deuda en modo "cobrar": la paga el club destino junto con el pase
    if (deudaCobradaEnPase && pase.to_club_id) {
      await admin.from("treasury_charges").insert({
        club_id: pase.to_club_id,
        tipo: "otro",
        descripcion: `Deuda asumida de ${nombreJugador(pase)} (declarada por ${nombreOrigen})${pase.deuda_descripcion ? ` — ${pase.deuda_descripcion}` : ""}`,
        monto: deudaMonto,
        creado_por: user.id,
      });
    }
  } catch {
    // silencioso: los cargos se pueden cargar a mano si fallan
  }

  await notificarClub(
    pase.to_club_id,
    `🎉 El ${nombreTipoPase(pase.tipo_pase)} de ${nombreJugador(pase)} quedó EFECTIVO (${numero ?? "sin número"}). Ya figura en tu plantel.`,
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

/** La liga marca la deuda bloqueante como saldada → el pase se puede completar. */
export async function marcarDeudaSaldada(transferId: string) {
  const { supabase } = await requireAdminPases();

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.deuda_modo !== "bloqueante") {
    return { error: "Este pase no tiene una deuda bloqueante." };
  }

  const { error } = await supabase
    .from("transfers")
    .update({
      deuda_saldada: true,
      metadata: { ...pase.metadata, deuda_saldada_at: new Date().toISOString() },
    })
    .eq("id", transferId);

  if (error) return { error: "No se pudo marcar la deuda como saldada." };
  revalidarPases();
  return { ok: true };
}

// ============================================================================
// FIRMA PÚBLICA DEL JUGADOR — 9B (sin login: el token del link es la llave)
// Documento de conformidad + firma dibujada + foto DNI (+ tutor si es menor)
// ============================================================================

/** Convierte un dataURL PNG (firma dibujada) en Buffer. Null si no es válido. */
function dataUrlABuffer(dataUrl: string): Buffer | null {
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

function extDeImagen(tipo: string, nombre?: string): string {
  if (tipo.includes("png")) return "png";
  if (tipo.includes("webp")) return "webp";
  if (tipo.includes("jpeg") || tipo.includes("jpg")) return "jpg";
  const ext = nombre?.split(".").pop()?.toLowerCase();
  return ext && ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
}

export async function firmarPasePublico9b(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const dni = String(formData.get("dni") ?? "").trim();
  const acepta = formData.get("acepta_documento");
  const firmaJugador = String(formData.get("firma_jugador") ?? "");
  const fotoDni = formData.get("foto_dni") as File | null;

  if (!token) return { error: "El link no es válido." };
  if (!acepta) {
    return { error: "Tenés que leer el documento y marcar “Sí, acepto” para firmar." };
  }
  if (!/^\d{6,10}$/.test(dni)) {
    return { error: "Ingresá tu DNI (entre 6 y 10 números, sin puntos)." };
  }

  const firmaBuffer = dataUrlABuffer(firmaJugador);
  if (!firmaBuffer || firmaBuffer.length < 500) {
    return { error: "Dibujá tu firma en el recuadro (con el dedo o el mouse)." };
  }
  if (!fotoDni || fotoDni.size === 0) {
    return { error: "Sacale una foto a tu DNI con la cámara (se usa para validar tu identidad)." };
  }
  if (fotoDni.size > 5 * 1024 * 1024) {
    return { error: "La foto del DNI no puede pesar más de 5 MB." };
  }

  const admin = createLfsAdminClient();

  // Datos del pase por el token (función definer, datos mínimos)
  const { data: datosPase } = await admin.rpc("obtener_pase_firma", { p_token: token });
  const pase = (Array.isArray(datosPase) ? datosPase[0] : datosPase) as
    | { transfer_id: string; es_menor: boolean; habilitada: boolean }
    | undefined;
  if (!pase) return { error: "El link no es válido. Pedile el link nuevo a tu club." };
  if (!pase.habilitada) {
    return { error: "Este link ya venció o el pase ya no está esperando la firma." };
  }

  // Si es menor de 18: bloque del tutor OBLIGATORIO
  let tutor: {
    parentesco: string;
    nombre: string;
    apellido: string;
    dni: string;
    firmaBuffer: Buffer;
    foto: File;
  } | null = null;

  if (pase.es_menor) {
    const parentesco = String(formData.get("tutor_parentesco") ?? "").trim();
    const nombre = String(formData.get("tutor_nombre") ?? "").trim();
    const apellido = String(formData.get("tutor_apellido") ?? "").trim();
    const tutorDni = String(formData.get("tutor_dni") ?? "").trim();
    const firmaTutor = String(formData.get("firma_tutor") ?? "");
    const fotoTutor = formData.get("foto_dni_tutor") as File | null;

    if (!parentesco || !nombre || !apellido || !/^\d{6,10}$/.test(tutorDni)) {
      return {
        error:
          "Sos menor de 18: tiene que completar todos los datos tu mamá, papá o tutor/a (parentesco, nombre, apellido y DNI).",
      };
    }
    const firmaTutorBuffer = dataUrlABuffer(firmaTutor);
    if (!firmaTutorBuffer || firmaTutorBuffer.length < 500) {
      return { error: "Falta la firma dibujada de tu mamá, papá o tutor/a." };
    }
    if (!fotoTutor || fotoTutor.size === 0) {
      return { error: "Falta la foto del DNI de tu mamá, papá o tutor/a." };
    }
    if (fotoTutor.size > 5 * 1024 * 1024) {
      return { error: "La foto del DNI del tutor no puede pesar más de 5 MB." };
    }
    tutor = { parentesco, nombre, apellido, dni: tutorDni, firmaBuffer: firmaTutorBuffer, foto: fotoTutor };
  }

  // Subir evidencias al bucket privado (carpeta firma/ dentro del pase)
  const stamp = Date.now();
  const base = `${pase.transfer_id}/firma`;
  const pathFirmaJugador = `${base}/firma-jugador-${stamp}.png`;
  const pathFotoJugador = `${base}/dni-jugador-${stamp}.${extDeImagen(fotoDni.type, fotoDni.name)}`;

  const subida1 = await admin.storage
    .from("documentos-pases")
    .upload(pathFirmaJugador, firmaBuffer, { contentType: "image/png" });
  if (subida1.error) return { error: "No se pudo guardar la firma. Probá de nuevo." };

  const subida2 = await admin.storage
    .from("documentos-pases")
    .upload(pathFotoJugador, fotoDni, { contentType: fotoDni.type || "image/jpeg" });
  if (subida2.error) return { error: "No se pudo guardar la foto del DNI. Probá de nuevo." };

  let pathFirmaTutor: string | null = null;
  let pathFotoTutor: string | null = null;
  if (tutor) {
    pathFirmaTutor = `${base}/firma-tutor-${stamp}.png`;
    pathFotoTutor = `${base}/dni-tutor-${stamp}.${extDeImagen(tutor.foto.type, tutor.foto.name)}`;

    const subida3 = await admin.storage
      .from("documentos-pases")
      .upload(pathFirmaTutor, tutor.firmaBuffer, { contentType: "image/png" });
    if (subida3.error) return { error: "No se pudo guardar la firma del tutor. Probá de nuevo." };

    const subida4 = await admin.storage
      .from("documentos-pases")
      .upload(pathFotoTutor, tutor.foto, { contentType: tutor.foto.type || "image/jpeg" });
    if (subida4.error) return { error: "No se pudo guardar la foto del DNI del tutor. Probá de nuevo." };
  }

  // Registrar la firma en la base (re-valida token, DNI, 72 hs y tutor)
  const { data, error } = await admin.rpc("firmar_pase_9b", {
    p_token: token,
    p_dni: dni,
    p_firma_path: pathFirmaJugador,
    p_foto_dni_path: pathFotoJugador,
    p_tutor_parentesco: tutor?.parentesco ?? null,
    p_tutor_nombre: tutor?.nombre ?? null,
    p_tutor_apellido: tutor?.apellido ?? null,
    p_tutor_dni: tutor?.dni ?? null,
    p_tutor_firma_path: pathFirmaTutor,
    p_tutor_foto_path: pathFotoTutor,
  });

  if (error) return { error: "No se pudo registrar la firma. Probá de nuevo." };
  if (data !== "OK") return { error: String(data) };

  revalidarPases();
  return { ok: true };
}

/**
 * @deprecated Firma simple del Paso 9 (solo DNI). Se mantiene para que el
 * componente viejo FormularioFirmaPublica siga compilando; la firma real
 * del Paso 9B es firmarPasePublico9b (documento + firma dibujada + fotos).
 */
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

/**
 * El jugador RECHAZA el pase desde el link de firma, con un motivo que
 * queda visible para todas las partes (clubes y liga).
 */
export async function rechazarPaseJugadorAction(token: string, dni: string, motivo: string) {
  const limpioToken = token.trim();
  const limpioDni = dni.trim();
  const limpioMotivo = motivo.trim();

  if (!limpioToken) return { error: "El link no es válido." };
  if (!/^\d{6,10}$/.test(limpioDni)) {
    return { error: "Ingresá tu DNI (entre 6 y 10 números, sin puntos)." };
  }
  if (limpioMotivo.length < 10) {
    return { error: "Contanos el motivo del rechazo (mínimo 10 letras)." };
  }

  const admin = createLfsAdminClient();

  // Traer el pase ANTES de rechazarlo (después el token ya no sirve) para
  // poder avisar a los dos clubes por la mensajería interna.
  const { data: pase } = await admin
    .from("transfers")
    .select("id, from_club_id, to_club_id, players(first_name, last_name)")
    .filter("metadata->>firma_token", "eq", limpioToken)
    .maybeSingle();

  const { data, error } = await admin.rpc("rechazar_pase_jugador", {
    p_token: limpioToken,
    p_dni: limpioDni,
    p_motivo: limpioMotivo,
  });

  if (error) return { error: "No se pudo registrar el rechazo. Probá de nuevo." };
  if (data !== "OK") return { error: String(data) };

  // Aviso a ambos clubes (remitente: el primer admin de la liga)
  try {
    const { data: adminLiga } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();
    if (adminLiga && pase) {
      const pl = pase.players as unknown as { first_name: string; last_name: string } | null;
      const nombre = pl ? `${pl.last_name}, ${pl.first_name}` : "el jugador";
      const texto = `🚫 ${nombre} RECHAZÓ el pase desde el link de firma. Motivo: ${limpioMotivo}`;
      await notificarClub(pase.from_club_id as string | null, texto, adminLiga.id);
      await notificarClub(pase.to_club_id as string | null, texto, adminLiga.id);
    }
  } catch {
    // silencioso: el rechazo ya quedó registrado
  }

  revalidarPases();
  return { ok: true };
}

// ============================================================================
// RESCISIÓN DE PRÉSTAMO (9B): SOLO el club destino, con RECARGO a la liga
// ============================================================================

export async function rescindirPrestamo(transferId: string) {
  const { supabase, user, clubId } = await requireClubPases();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role === "admin") {
    return { error: "La rescisión anticipada la hace únicamente el club destino (con recargo)." };
  }

  const pase = await obtenerPase(supabase, transferId);
  if (!pase) return { error: "El pase no existe." };
  if (pase.status !== "7_COMPLETED" || pase.tipo_pase !== "prestamo") {
    return { error: "Solo se puede rescindir un préstamo efectivo." };
  }
  if (pase.metadata.devuelto_at) {
    return { error: "Este préstamo ya terminó (el jugador volvió a su club)." };
  }
  if (pase.to_club_id !== clubId) {
    return { error: "Solo el club que recibió el préstamo puede rescindirlo." };
  }

  // Recargo configurado por la liga
  const { data: settings } = await supabase
    .from("pase_settings")
    .select("recargo_rescision")
    .eq("id", 1)
    .single();
  const recargo = Number(settings?.recargo_rescision ?? 0);

  // El jugador vuelve al club de origen
  if (pase.from_club_id && pase.to_club_id) {
    const { error: errorMov } = await supabase
      .from("player_categories")
      .update({ club_id: pase.from_club_id })
      .eq("player_id", pase.player_id)
      .eq("club_id", pase.to_club_id);
    if (errorMov) return { error: "No se pudo devolver al jugador al club de origen." };
  }

  const { error } = await supabase
    .from("transfers")
    .update({
      metadata: {
        ...pase.metadata,
        devuelto_at: new Date().toISOString(),
        devolucion: "rescision",
        rescindido_por: user.id,
      },
    })
    .eq("id", transferId);
  if (error) return { error: "No se pudo registrar la rescisión." };

  // Cargo de recargo para el club destino (la plata es de la liga)
  if (recargo > 0 && pase.to_club_id) {
    try {
      const admin = createLfsAdminClient();
      await admin.from("treasury_charges").insert({
        club_id: pase.to_club_id,
        tipo: "otro",
        descripcion: `Recargo por rescisión anticipada de préstamo: ${nombreJugador(pase)}`,
        monto: recargo,
        creado_por: user.id,
      });
    } catch {
      // silencioso: el cargo se puede cargar a mano
    }
  }

  await notificarClub(
    pase.from_club_id,
    `🔙 El club destino RESCINDIÓ el préstamo de ${nombreJugador(pase)} antes de tiempo: el jugador ya volvió a tu plantel.`,
    user.id
  );

  revalidarPases();
  revalidatePath("/admin/tesoreria/movimientos");
  return { ok: true };
}

// ============================================================================
// PROCESO AUTOMÁTICO (9B): trabados, avisos y retornos de préstamo.
// Lo puede disparar cualquier usuario con sesión al abrir Trámites;
// la función de la base es la que hace el trabajo (con pg_cron si está).
// ============================================================================

export async function procesarAutomaticosPases() {
  const { supabase, user } = await requireClubPases();

  const { data: acciones, error } = await supabase.rpc("procesar_pases_automaticos");
  if (error || !Array.isArray(acciones) || acciones.length === 0) {
    return { ok: true, procesadas: 0 };
  }

  for (const a of acciones as {
    accion: string;
    transfer_id: string;
    club_origen_id: string | null;
    club_destino_id: string | null;
    jugador: string;
    detalle: string;
  }[]) {
    try {
      if (a.accion === "cancelado_trabado") {
        await notificarClub(a.club_origen_id, `⏱️ Pase de ${a.jugador}: ${a.detalle}`, user.id);
        await notificarClub(a.club_destino_id, `⏱️ Pase de ${a.jugador}: ${a.detalle}`, user.id);
      } else if (a.accion === "aviso_retorno") {
        await notificarClub(a.club_destino_id, `⏳ ${a.detalle}`, user.id);
      } else if (a.accion === "retorno_prestamo") {
        await notificarClub(a.club_origen_id, `🔙 ${a.detalle}`, user.id);
        await notificarClub(a.club_destino_id, `🔙 ${a.detalle}`, user.id);
      }
    } catch {
      // silencioso
    }
  }

  return { ok: true, procesadas: acciones.length };
}

// ============================================================================
// CONFIGURACIÓN DEL MÓDULO (9B, solo admin)
// ============================================================================

export async function guardarPaseSettings(formData: FormData) {
  const { supabase } = await requireAdminPases();

  const tenencia = Number(formData.get("tenencia_anios"));
  const recargo = Number(formData.get("recargo_rescision"));
  const alerta = Number(formData.get("alerta_trabado_horas"));
  const cancelacion = Number(formData.get("cancelacion_trabado_horas"));
  const avisoRetorno = Number(formData.get("aviso_retorno_horas"));

  if (!Number.isInteger(tenencia) || tenencia < 0 || tenencia > 5) {
    return { error: "La tenencia tiene que ser un número de años entre 0 y 5." };
  }
  if (Number.isNaN(recargo) || recargo < 0) {
    return { error: "El recargo por rescisión no puede ser negativo." };
  }
  for (const [nombre, valor] of [
    ["alerta", alerta],
    ["cancelación", cancelacion],
    ["aviso de retorno", avisoRetorno],
  ] as const) {
    if (!Number.isInteger(valor) || valor < 1 || valor > 720) {
      return { error: `Las horas de ${nombre} tienen que ser un número entre 1 y 720.` };
    }
  }
  if (cancelacion <= alerta) {
    return { error: "La cancelación automática tiene que ser más tarde que la alerta (ej: alerta 48 hs, cancelación 72 hs)." };
  }

  const { error } = await supabase
    .from("pase_settings")
    .update({
      tenencia_anios: tenencia,
      recargo_rescision: recargo,
      alerta_trabado_horas: alerta,
      cancelacion_trabado_horas: cancelacion,
      aviso_retorno_horas: avisoRetorno,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { error: "No se pudo guardar la configuración." };
  revalidarPases();
  return { ok: true };
}

/** Rangos de años de nacimiento por categoría (se editan una vez al año). */
export async function guardarRangosCategorias(
  rangos: { id: string; anio_desde: number | null; anio_hasta: number | null }[]
) {
  const { supabase } = await requireAdminPases();
  const anioActual = new Date().getFullYear();

  for (const r of rangos) {
    const tieneDesde = r.anio_desde !== null && Number.isInteger(r.anio_desde);
    const tieneHasta = r.anio_hasta !== null && Number.isInteger(r.anio_hasta);
    if (tieneDesde !== tieneHasta) {
      return { error: "Completá los dos años del rango (desde y hasta) o dejá los dos vacíos." };
    }
    if (tieneDesde && tieneHasta) {
      if ((r.anio_desde as number) < 1950 || (r.anio_hasta as number) > anioActual) {
        return { error: `Los años tienen que estar entre 1950 y ${anioActual}.` };
      }
      if ((r.anio_desde as number) > (r.anio_hasta as number)) {
        return { error: "El año “desde” no puede ser mayor que el año “hasta”." };
      }
    }
  }

  for (const r of rangos) {
    const { error } = await supabase
      .from("categories")
      .update({ anio_desde: r.anio_desde, anio_hasta: r.anio_hasta })
      .eq("id", r.id);
    if (error) return { error: "No se pudieron guardar los rangos de las categorías." };
  }

  revalidarPases();
  return { ok: true };
}

/** Derecho de pase por categoría/tipo (y opcionalmente por torneo). */
export async function guardarFeePase(formData: FormData) {
  const { supabase } = await requireAdminPases();

  const categoryId = String(formData.get("category_id") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const competitionId = String(formData.get("competition_id") ?? "") || null;
  const monto = Number(formData.get("monto"));

  if (!categoryId) return { error: "Elegí la categoría." };
  if (tipo !== "definitivo" && tipo !== "prestamo") {
    return { error: "Elegí el tipo de pase (definitivo o préstamo)." };
  }
  if (Number.isNaN(monto) || monto < 0) {
    return { error: "El monto no puede ser negativo (0 = no se cobra)." };
  }

  // Upsert manual: actualizar la regla existente o crear una nueva
  let consulta = supabase
    .from("transfer_fees")
    .update({ monto })
    .eq("category_id", categoryId)
    .eq("tipo", tipo);
  consulta = competitionId
    ? consulta.eq("competition_id", competitionId)
    : consulta.is("competition_id", null);
  const { data: actualizadas, error: errorUpdate } = await consulta.select("id");

  if (errorUpdate) return { error: "No se pudo guardar la regla de derecho de pase." };

  if (!actualizadas || actualizadas.length === 0) {
    const { error } = await supabase.from("transfer_fees").insert({
      category_id: categoryId,
      competition_id: competitionId,
      tipo,
      monto,
    });
    if (error) return { error: "Ya existe una regla para esa combinación de categoría, tipo y torneo." };
  }

  revalidarPases();
  return { ok: true };
}

export async function eliminarFeePase(feeId: string) {
  const { supabase } = await requireAdminPases();

  const { error } = await supabase.from("transfer_fees").delete().eq("id", feeId);
  if (error) return { error: "No se pudo eliminar la regla." };
  revalidarPases();
  return { ok: true };
}

// ============================================================================
// PASES HISTÓRICOS EN PAPEL (9B): SOLO del año anterior, los carga la liga.
// Queda el registro SIN mover jugadores ni generar cargos.
// ============================================================================

export async function cargarPaseHistorico(formData: FormData) {
  const { supabase, user } = await requireAdminPases();

  const dni = String(formData.get("dni") ?? "").trim();
  const fecha = String(formData.get("fecha") ?? "").trim();
  const fromClubId = String(formData.get("from_club_id") ?? "") || null;
  const toClubId = String(formData.get("to_club_id") ?? "");
  const tipo = String(formData.get("tipo_pase") ?? "definitivo");
  const fechaRetorno = String(formData.get("fecha_retorno") ?? "") || null;
  const nroPapel = String(formData.get("nro_papel") ?? "").trim();

  if (!/^\d{6,10}$/.test(dni)) {
    return { error: "El DNI debe tener entre 6 y 10 números, sin puntos ni letras." };
  }
  if (!fecha) return { error: "Falta la fecha del pase en papel." };

  const anioPase = Number(fecha.slice(0, 4));
  const anioPermitido = new Date().getFullYear() - 1;
  if (anioPase !== anioPermitido) {
    return { error: `Los pases históricos en papel solo pueden ser del año ${anioPermitido}.` };
  }
  if (!toClubId) return { error: "Elegí el club destino." };
  if (fromClubId === toClubId) {
    return { error: "El club de origen y el de destino no pueden ser el mismo." };
  }
  if (tipo === "prestamo" && !fechaRetorno) {
    return { error: "Si fue un préstamo, anotá la fecha de retorno." };
  }

  const { data: jugador } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("dni", dni)
    .maybeSingle();
  if (!jugador) {
    return { error: "No existe ningún jugador con ese DNI. Primero hay que darlo de alta." };
  }

  const { error } = await supabase.from("transfers").insert({
    player_id: jugador.id,
    from_club_id: fromClubId,
    to_club_id: toClubId,
    status: "7_COMPLETED",
    tipo_pase: tipo === "prestamo" ? "prestamo" : "definitivo",
    fecha_retorno: tipo === "prestamo" ? fechaRetorno : null,
    metadata: {
      historico: true,
      nro_papel: nroPapel || null,
      completado_at: new Date(`${fecha}T12:00:00`).toISOString(),
      cargado_por: user.id,
      cargado_at: new Date().toISOString(),
    },
  });

  if (error) return { error: "No se pudo cargar el pase histórico." };

  revalidarPases();
  return { ok: true, jugador: `${jugador.last_name}, ${jugador.first_name}` };
}

// ============================================================================
// FICHA DEL JUGADOR (9B): foto + fecha de nacimiento (club dueño o liga)
// ============================================================================

/** Sube (o reemplaza) la foto del jugador. Carpeta = club dueño. */
export async function subirFotoJugador(playerId: string, formData: FormData) {
  const { supabase, user, clubId } = await requireClubPases();

  const archivo = formData.get("foto") as File | null;
  if (!archivo || archivo.size === 0) return { error: "Elegí una foto." };
  if (!archivo.type.startsWith("image/")) {
    return { error: "El archivo tiene que ser una imagen (JPG, PNG o WebP)." };
  }
  if (archivo.size > 5 * 1024 * 1024) {
    return { error: "La foto no puede pesar más de 5 MB." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const esAdmin = profile?.role === "admin";

  // Carpeta = club dueño actual del jugador
  let clubDuenio = clubId;
  if (esAdmin) {
    const { data: vinculo } = await supabase
      .from("player_categories")
      .select("club_id")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    clubDuenio = (vinculo?.club_id as string | null) ?? null;
  }
  if (!clubDuenio) {
    return { error: "El jugador no está en ningún club: la foto la puede subir su club." };
  }

  const ext = extDeImagen(archivo.type, archivo.name);
  const path = `${clubDuenio}/${playerId}.${ext}`;

  const { error: errorSubida } = await supabase.storage
    .from("fotos-jugadores")
    .upload(path, archivo, { contentType: archivo.type, upsert: true });
  if (errorSubida) return { error: "No se pudo subir la foto." };

  const { data, error } = await supabase.rpc("club_actualizar_jugador", {
    p_player_id: playerId,
    p_foto_path: path,
  });
  if (error || data !== "OK") {
    return { error: error ? "No se pudo vincular la foto al jugador." : String(data) };
  }

  revalidatePath("/club/planteles");
  revalidatePath("/admin/equipos");
  revalidatePath("/transferencias");
  return { ok: true };
}

/** Guarda la fecha de nacimiento del jugador (define su categoría y si es menor). */
export async function guardarNacimientoJugador(playerId: string, fecha: string) {
  const { supabase } = await requireClubPases();

  const limpia = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpia)) {
    return { error: "La fecha de nacimiento no es válida." };
  }
  const nac = new Date(`${limpia}T00:00:00`);
  const ahora = new Date();
  if (Number.isNaN(nac.getTime())) return { error: "La fecha de nacimiento no es válida." };
  if (nac > ahora) return { error: "La fecha de nacimiento no puede ser futura." };
  if (ahora.getFullYear() - nac.getFullYear() > 80) {
    return { error: "Revisá la fecha de nacimiento: parece demasiado antigua." };
  }

  const { data, error } = await supabase.rpc("club_actualizar_jugador", {
    p_player_id: playerId,
    p_fecha_nacimiento: limpia,
  });
  if (error || data !== "OK") {
    return { error: error ? "No se pudo guardar la fecha de nacimiento." : String(data) };
  }

  revalidatePath("/club/planteles");
  revalidatePath("/admin/equipos");
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
// BAJA DE JUGADOR (queda libre, con registro; 9B: exige tenencia cumplida)
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
