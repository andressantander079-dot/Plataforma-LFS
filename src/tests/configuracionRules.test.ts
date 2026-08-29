import { describe, it, expect } from "vitest";
import {
  IdentityConfigSchema,
  AnnouncementConfigSchema,
  DisciplineConfigSchema,
  TransfersConfigSchema,
  CategoryConfigSchema,
  SponsorSchema,
  VenueConfigSchema,
  formatMoneda,
  getDirtySectionNames,
  DEFAULT_LEAGUE_CONFIG,
} from "../lib/core/rules/configuracionRules";

describe("Pruebas Unitarias - Panel de Configuración LFS (v4.0 Enterprise)", () => {
  describe("1. Validación Zod de Identidad Institucional", () => {
    it("Valida correctamente una configuración institucional completa", () => {
      const validData = {
        name: "Liga de Fútsal de Ushuaia",
        short_name: "LFS",
        season: "2026",
        slogan: "El fútsal más austral del mundo",
        logo_url: "https://supabase.co/storage/v1/object/public/league-assets/logos/logo.png",
        address: "Gdor. Paz 742",
        phone: "+54 2901 445566",
        email: "contacto@ligafutsalushuaia.com",
        social_instagram: "@ligafutsal",
        social_facebook: "LFS Ushuaia",
        social_youtube: "LFS Play",
      };

      const parsed = IdentityConfigSchema.parse(validData);
      expect(parsed.name).toBe("Liga de Fútsal de Ushuaia");
      expect(parsed.short_name).toBe("LFS");
    });

    it("Rechaza nombres demasiado cortos o correos inválidos", () => {
      expect(() =>
        IdentityConfigSchema.parse({
          name: "L",
          short_name: "L",
          season: "2026",
          email: "correo-invalido",
        })
      ).toThrow();
    });
  });

  describe("2. Validación de Banner de Avisos Global", () => {
    it("Valida banner de advertencia activo con URL de redirección", () => {
      const valid = {
        active: true,
        message: "Suspensión de partidos por alerta meteorológica.",
        type: "urgent" as const,
        link_url: "https://www.ligafutsalushuaia.com/fixture",
      };
      const parsed = AnnouncementConfigSchema.parse(valid);
      expect(parsed.active).toBe(true);
      expect(parsed.type).toBe("urgent");
    });
  });

  describe("3. Validación de Disciplina y Puntos", () => {
    it("Valida parámetros de juego estándar", () => {
      const parsed = DisciplineConfigSchema.parse(DEFAULT_LEAGUE_CONFIG.discipline);
      expect(parsed.points_win).toBe(3);
      expect(parsed.points_draw).toBe(1);
      expect(parsed.points_loss).toBe(0);
      expect(parsed.yellow_cards_suspension).toBe(5);
      expect(parsed.currency).toBe("ARS");
    });

    it("Rechaza valores negativos o fuera de rango", () => {
      expect(() =>
        DisciplineConfigSchema.parse({
          ...DEFAULT_LEAGUE_CONFIG.discipline,
          points_win: -1,
        })
      ).toThrow();

      expect(() =>
        DisciplineConfigSchema.parse({
          ...DEFAULT_LEAGUE_CONFIG.discipline,
          yellow_cards_suspension: 15, // Máximo 10
        })
      ).toThrow();
    });
  });

  describe("4. Validación de Categorías y Rangos de Edad", () => {
    it("Acepta categoría con rango de años válido (desde <= hasta)", () => {
      const validCategory = {
        name: "Sub-16 Masculino",
        level_hierarchy: 2,
        gender: "masculino" as const,
        anio_desde: 2010,
        anio_hasta: 2011,
        is_active: true,
      };
      const parsed = CategoryConfigSchema.parse(validCategory);
      expect(parsed.name).toBe("Sub-16 Masculino");
      expect(parsed.is_active).toBe(true);
    });

    it("Rechaza categoría donde anio_desde es mayor a anio_hasta", () => {
      const invalidCategory = {
        name: "Sub-16 Invalida",
        level_hierarchy: 2,
        gender: "masculino" as const,
        anio_desde: 2015,
        anio_hasta: 2010,
        is_active: true,
      };
      expect(() => CategoryConfigSchema.parse(invalidCategory)).toThrow(
        "El año de inicio debe ser menor o igual al año límite."
      );
    });
  });

  describe("5. Validación de Sponsors y Canchas", () => {
    it("Valida sponsor con ubicaciones activas", () => {
      const validSponsor = {
        name: "Banco de Tierra del Fuego",
        logo_url: "https://.../logo.png",
        website_url: "https://www.btf.com.ar",
        tier: "main" as const,
        display_locations: ["home", "fixture", "footer"],
        active: true,
        order_index: 1,
      };
      const parsed = SponsorSchema.parse(validSponsor);
      expect(parsed.tier).toBe("main");
      expect(parsed.display_locations).toHaveLength(3);
    });

    it("Valida escenario deportivo con superficie", () => {
      const validVenue = {
        name: "Gimnasio Hugo Ítalo Favale",
        address: "Gdor. Paz y Lasserre",
        capacity: 1200,
        surface: "parquet" as const,
        is_active: true,
      };
      const parsed = VenueConfigSchema.parse(validVenue);
      expect(parsed.name).toBe("Gimnasio Hugo Ítalo Favale");
      expect(parsed.surface).toBe("parquet");
    });
  });

  describe("6. Formateador de Moneda y Helpers de Estado Sucio (Dirty State)", () => {
    it("Formatea correctamente importes en ARS", () => {
      const formatted = formatMoneda(8500, "ARS");
      expect(formatted).toContain("8.500");
    });

    it("Devuelve nombres de secciones sucias", () => {
      const dirty = {
        identity: true,
        announcement: false,
        discipline: true,
        transfers: false,
      };
      const names = getDirtySectionNames(dirty);
      expect(names).toContain("Identidad & Contacto");
      expect(names).toContain("Juego & Disciplina");
      expect(names).not.toContain("Banner de Avisos");
    });
  });
});
