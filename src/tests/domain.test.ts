import { describe, it, expect } from "vitest";
import { calculatePoints } from "../lib/core/calculators/pointsCalculator";
import { validateCategoryEligibility } from "../lib/core/rules/categoryRules";
import { getContrastYIQ } from "../lib/security/contrast";

describe("Pruebas Unitarias del Dominio LFS v3.0", () => {
  
  describe("Cálculo de Puntos (calculatePoints)", () => {
    it("Debe sumar 3 puntos por victoria y 1 por empate", () => {
      // 2 victorias, 1 empate, 0 derrotas = 7 puntos
      expect(calculatePoints({ won: 2, drawn: 1, lost: 0 })).toBe(7);
    });

    it("Debe retornar 0 puntos si se pierden todos los partidos", () => {
      expect(calculatePoints({ won: 0, drawn: 0, lost: 5 })).toBe(0);
    });

    it("Debe permitir configurar puntajes alternativos si la competencia lo requiere", () => {
      // Si la victoria vale 2 puntos y el empate 1
      expect(calculatePoints({ won: 3, drawn: 2, lost: 0 }, 2, 1)).toBe(8);
    });
  });

  describe("Jerarquía de Categorías (validateCategoryEligibility)", () => {
    it("Debe permitir que un jugador de nivel inferior juegue en categoría superior", () => {
      // Sub-14 (Nivel 1) jugando en Primera (Nivel 4)
      expect(validateCategoryEligibility(1, 4)).toBe(true);
    });

    it("Debe permitir jugar en la misma categoría base", () => {
      // Sub-16 (Nivel 2) jugando en Sub-16 (Nivel 2)
      expect(validateCategoryEligibility(2, 2)).toBe(true);
    });

    it("Debe bloquear y lanzar error si un jugador de nivel superior intenta jugar en una inferior", () => {
      // Primera (Nivel 4) jugando en Sub-14 (Nivel 1)
      expect(() => validateCategoryEligibility(4, 1)).toThrow(
        "Bloqueo LFS: Un jugador de categoría superior no puede ser alineado en una categoría inferior."
      );
    });
  });

  describe("Accesibilidad de Contraste YIQ (getContrastYIQ)", () => {
    it("Debe devolver texto blanco (#FFFFFF) sobre fondo institucional Azul Marino LFS (#1A2A44)", () => {
      expect(getContrastYIQ("#1A2A44")).toBe("#FFFFFF");
    });

    it("Debe devolver texto negro (#000000) sobre fondo blanco (#FFFFFF) o colores claros", () => {
      expect(getContrastYIQ("#FFFFFF")).toBe("#000000");
      expect(getContrastYIQ("#F97316")).toBe("#000000"); // Naranja LFS tiene YIQ >= 128
    });
  });

});
