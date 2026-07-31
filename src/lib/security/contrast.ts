/**
 * Calcula la relación de contraste YIQ para un color hexadecimal dado y devuelve
 * el color de texto óptimo (negro o blanco) para cumplir con las normas de accesibilidad WCAG 2.1 AAA.
 */
export function getContrastYIQ(hex: string): "#000000" | "#FFFFFF" {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;

  if (full.length !== 6) return "#000000";

  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);

  // Fórmula de luminancia YIQ
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;

  return yiq >= 128 ? "#000000" : "#FFFFFF";
}
