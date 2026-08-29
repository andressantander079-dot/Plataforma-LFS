"use server";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { createLfsAdminClient } from "@/lib/infrastructure/supabase/admin";
import {
  DEFAULT_LEAGUE_CONFIG,
  IdentityConfigSchema,
  AnnouncementConfigSchema,
  DisciplineConfigSchema,
  TransfersConfigSchema,
  CategoryConfigSchema,
  SponsorSchema,
  VenueConfigSchema,
  type LeagueFullConfig,
  type SponsorItem,
  type CategoryItem,
  type VenueItem,
  type ConfigAuditLogItem,
} from "@/lib/core/rules/configuracionRules";
import type { ActionResponse } from "@/lib/core/rules/pasesRules";

/**
 * SERVER ACTIONS - PANEL DE CONFIGURACIÓN LFS (v4.0 Enterprise)
 * Autorización estricta de rol admin, mutaciones atómicas,
 * subida de assets anti-colisión y purga granular con tags.
 */

// ============================================================================
// 1. HELPER DE AUTORIZACIÓN ESTRICTA
// ============================================================================

async function requireAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No hay una sesión activa. Iniciá sesión como Administrador.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    throw new Error("Acceso denegado: solo la federación puede modificar configuraciones.");
  }

  return { supabase, user };
}

// ============================================================================
// 2. CONSULTAS CACHEADAS CON TAGS EXPLÍCITOS (unstable_cache)
// ============================================================================

export const getCachedLeagueConfig = unstable_cache(
  async (): Promise<LeagueFullConfig> => {
    try {
      const supabase = await createLfsServerClient();
      const { data, error } = await supabase
        .from("league_settings")
        .select("data")
        .eq("id", 1)
        .maybeSingle();

      if (error || !data?.data) {
        return DEFAULT_LEAGUE_CONFIG;
      }

      return {
        identity: { ...DEFAULT_LEAGUE_CONFIG.identity, ...(data.data.identity || {}) },
        announcement: { ...DEFAULT_LEAGUE_CONFIG.announcement, ...(data.data.announcement || {}) },
        discipline: { ...DEFAULT_LEAGUE_CONFIG.discipline, ...(data.data.discipline || {}) },
        transfers: { ...DEFAULT_LEAGUE_CONFIG.transfers, ...(data.data.transfers || {}) },
      };
    } catch {
      return DEFAULT_LEAGUE_CONFIG;
    }
  },
  ["league-settings-data-v4"],
  {
    tags: [
      "league-identity",
      "league-announcement",
      "league-discipline",
      "league-transfers",
    ],
    revalidate: 3600,
  }
);

export const getCachedSponsors = unstable_cache(
  async (): Promise<SponsorItem[]> => {
    try {
      const supabase = await createLfsServerClient();
      const { data, error } = await supabase
        .from("sponsors")
        .select("*")
        .eq("active", true)
        .order("order_index", { ascending: true })
        .order("created_at", { ascending: false });

      if (error || !data) return [];
      return data as SponsorItem[];
    } catch {
      return [];
    }
  },
  ["league-sponsors-active-v4"],
  { tags: ["league-sponsors"], revalidate: 3600 }
);

export const getCachedActiveCategories = unstable_cache(
  async (): Promise<CategoryItem[]> => {
    try {
      const supabase = await createLfsServerClient();
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("is_active", true)
        .order("level_hierarchy", { ascending: true });

      if (error || !data) return [];
      return data as CategoryItem[];
    } catch {
      return [];
    }
  },
  ["categories-active-list-v4"],
  { tags: ["league-categories-active"], revalidate: 3600 }
);

export const getCachedVenues = unstable_cache(
  async (): Promise<VenueItem[]> => {
    try {
      const supabase = await createLfsServerClient();
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error || !data) return [];
      return data as VenueItem[];
    } catch {
      return [];
    }
  },
  ["venues-active-list-v4"],
  { tags: ["league-venues"], revalidate: 3600 }
);

// ============================================================================
// 3. CONSULTA COMPLETA PARA EL PANEL ADMINISTRATIVO
// ============================================================================

export async function obtenerConfiguracionAdminCompleta(): Promise<ActionResponse<{
  config: LeagueFullConfig;
  sponsors: SponsorItem[];
  categories: CategoryItem[];
  venues: VenueItem[];
  auditLogs: ConfigAuditLogItem[];
}>> {
  try {
    const { supabase } = await requireAdmin();

    // 1. Settings
    const { data: settingsRow } = await supabase
      .from("league_settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle();

    const config: LeagueFullConfig = {
      identity: { ...DEFAULT_LEAGUE_CONFIG.identity, ...(settingsRow?.data?.identity || {}) },
      announcement: { ...DEFAULT_LEAGUE_CONFIG.announcement, ...(settingsRow?.data?.announcement || {}) },
      discipline: { ...DEFAULT_LEAGUE_CONFIG.discipline, ...(settingsRow?.data?.discipline || {}) },
      transfers: { ...DEFAULT_LEAGUE_CONFIG.transfers, ...(settingsRow?.data?.transfers || {}) },
    };

    // 2. Sponsors (todos para el admin)
    const { data: sponsors } = await supabase
      .from("sponsors")
      .select("*")
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: false });

    // 3. Categorías (todas, activas e inactivas)
    const { data: categories } = await supabase
      .from("categories")
      .select("*")
      .order("level_hierarchy", { ascending: true });

    // 4. Canchas (todas)
    const { data: venues } = await supabase
      .from("venues")
      .select("*")
      .order("name", { ascending: true });

    // 5. Auditoría
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("module", "configuracion")
      .order("created_at", { ascending: false })
      .limit(30);

    return {
      success: true,
      data: {
        config,
        sponsors: (sponsors || []) as SponsorItem[],
        categories: (categories || []) as CategoryItem[],
        venues: (venues || []) as VenueItem[],
        auditLogs: (logs || []) as ConfigAuditLogItem[],
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al cargar la configuración administrativa.";
    return { success: false, error: message };
  }
}

// ============================================================================
// 4. MUTACIONES ATÓMICAS DE CONFIGURACIÓN (RPC / JSONB)
// ============================================================================

export async function guardarSeccionConfiguracion(
  seccion: "identity" | "announcement" | "discipline" | "transfers",
  payload: unknown
): Promise<ActionResponse<unknown>> {
  try {
    const { supabase, user } = await requireAdmin();

    // 1. Validación Zod según sección
    let parsedValues: unknown;
    let cacheTag = `league-${seccion}`;

    if (seccion === "identity") {
      parsedValues = IdentityConfigSchema.parse(payload);
    } else if (seccion === "announcement") {
      parsedValues = AnnouncementConfigSchema.parse(payload);
    } else if (seccion === "discipline") {
      parsedValues = DisciplineConfigSchema.parse(payload);
    } else if (seccion === "transfers") {
      parsedValues = TransfersConfigSchema.parse(payload);
    } else {
      return { success: false, error: "Sección de configuración no reconocida." };
    }

    // 2. Intento de ejecución vía RPC atómico actualizar_configuracion_path
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "actualizar_configuracion_path",
      {
        p_path: [seccion],
        p_valores: parsedValues,
      }
    );

    if (rpcError) {
      // Fallback defensivo directo si el procedimiento aún no fue corrido en el SQL editor
      const { data: currentSettings } = await supabase
        .from("league_settings")
        .select("data")
        .eq("id", 1)
        .maybeSingle();

      const mergedData = {
        ...(currentSettings?.data || DEFAULT_LEAGUE_CONFIG),
        [seccion]: parsedValues,
      };

      const { error: upsertError } = await supabase
        .from("league_settings")
        .upsert({ id: 1, data: mergedData, updated_at: new Date().toISOString() });

      if (upsertError) {
        return { success: false, error: `Error al guardar configuración: ${upsertError.message}` };
      }

      // Registro de auditoría
      try {
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: `UPDATE_CONFIG_${seccion.toUpperCase()}`,
          module: "configuracion",
          old_data: currentSettings?.data?.[seccion] || null,
          new_data: parsedValues,
        });
      } catch {
        // Ignora silenciosamente si audit_logs no está creado aún
      }
    }

    // 3. Purga granular de caché
    revalidateTag(cacheTag, "default");
    revalidateTag("league-settings-data-v4", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/");

    return { success: true, data: rpcData || parsedValues };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al procesar la solicitud.";
    return { success: false, error: message };
  }
}

// ============================================================================
// 5. CRUD DE CATEGORÍAS (CON SOFT-DEACTIVATE)
// ============================================================================

export async function crearCategoria(payload: unknown): Promise<ActionResponse<CategoryItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = CategoryConfigSchema.parse(payload);

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: valid.name,
        level_hierarchy: valid.level_hierarchy,
        gender: valid.gender,
        anio_desde: valid.anio_desde,
        anio_hasta: valid.anio_hasta,
        is_active: valid.is_active ?? true,
      })
      .select()
      .single();

    if (error) return { success: false, error: `Error al crear categoría: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "CREATE_CATEGORY",
        module: "configuracion",
        new_data: data,
      });
    } catch {}

    revalidateTag("league-categories-active", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");
    revalidatePath("/club/planteles");

    return { success: true, data: data as CategoryItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear la categoría.";
    return { success: false, error: message };
  }
}

export async function actualizarCategoria(
  id: string,
  payload: unknown
): Promise<ActionResponse<CategoryItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = CategoryConfigSchema.parse(payload);

    const { data: prevData } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("categories")
      .update({
        name: valid.name,
        level_hierarchy: valid.level_hierarchy,
        gender: valid.gender,
        anio_desde: valid.anio_desde,
        anio_hasta: valid.anio_hasta,
        is_active: valid.is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: `Error al actualizar categoría: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "UPDATE_CATEGORY",
        module: "configuracion",
        old_data: prevData,
        new_data: data,
      });
    } catch {}

    revalidateTag("league-categories-active", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");
    revalidatePath("/club/planteles");

    return { success: true, data: data as CategoryItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar la categoría.";
    return { success: false, error: message };
  }
}

export async function toggleCategoriaEstado(
  id: string,
  activo: boolean
): Promise<ActionResponse<{ id: string; is_active: boolean }>> {
  try {
    const { supabase, user } = await requireAdmin();

    const { data, error } = await supabase
      .from("categories")
      .update({ is_active: activo })
      .eq("id", id)
      .select("id, is_active")
      .single();

    if (error) return { success: false, error: `Error al cambiar estado de categoría: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: activo ? "ENABLE_CATEGORY" : "DISABLE_CATEGORY",
        module: "configuracion",
        new_data: { id, is_active: activo },
      });
    } catch {}

    revalidateTag("league-categories-active", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");
    revalidatePath("/club/planteles");

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al alternar estado de categoría.";
    return { success: false, error: message };
  }
}

export async function eliminarCategoria(id: string): Promise<ActionResponse<{ id: string }>> {
  try {
    const { supabase, user } = await requireAdmin();

    // Verificación de seguridad: no eliminar si tiene competencias o jugadores asociados
    const { count: countTeams } = await supabase
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if (countTeams && countTeams > 0) {
      return {
        success: false,
        error: `No se puede eliminar la categoría porque posee ${countTeams} equipo(s) asociado(s). En su lugar, desactivala (Soft-Deactivate).`,
      };
    }

    const { data: prevData } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return { success: false, error: `Error al eliminar categoría: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "DELETE_CATEGORY",
        module: "configuracion",
        old_data: prevData,
      });
    } catch {}

    revalidateTag("league-categories-active", "default");
    revalidatePath("/admin/configuracion");
    return { success: true, data: { id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar la categoría.";
    return { success: false, error: message };
  }
}

// ============================================================================
// 6. CRUD DE SPONSORS & PATROCINADORES
// ============================================================================

export async function crearSponsor(payload: unknown): Promise<ActionResponse<SponsorItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = SponsorSchema.parse(payload);

    const { data, error } = await supabase
      .from("sponsors")
      .insert({
        name: valid.name,
        logo_url: valid.logo_url,
        website_url: valid.website_url || null,
        tier: valid.tier,
        display_locations: valid.display_locations,
        active: valid.active,
        order_index: valid.order_index ?? 0,
      })
      .select()
      .single();

    if (error) return { success: false, error: `Error al crear sponsor: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "CREATE_SPONSOR",
        module: "configuracion",
        new_data: data,
      });
    } catch {}

    revalidateTag("league-sponsors", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/");

    return { success: true, data: data as SponsorItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear el sponsor.";
    return { success: false, error: message };
  }
}

export async function actualizarSponsor(
  id: string,
  payload: unknown
): Promise<ActionResponse<SponsorItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = SponsorSchema.parse(payload);

    const { data: prevData } = await supabase
      .from("sponsors")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("sponsors")
      .update({
        name: valid.name,
        logo_url: valid.logo_url,
        website_url: valid.website_url || null,
        tier: valid.tier,
        display_locations: valid.display_locations,
        active: valid.active,
        order_index: valid.order_index,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: `Error al actualizar sponsor: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "UPDATE_SPONSOR",
        module: "configuracion",
        old_data: prevData,
        new_data: data,
      });
    } catch {}

    revalidateTag("league-sponsors", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/");

    return { success: true, data: data as SponsorItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar el sponsor.";
    return { success: false, error: message };
  }
}

export async function toggleSponsorEstado(
  id: string,
  activo: boolean
): Promise<ActionResponse<{ id: string; active: boolean }>> {
  try {
    const { supabase, user } = await requireAdmin();

    const { data, error } = await supabase
      .from("sponsors")
      .update({ active: activo })
      .eq("id", id)
      .select("id, active")
      .single();

    if (error) return { success: false, error: `Error al cambiar estado del sponsor: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: activo ? "ENABLE_SPONSOR" : "DISABLE_SPONSOR",
        module: "configuracion",
        new_data: { id, active: activo },
      });
    } catch {}

    revalidateTag("league-sponsors", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/");

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al alternar estado del sponsor.";
    return { success: false, error: message };
  }
}

export async function eliminarSponsor(id: string): Promise<ActionResponse<{ id: string }>> {
  try {
    const { supabase, user } = await requireAdmin();

    const { data: prevData } = await supabase
      .from("sponsors")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("sponsors").delete().eq("id", id);
    if (error) return { success: false, error: `Error al eliminar sponsor: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "DELETE_SPONSOR",
        module: "configuracion",
        old_data: prevData,
      });
    } catch {}

    revalidateTag("league-sponsors", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/");

    return { success: true, data: { id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar el sponsor.";
    return { success: false, error: message };
  }
}

// ============================================================================
// 7. CRUD DE CANCHAS Y ESCENARIOS
// ============================================================================

export async function crearCanchaConfig(payload: unknown): Promise<ActionResponse<VenueItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = VenueConfigSchema.parse(payload);

    const { data, error } = await supabase
      .from("venues")
      .insert({
        name: valid.name,
        address: valid.address || null,
        capacity: valid.capacity ?? 500,
        surface: valid.surface ?? "parquet",
        is_active: valid.is_active ?? true,
      })
      .select()
      .single();

    if (error) return { success: false, error: `Error al crear cancha: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "CREATE_VENUE",
        module: "configuracion",
        new_data: data,
      });
    } catch {}

    revalidateTag("league-venues", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");

    return { success: true, data: data as VenueItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al crear la cancha.";
    return { success: false, error: message };
  }
}

export async function actualizarCanchaConfig(
  id: string,
  payload: unknown
): Promise<ActionResponse<VenueItem>> {
  try {
    const { supabase, user } = await requireAdmin();
    const valid = VenueConfigSchema.parse(payload);

    const { data: prevData } = await supabase
      .from("venues")
      .select("*")
      .eq("id", id)
      .single();

    const { data, error } = await supabase
      .from("venues")
      .update({
        name: valid.name,
        address: valid.address || null,
        capacity: valid.capacity,
        surface: valid.surface,
        is_active: valid.is_active,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return { success: false, error: `Error al actualizar cancha: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "UPDATE_VENUE",
        module: "configuracion",
        old_data: prevData,
        new_data: data,
      });
    } catch {}

    revalidateTag("league-venues", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");

    return { success: true, data: data as VenueItem };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al actualizar la cancha.";
    return { success: false, error: message };
  }
}

export async function toggleCanchaEstado(
  id: string,
  activo: boolean
): Promise<ActionResponse<{ id: string; is_active: boolean }>> {
  try {
    const { supabase, user } = await requireAdmin();

    const { data, error } = await supabase
      .from("venues")
      .update({ is_active: activo })
      .eq("id", id)
      .select("id, is_active")
      .single();

    if (error) return { success: false, error: `Error al alternar estado de la cancha: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: activo ? "ENABLE_VENUE" : "DISABLE_VENUE",
        module: "configuracion",
        new_data: { id, is_active: activo },
      });
    } catch {}

    revalidateTag("league-venues", "default");
    revalidatePath("/admin/configuracion");
    revalidatePath("/admin/competencias");

    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al alternar estado de la cancha.";
    return { success: false, error: message };
  }
}

export async function eliminarCanchaConfig(id: string): Promise<ActionResponse<{ id: string }>> {
  try {
    const { supabase, user } = await requireAdmin();

    const { count: countMatches } = await supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", id);

    if (countMatches && countMatches > 0) {
      return {
        success: false,
        error: `No se puede eliminar el escenario porque posee ${countMatches} partido(s) asignado(s). En su lugar, desactivalo.`,
      };
    }

    const { data: prevData } = await supabase
      .from("venues")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) return { success: false, error: `Error al eliminar la cancha: ${error.message}` };

    try {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "DELETE_VENUE",
        module: "configuracion",
        old_data: prevData,
      });
    } catch {}

    revalidateTag("league-venues", "default");
    revalidatePath("/admin/configuracion");
    return { success: true, data: { id } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al eliminar la cancha.";
    return { success: false, error: message };
  }
}

// ============================================================================
// 8. SUBIDA SEGURA DE ASSETS A SUPABASE STORAGE (league-assets)
// ============================================================================

export async function subirAssetLiga(
  formData: FormData,
  folder: "logos" | "sponsors" | "banners" = "logos"
): Promise<ActionResponse<{ url: string; path: string }>> {
  try {
    await requireAdmin();
    const admin = createLfsAdminClient();

    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No se proporcionó ningún archivo." };
    }

    // Validación de tamaño (Máx 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      return { success: false, error: "El archivo excede el tamaño máximo permitido (2 MB)." };
    }

    // Validación de tipo MIME
    const allowedMime = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowedMime.includes(file.type)) {
      return {
        success: false,
        error: "Formato no permitido. Utilizá imágenes en formato PNG, JPG, WebP o SVG.",
      };
    }

    // Determinación segura de extensión
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = extMap[file.type] || "png";

    // Generación de nombre anti-colisión UUID + Timestamp
    const randomId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    const fileName = `${folder}/${randomId}-${Date.now()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from("league-assets")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: `Error al subir imagen a Storage: ${uploadError.message}` };
    }

    const { data: publicUrlData } = admin.storage
      .from("league-assets")
      .getPublicUrl(fileName);

    return {
      success: true,
      data: {
        url: publicUrlData.publicUrl,
        path: fileName,
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al subir asset.";
    return { success: false, error: message };
  }
}
