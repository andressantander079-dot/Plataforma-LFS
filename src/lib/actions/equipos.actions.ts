"use server";

import { revalidatePath } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  anioDeFecha,
  validarCategoriasPorAnio,
  DOCUMENTOS_INSCRIPCION,
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

// Verifica sesión y que el usuario sea admin O el club dueño del clubId (Paso 10:
// el club inscribe sus propios jugadores; la liga sigue pudiendo en cualquier club)
async function requireAdminOClubDuenio(clubId: string) {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, error: "No hay sesión activa. Iniciá sesión nuevamente." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, club_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    return { supabase, error: null };
  }
  if (profile?.role === "club" && profile.club_id === clubId) {
    return { supabase, error: null };
  }
  return {
    supabase,
    error: "Solo la liga o el propio club pueden inscribir jugadores en este plantel.",
  };
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

  // Foto OBLIGATORIA (Paso 10B): es la cara del jugador en planillas y pases
  const foto = formData.get("foto") as File | null;
  if (!foto || foto.size === 0) {
    return { ok: false, error: "Falta la foto del jugador (obligatoria para inscribirlo)." };
  }
  if (!foto.type.startsWith("image/")) {
    return { ok: false, error: "La foto tiene que ser una imagen (JPG, PNG o WebP)." };
  }
  if (foto.size > 5 * 1024 * 1024) {
    return { ok: false, error: "La foto no puede pesar más de 5 MB." };
  }

  // Documentos OBLIGATORIOS de inscripción (Paso 10B):
  // DNI + CEMAD médico + CEMAD de autorización + comprobante de federación
  const documentosArchivos: { clave: string; archivo: File }[] = [];
  for (const doc of DOCUMENTOS_INSCRIPCION) {
    const archivo = formData.get(`doc_${doc.clave}`) as File | null;
    if (!archivo || archivo.size === 0) {
      return { ok: false, error: `Falta el documento obligatorio: ${doc.nombre}.` };
    }
    const esImagen = archivo.type.startsWith("image/");
    const esPdf = archivo.type === "application/pdf";
    if (!esImagen && !esPdf) {
      return { ok: false, error: `El documento "${doc.nombre}" tiene que ser PDF o imagen.` };
    }
    if (archivo.size > 5 * 1024 * 1024) {
      return { ok: false, error: `El documento "${doc.nombre}" no puede pesar más de 5 MB.` };
    }
    documentosArchivos.push({ clave: doc.clave, archivo });
  }

  // Paso 10: la liga inscribe en cualquier club; el club solo en el suyo
  const { supabase, error } = await requireAdminOClubDuenio(clubId);
  if (error) return { ok: false, error };

  // Validación por año de nacimiento — REGLA ESTRICTA (Paso 10B): si las
  // categorías tienen rango de años configurado, el jugador se inscribe SOLO
  // en la categoría de su año (ni más grande ni más chica). Jugar "para
  // arriba" se permite en la planilla del partido, no en la inscripción.
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

  // Planteles (Paso 10B): primero hay que CREAR el plantel de la categoría
  const { data: planteles } = await supabase
    .from("club_planteles")
    .select("category_id")
    .eq("club_id", clubId)
    .in("category_id", categoryIds);

  const conPlantel = new Set((planteles ?? []).map((p) => p.category_id as string));
  const sinPlantel = (categorias ?? []).filter(
    (c) => categoryIds.includes(c.id as string) && !conPlantel.has(c.id as string)
  );
  if (sinPlantel.length > 0) {
    const nombres = sinPlantel.map((c) => c.name as string).join(", ");
    return {
      ok: false,
      error: `Primero creá el plantel de ${nombres} desde la pantalla de Planteles, y después inscribí al jugador ahí.`,
    };
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

  // 3. Subir la foto y los 4 documentos obligatorios, y vincular todo al
  //    jugador. Si algo falla, se deshace el alta completo (jugador, vínculos
  //    y archivos) para no dejar inscripciones a medias.
  const admin = createLfsAdminClient();

  const extFoto = foto.type.includes("png")
    ? "png"
    : foto.type.includes("webp")
      ? "webp"
      : "jpg";
  const fotoPath = `${clubId}/${player.id}.${extFoto}`;

  const { error: errorFoto } = await supabase.storage
    .from("fotos-jugadores")
    .upload(fotoPath, foto, { contentType: foto.type, upsert: true });

  if (errorFoto) {
    await admin.from("player_categories").delete().eq("player_id", player.id);
    await admin.from("players").delete().eq("id", player.id);
    return {
      ok: false,
      error: "No se pudo subir la foto y no se inscribió al jugador. Probá con otra foto.",
    };
  }

  // Subir los documentos al bucket privado (misma convención del Paso 3)
  const documents: Record<string, string> = {};
  for (const { clave, archivo } of documentosArchivos) {
    const ext = archivo.type === "application/pdf"
      ? "pdf"
      : archivo.type.includes("png")
        ? "png"
        : archivo.type.includes("webp")
          ? "webp"
          : "jpg";
    const ruta = `${clubId}/${player.id}/${clave}.${ext}`;
    const { error: errorDoc } = await supabase.storage
      .from("documentos-jugadores")
      .upload(ruta, archivo, { contentType: archivo.type, upsert: true });
    if (errorDoc) {
      const nombreDoc = DOCUMENTOS_INSCRIPCION.find((d) => d.clave === clave)?.nombre ?? clave;
      await admin.from("player_categories").delete().eq("player_id", player.id);
      await admin.from("players").delete().eq("id", player.id);
      return {
        ok: false,
        error: `No se pudo subir el documento "${nombreDoc}" y no se inscribió al jugador. Probá de nuevo.`,
      };
    }
    documents[clave] = ruta;
  }

  const { data: dataFoto, error: errorRpc } = await supabase.rpc(
    "club_actualizar_jugador",
    { p_player_id: player.id, p_foto_path: fotoPath, p_documents: documents }
  );
  if (errorRpc || dataFoto !== "OK") {
    await admin.from("player_categories").delete().eq("player_id", player.id);
    await admin.from("players").delete().eq("id", player.id);
    return {
      ok: false,
      error: "No se pudo vincular la documentación y no se inscribió al jugador. Probá de nuevo.",
    };
  }

  revalidatePath(`/admin/equipos/${clubId}/plantel`);
  revalidatePath(`/club/planteles`);
  return { ok: true };
}


// ---------- PLANTELES POR CATEGORÍA (Paso 10B) ----------
// Primero se crea el plantel de una categoría; recién después se puede
// inscribir jugadores en ella. Doble rol: la liga en cualquier club,
// el club solo en el suyo.

export async function crearPlantel(
  clubId: string,
  categoryId: string
): Promise<ActionResult> {
  if (!clubId || !categoryId) {
    return { ok: false, error: "Falta elegir la categoría del plantel." };
  }

  const { supabase, error } = await requireAdminOClubDuenio(clubId);
  if (error) return { ok: false, error };

  const { error: insertError } = await supabase
    .from("club_planteles")
    .insert({ club_id: clubId, category_id: categoryId });

  if (insertError) {
    if (insertError.code === "23505") {
      return { ok: false, error: "Ese plantel ya existe." };
    }
    return { ok: false, error: `No se pudo crear el plantel: ${insertError.message}` };
  }

  revalidatePath(`/admin/equipos/${clubId}/plantel`);
  revalidatePath(`/club/planteles`);
  return { ok: true };
}

export async function eliminarPlantel(plantelId: string): Promise<ActionResult> {
  if (!plantelId) return { ok: false, error: "Falta el plantel." };

  // Buscar el plantel para validar permisos sobre SU club
  const supabaseLectura = await createLfsServerClient();
  const { data: plantel } = await supabaseLectura
    .from("club_planteles")
    .select("id, club_id, category_id")
    .eq("id", plantelId)
    .maybeSingle();

  if (!plantel) return { ok: false, error: "El plantel no existe." };

  const { supabase, error } = await requireAdminOClubDuenio(plantel.club_id);
  if (error) return { ok: false, error };

  // Solo se puede eliminar un plantel VACÍO (sin jugadores inscriptos)
  const { count } = await supabase
    .from("player_categories")
    .select("player_id", { count: "exact", head: true })
    .eq("club_id", plantel.club_id)
    .eq("category_id", plantel.category_id);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "El plantel tiene jugadores: primero dales de baja o pasalos a otro club.",
    };
  }

  const { error: deleteError } = await supabase
    .from("club_planteles")
    .delete()
    .eq("id", plantelId);

  if (deleteError) {
    return { ok: false, error: `No se pudo eliminar el plantel: ${deleteError.message}` };
  }

  revalidatePath(`/admin/equipos/${plantel.club_id}/plantel`);
  revalidatePath(`/club/planteles`);
  return { ok: true };
}
