import { z } from "zod";

/**
 * REGLAS Y CONTRATOS DEL PANEL DE CONFIGURACIÓN LFS (v4.0 Enterprise)
 * Funciones puras, esquemas Zod de validación y formateadores de localización.
 */

// ============================================================================
// 1. ESQUEMAS ZOD DE VALIDACIÓN POR SECCIÓN
// ============================================================================

export const IdentityConfigSchema = z.object({
  name: z.string().trim().min(3, "El nombre de la liga debe tener al menos 3 caracteres."),
  short_name: z.string().trim().min(2, "La sigla debe tener al menos 2 caracteres.").max(10, "Máximo 10 caracteres."),
  season: z.string().trim().min(4, "La temporada debe ser un año válido (ej: 2026)."),
  slogan: z.string().trim().default(""),
  logo_url: z.string().nullable().default(null),
  address: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  email: z.string().trim().email("El correo electrónico institucional no es válido.").or(z.literal("")),
  social_instagram: z.string().trim().default(""),
  social_facebook: z.string().trim().default(""),
  social_youtube: z.string().trim().default(""),
});

export const AnnouncementConfigSchema = z.object({
  active: z.boolean().default(false),
  message: z.string().trim().default(""),
  type: z.enum(["info", "warning", "urgent", "success"]).default("info"),
  link_url: z.string().trim().url("El enlace debe ser una URL válida.").nullable().or(z.literal("")).default(null),
});

export const DisciplineConfigSchema = z.object({
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  points_win: z.number().int().min(0, "Los puntos no pueden ser negativos.").default(3),
  points_draw: z.number().int().min(0).default(1),
  points_loss: z.number().int().min(0).default(0),
  tiebreaker: z.enum(["diferencia_gol", "enfrentamiento_directo", "goles_favor"]).default("diferencia_gol"),
  wo_home_goals: z.number().int().min(0).default(5),
  wo_away_goals: z.number().int().min(0).default(0),
  yellow_cards_suspension: z.number().int().min(1, "Mínimo 1 tarjeta.").max(10, "Máximo 10 tarjetas.").default(5),
  accumulated_fouls_limit: z.number().int().min(3, "Mínimo 3 faltas.").max(10, "Máximo 10 faltas.").default(5),
  match_duration_minutes: z.number().int().min(10, "Mínimo 10 min.").max(45, "Máximo 45 min.").default(20),
  timeouts_per_period: z.number().int().min(0).max(3).default(1),
  red_card_fine: z.number().min(0, "El importe no puede ser negativo.").default(8500),
  match_protest_fee: z.number().min(0).default(15000),
  interclub_transfer_fee: z.number().min(0).default(12000),
});

export const TransfersConfigSchema = z.object({
  window_status: z.enum(["abierto", "en_pausa", "cerrado"]).default("abierto"),
  window_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD).").default("2026-02-01"),
  window_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato inválido (YYYY-MM-DD).").default("2026-04-30"),
  max_players_per_roster: z.number().int().min(10, "Mínimo 10 jugadores.").max(50, "Máximo 50.").default(25),
  tenencia_anios: z.number().int().min(0).max(5).default(2),
  recargo_rescision: z.number().min(1, "El multiplicador debe ser al menos 1.0").default(1.5),
  alerta_trabado_horas: z.number().int().min(1).max(720).default(48),
  cancelacion_trabado_horas: z.number().int().min(1).max(720).default(120),
  require_player_signature: z.boolean().default(true),
});

export const SponsorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "El nombre del sponsor es obligatorio."),
  logo_url: z.string().min(1, "El logotipo del sponsor es obligatorio."),
  website_url: z.string().trim().url("El enlace web no es válido.").nullable().or(z.literal("")).default(null),
  tier: z.enum(["main", "platino", "oro", "plata", "bronce", "partner"]).default("oro"),
  display_locations: z.array(z.string()).min(1, "Debe seleccionar al menos una ubicación de visualización.").default(["home", "fixture", "footer"]),
  active: z.boolean().default(true),
  order_index: z.number().int().default(0),
});

export const CategoryConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "El nombre de la categoría es obligatorio."),
  level_hierarchy: z.number().int().min(1, "La jerarquía debe ser un número entero positivo."),
  gender: z.enum(["masculino", "femenino", "mixto"]).default("masculino"),
  anio_desde: z.number().int().min(1950).max(new Date().getFullYear()).nullable().default(null),
  anio_hasta: z.number().int().min(1950).max(new Date().getFullYear()).nullable().default(null),
  is_active: z.boolean().default(true),
}).refine(
  (data) => {
    if (data.anio_desde === null && data.anio_hasta === null) return true;
    if (data.anio_desde !== null && data.anio_hasta !== null) {
      return data.anio_desde <= data.anio_hasta;
    }
    return false;
  },
  { message: "El año de inicio debe ser menor o igual al año límite.", path: ["anio_desde"] }
);

export const VenueConfigSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "El nombre del escenario es obligatorio."),
  address: z.string().trim().nullable().default(null),
  capacity: z.number().int().min(0, "La capacidad no puede ser negativa.").default(500),
  surface: z.enum(["parquet", "sintetico", "cemento", "baldosa"]).default("parquet"),
  is_active: z.boolean().default(true),
});

// ============================================================================
// 2. TIPOS E INTERFACES TYPESCRIPT
// ============================================================================

export type LeagueIdentityConfig = z.infer<typeof IdentityConfigSchema>;
export type LeagueAnnouncementConfig = z.infer<typeof AnnouncementConfigSchema>;
export type LeagueDisciplineConfig = z.infer<typeof DisciplineConfigSchema>;
export type LeagueTransfersConfig = z.infer<typeof TransfersConfigSchema>;

export interface LeagueFullConfig {
  identity: LeagueIdentityConfig;
  announcement: LeagueAnnouncementConfig;
  discipline: LeagueDisciplineConfig;
  transfers: LeagueTransfersConfig;
}

export type SponsorItem = z.infer<typeof SponsorSchema> & { id: string };
export type CategoryItem = z.infer<typeof CategoryConfigSchema> & { id: string };
export type VenueItem = z.infer<typeof VenueConfigSchema> & { id: string };

export interface DirtySectionsState {
  identity: boolean;
  announcement: boolean;
  discipline: boolean;
  transfers: boolean;
}

export interface ConfigAuditLogItem {
  id: string;
  user_id: string | null;
  action: string;
  module: string;
  old_data: unknown;
  new_data: unknown;
  created_at: string;
}

// ============================================================================
// 3. VALORES POR DEFECTO DEFENSIVOS
// ============================================================================

export const DEFAULT_IDENTITY_CONFIG: LeagueIdentityConfig = {
  name: "Liga de Fútsal de Ushuaia",
  short_name: "LFS",
  season: "2026",
  slogan: "Portal Oficial de Gestión Deportiva • Ushuaia, Tierra del Fuego",
  logo_url: null,
  address: "Gdor. Paz 742, Ushuaia, Tierra del Fuego",
  phone: "+54 2901 445566",
  email: "contacto@ligafutsalushuaia.com",
  social_instagram: "@ligafutsalushuaia",
  social_facebook: "Liga de Futsal Ushuaia",
  social_youtube: "LFS Ushuaia Play",
};

export const DEFAULT_ANNOUNCEMENT_CONFIG: LeagueAnnouncementConfig = {
  active: false,
  message: "",
  type: "info",
  link_url: null,
};

export const DEFAULT_DISCIPLINE_CONFIG: LeagueDisciplineConfig = {
  currency: "ARS",
  points_win: 3,
  points_draw: 1,
  points_loss: 0,
  tiebreaker: "diferencia_gol",
  wo_home_goals: 5,
  wo_away_goals: 0,
  yellow_cards_suspension: 5,
  accumulated_fouls_limit: 5,
  match_duration_minutes: 20,
  timeouts_per_period: 1,
  red_card_fine: 8500,
  match_protest_fee: 15000,
  interclub_transfer_fee: 12000,
};

export const DEFAULT_TRANSFERS_CONFIG: LeagueTransfersConfig = {
  window_status: "abierto",
  window_start_date: "2026-02-01",
  window_end_date: "2026-04-30",
  max_players_per_roster: 25,
  tenencia_anios: 2,
  recargo_rescision: 1.5,
  alerta_trabado_horas: 48,
  cancelacion_trabado_horas: 120,
  require_player_signature: true,
};

export const DEFAULT_LEAGUE_CONFIG: LeagueFullConfig = {
  identity: DEFAULT_IDENTITY_CONFIG,
  announcement: DEFAULT_ANNOUNCEMENT_CONFIG,
  discipline: DEFAULT_DISCIPLINE_CONFIG,
  transfers: DEFAULT_TRANSFERS_CONFIG,
};

// ============================================================================
// 4. FORMATEADORES DE LOCALIZACIÓN Y UTILIDADES PURAS
// ============================================================================

/** Formatea montos monetarios según la divisa configurada */
export function formatMoneda(amount: number, currency: string = "ARS"): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$ ${amount.toLocaleString("es-AR")}`;
  }
}

/** Devuelve las secciones actualmente modificadas para la UI */
export function getDirtySectionNames(dirty: DirtySectionsState): string[] {
  const map: Record<keyof DirtySectionsState, string> = {
    identity: "Identidad & Contacto",
    announcement: "Banner de Avisos",
    discipline: "Juego & Disciplina",
    transfers: "Pases & Fichajes",
  };

  return (Object.keys(dirty) as Array<keyof DirtySectionsState>)
    .filter((k) => dirty[k])
    .map((k) => map[k]);
}
