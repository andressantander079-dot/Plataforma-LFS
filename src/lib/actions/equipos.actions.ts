"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  anioDeFecha,
  validarCategoriasPorAnio,
  type CategoriaConRango,
} from "@/lib/core/rules/jugadoresRules";

/**
 * ACCIONES DEL MÓDULO EQUIPOS (Pasos 2 y 4)
 * Se ejecutan en el servidor de forma segura.
 * Nunca exponen claves ni permiten operaciones a usuarios sin rol admin.
 */

type ActionResult = { ok: boolean; error?: string; aviso?: string };

interface Representante {
  full_name: string;
  dni: string;
  phone: string;
  cargo: string;
}

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

// Crea el usuario de acceso del club y lo vincula (usa la clave service_role)
async function crearUsuarioClub(
  clubId: string,
  clubName: string,
  email: string,
  password: string
): Promise<{ error?: string }> {
  const admin = createLfsAdminClient();

  const { data: nuevoUsuario, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: clubName },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes("already")) {
      return { error: `El correo ${email} ya está registrado en el sistema.` };
    }
    return { error: `No se pudo crear el usuario: ${authError.message}` };
  }

  // Vincular el perfil con el club (el trigger ya creó la fila de profile)
  const { error: linkError } = await admin
    .from("profiles")
    .update({ club_id: clubId, full_name: clubName })
    .eq("id", nuevoUsuario.user.id);

  if (linkError) {
    return { error: `El usuario se creó pero no se vinculó al club: ${linkError.message}` };
  }

  return {};
}

// ---------- CREAR CLUB (con representantes extra y credenciales opcionales) ----------
export async function crearClub(formData: FormData): Promise<ActionResult> {
  const name = texto(formData, "name");
  const president_name = texto(formData, "president_name");
  const president_dni = texto(formData, "president_dni");
  const president_phone = texto(formData, "president_phone");
  const treasurer_name = texto(formData, "treasurer_name");
  const treasurer_dni = texto(formData, "treasurer_dni");
  const treasurer_phone = texto(formData, "treasurer_phone");
  const status = texto(formData, "status") || "inhabilitado";
  const club_email = texto(formData, "club_email");
  const club_password = texto(formData, "club_password");

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

  // Credenciales: o las dos completas o ninguna
  if ((club_email && !club_password) || (!club_email && club_password)) {
    return { ok: false, error: "Para asignar credenciales, completá el email Y la contraseña." };
  }
  if (club_password && club_password.length < 6) {
    return { ok: false, error: "La contraseña del club debe tener al menos 6 caracteres." };
  }

  // Representantes extra (vienen como JSON desde el formulario)
  let representantes: Representante[] = [];
  const repsRaw = texto(formData, "representantes");
  if (repsRaw) {
    try {
      representantes = JSON.parse(repsRaw) as Representante[];
    } catch {
      return { ok: false, error: "Los datos de los representantes llegaron con un formato inválido." };
    }
  }

  const { supabase, error } = await requireAdmin();
  if (error) return { ok: false, error };

  // 1. Crear el club
  const { data: club, error: dbError } = await supabase
    .from("clubs")
    .insert({
      name,
      president_name,
      president_dni,
      president_phone,
      treasurer_name,
      treasurer_dni,
      treasurer_phone,
      status,
    })
    .select("id")
    .single();

  if (dbError) {
    if (dbError.code === "23505") {
      return { ok: false, error: `Ya existe un club llamado "${name}".` };
    }
    return { ok: false, error: `Error de base de datos: ${dbError.message}` };
  }

  const avisos: string[] = [];

  // 2. Guardar los representantes extra
  const repsValidos = representantes.filter(
    (r) => r.full_name.trim() && r.dni.trim() && r.phone.trim()
  );
  if (repsValidos.length > 0) {
    const { error: repsError } = await supabase.from("club_representatives").insert(
      repsValidos.map((r) => ({
        club_id: club.id,
        full_name: r.full_name.trim(),
        dni: r.dni.trim(),
        phone: r.phone.trim(),
        cargo: r.cargo || "Delegado",
      }))
    );
    if (repsError) {
      avisos.push(`El club se creó pero fallaron los representantes: ${repsError.message}`);
    }
  }

  // 3. Crear las credenciales de acceso (si se completaron)
  if (club_email && club_password) {
    const { error: credError } = await crearUsuarioClub(
      club.id,
      name,
      club_email,
      club_password
    );
    if (credError) {
      avisos.push(`El club se creó pero fallaron las credenciales: ${credError}`);
    }
  }

  revalidatePath("/admin/equipos");
  return {
    ok: true,
    aviso: avisos.length > 0 ? avisos.join(" | ") : undefined,
  };
}

// ---------- ASIGNAR CREDENCIALES A UN CLUB EXISTENTE ----------
export async function asignarCredencialesClub(
  clubId: string,
  formData: FormData
): Promise<ActionResult> {
  const email = texto(formData, "email");
  const password = texto(formData, "password");

  if (!email || !password) {
    return { ok: false, error: "Completá el email y la contraseña." };
  }
  if (password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const { supabase, error } = await requireAdmin();
  if (error) return { ok: false, error };

  const { data: club } = await supabase
    .from("clubs")
    .select("name")
    .eq("id", clubId)
    .single();

  if (!club) return { ok: false, error: "El club no existe." };

  const { error: credError } = await crearUsuarioClub(clubId, club.name, email, password);
  if (credError) return { ok: false, error: credError };

  revalidatePath(`/admin/equipos/${clubId}/plantel`);
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
  const fecha_nacimiento = texto(formData, "fecha_nacimiento");
  const categoryIds = formData.getAll("categoryIds").map(String);

  if (!first_name || !last_name || !dni) {
    return { ok: false, error: "Completá nombre, apellido y DNI." };
  }
  if (!/^\d{6,10}$/.test(dni)) {
    return { ok: false, error: "El DNI debe tener entre 6 y 10 números, sin puntos ni letras." };
  }

  // Fecha de nacimiento OBLIGATORIA (Paso 9B): define la categoría por año
  if (!fecha_nacimiento) {
    return { ok: false, error: "Cargá la fecha de nacimiento: define en qué categoría juega." };
  }
  const nac = new Date(`${fecha_nacimiento}T00:00:00`);
  if (Number.isNaN(nac.getTime()) || !anioDeFecha(fecha_nacimiento)) {
    return { ok: false, error: "La fecha de nacimiento no es válida." };
  }
  if (nac > new Date()) {
    return { ok: false, error: "La fecha de nacimiento no puede ser futura." };
  }

  if (categoryIds.length === 0) {
    return { ok: false, error: "Asigná al menos una categoría al jugador." };
  }

  const { supabase, error } = await requireAdmin();
  if (error) return { ok: false, error };

  // Validación por año de nacimiento (Paso 9B): si las categorías tienen
  // rango de años configurado, la categoría base tiene que ser la de su año
  // (puede jugar también en categorías MAYORES, nunca en menores).
  const { data: categorias } = await supabase
    .from("categories")
    .select("id, name, level_hierarchy, anio_desde, anio_hasta");

  const validacionAnio = validarCategoriasPorAnio(
    anioDeFecha(fecha_nacimiento) as number,
    categoryIds,
    (categorias ?? []) as CategoriaConRango[]
  );
  if (!validacionAnio.ok) {
    return { ok: false, error: validacionAnio.error };
  }

  // 1. Crear el jugador (el DNI es único en toda la liga)
  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ dni, first_name, last_name, fecha_nacimiento })
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
