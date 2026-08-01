"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

/**
 * ACCIONES DEL MÓDULO EQUIPOS (Paso 2)
 * Se ejecutan en el servidor de forma segura.
 * Nunca exponen claves ni permiten operaciones a usuarios sin rol admin.
 */

type ActionResult = { ok: boolean; error?: string };

// Verifica que haya sesión y que el usuario sea admin
async function requireAdmin() {
    const supabase = await createLfsServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { supabase, error: "No hay sesión activa. Iniciá sesión nuevamente." };
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin") {
        return { supabase, error: "Solo el administrador puede realizar esta operación." };
    }

    return { supabase, error: null };
}

function texto(formData: FormData, campo: string): string {
    return String(formData.get(campo) ?? "").trim();
}

// ---------- CREAR CLUB ----------
export async function crearClub(formData: FormData): Promise<ActionResult> {
    const name = texto(formData, "name");
    const president_name = texto(formData, "president_name");
    const president_dni = texto(formData, "president_dni");
    const president_phone = texto(formData, "president_phone");
    const treasurer_name = texto(formData, "treasurer_name");
    const treasurer_dni = texto(formData, "treasurer_dni");
    const treasurer_phone = texto(formData, "treasurer_phone");
    const status = texto(formData, "status") || "inhabilitado";

    if (
        !name || !president_name || !president_dni || !president_phone ||
        !treasurer_name || !treasurer_dni || !treasurer_phone
    ) {
        return { ok: false, error: "Completá todos los campos obligatorios." };
    }

    const estadosValidos = ["inhabilitado", "en_revision", "habilitado"];
    if (!estadosValidos.includes(status)) {
        return { ok: false, error: "Estado de habilitación inválido." };
    }

    const { supabase, error } = await requireAdmin();
    if (error) return { ok: false, error };

    const { error: dbError } = await supabase.from("clubs").insert({
        name,
        president_name,
        president_dni,
        president_phone,
        treasurer_name,
        treasurer_dni,
        treasurer_phone,
        status,
    });

    if (dbError) {
        if (dbError.code === "23505") {
            return { ok: false, error: `Ya existe un club llamado "${name}".` };
        }
        return { ok: false, error: `Error de base de datos: ${dbError.message}` };
    }

    revalidatePath("/admin/equipos");
    return { ok: true };
}

// ---------- INSCRIBIR JUGADOR ----------
export async function inscribirJugador(
    clubId: string,
    formData: FormData
): Promise<ActionResult> {
    const first_name = texto(formData, "first_name");
    const last_name = texto(formData, "last_name");
    const dni = texto(formData, "dni");
    const categoryIds = formData.getAll("categoryIds").map(String);

    if (!first_name || !last_name || !dni) {
        return { ok: false, error: "Completá nombre, apellido y DNI." };
    }
    if (!/^\d{6,10}$/.test(dni)) {
        return { ok: false, error: "El DNI debe tener entre 6 y 10 números, sin puntos ni letras." };
    }
    if (categoryIds.length === 0) {
        return { ok: false, error: "Asigná al menos una categoría al jugador." };
    }

    const { supabase, error } = await requireAdmin();
    if (error) return { ok: false, error };

    // 1. Crear el jugador (el DNI es único en toda la liga)
    const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({ dni, first_name, last_name })
        .select("id")
        .single();

    if (playerError) {
        if (playerError.code === "23505") {
            return {
                ok: false,
                error: `Ya existe un jugador con el DNI ${dni}. Si cambió de club, corresponde un pase (módulo Trámites).`,
            };
        }
        return { ok: false, error: `Error al crear el jugador: ${playerError.message}` };
    }

    // 2. Vincularlo a las categorías seleccionadas dentro de este club
    const vinculos = categoryIds.map((category_id) => ({
        player_id: player.id,
        category_id,
        club_id: clubId,
    }));

    const { error: linkError } = await supabase
        .from("player_categories")
        .insert(vinculos);

    if (linkError) {
        return {
            ok: false,
            error: `El jugador se creó pero falló la asignación de categorías: ${linkError.message}`,
        };
    }

    revalidatePath(`/admin/equipos/${clubId}/plantel`);
    return { ok: true };
}