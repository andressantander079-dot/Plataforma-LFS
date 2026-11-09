import { describe, it, expect } from "vitest";
import {
  ultimosMeses,
  agruparEnMeses,
  etiquetaMesCorto,
  promedioTexto,
  variacionPorcentual,
  resultadoDe,
  rachaDe,
  puntosDe,
} from "../lib/core/rules/estadisticasRules";

describe("buckets mensuales", () => {
  it("últimos 6 meses incluyen el actual y cruzan el año", () => {
    const meses = ultimosMeses(6, new Date(2026, 1, 15)); // feb 2026
    expect(meses).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("agrupa fechas por mes e ignora las fuera de rango", () => {
    const puntos = agruparEnMeses(
      ["2026-01-03", "2026-01-20", "2026-02-01", "2020-05-05"],
      6,
      new Date(2026, 1, 15)
    );
    expect(puntos).toHaveLength(6);
    expect(puntos.find((p) => p.mes === "2026-01")?.cantidad).toBe(2);
    expect(puntos.find((p) => p.mes === "2026-02")?.cantidad).toBe(1);
    expect(puntos.reduce((a, p) => a + p.cantidad, 0)).toBe(3); // la del 2020 no entra
  });

  it("etiqueta corta sin punto", () => {
    expect(etiquetaMesCorto("2026-11")).not.toContain(".");
  });
});

describe("promedios y variaciones", () => {
  it("promedio con 1 decimal estilo es-AR y división por cero", () => {
    expect(promedioTexto(0, 0)).toBe("0");
    expect(Number(promedioTexto(7, 4).replace(",", "."))).toBeCloseTo(1.8, 1);
  });

  it("variación porcentual con base cero", () => {
    expect(variacionPorcentual(10, 20)).toBe(-50);
    expect(variacionPorcentual(5, 0)).toBe(100);
    expect(variacionPorcentual(0, 0)).toBe(null);
  });
});

describe("racha de resultados", () => {
  it("clasifica ganado, empatado y perdido", () => {
    expect(resultadoDe({ golesFavor: 3, golesContra: 1 })).toBe("G");
    expect(resultadoDe({ golesFavor: 2, golesContra: 2 })).toBe("E");
    expect(resultadoDe({ golesFavor: 0, golesContra: 2 })).toBe("P");
  });

  it("toma los últimos N y calcula puntos", () => {
    const partidos = [
      { golesFavor: 0, golesContra: 4 }, // P
      { golesFavor: 2, golesContra: 0 }, // G
      { golesFavor: 1, golesContra: 1 }, // E
      { golesFavor: 3, golesContra: 2 }, // G
      { golesFavor: 0, golesContra: 1 }, // P
      { golesFavor: 5, golesContra: 0 }, // G (6to, queda fuera con n=5)
    ];
    const racha = rachaDe(partidos, 5);
    expect(racha).toEqual(["G", "E", "G", "P", "G"]);
    expect(puntosDe(racha)).toBe(10);
  });
});
