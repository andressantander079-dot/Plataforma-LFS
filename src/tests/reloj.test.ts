import { describe, expect, it } from "vitest";
import {
  duracionDelTramo,
  etiquetaFase,
  formatoReloj,
  llegoACero,
  minutoActual,
  puedeCargarEventos,
  segundosConsumidos,
  segundosRestantes,
  type EstadoReloj,
} from "../lib/core/rules/relojRules";

const base: EstadoReloj = {
  fase: "primer_tiempo",
  corriendo: false,
  iniciadoAt: null,
  segundosBase: 0,
  duracionTiempoMin: 25,
  duracionEntretiempoMin: 10,
};

const AHORA = new Date("2026-11-10T20:00:00Z").getTime();

describe("relojRules", () => {
  it("duración del tramo según fase", () => {
    expect(duracionDelTramo("primer_tiempo", 25, 10)).toBe(1500);
    expect(duracionDelTramo("segundo_tiempo", 25, 10)).toBe(1500);
    expect(duracionDelTramo("entretiempo", 25, 10)).toBe(600);
    expect(duracionDelTramo("finalizado", 25, 10)).toBe(0);
  });

  it("en pausa devuelve el total menos lo consumido", () => {
    const estado = { ...base, segundosBase: 300 }; // 5 min consumidos
    expect(segundosRestantes(estado, AHORA)).toBe(1200);
  });

  it("corriendo descuenta desde iniciadoAt", () => {
    const estado = {
      ...base,
      corriendo: true,
      iniciadoAt: new Date(AHORA - 60_000).toISOString(), // arrancó hace 1 min
      segundosBase: 0,
    };
    expect(segundosRestantes(estado, AHORA)).toBe(1440);
  });

  it("nunca devuelve negativos", () => {
    const estado = {
      ...base,
      corriendo: true,
      iniciadoAt: new Date(AHORA - 9999_000).toISOString(),
    };
    expect(segundosRestantes(estado, AHORA)).toBe(0);
    expect(llegoACero(estado, AHORA)).toBe(true);
  });

  it("formato mm:ss", () => {
    expect(formatoReloj(1499)).toBe("24:59");
    expect(formatoReloj(60)).toBe("01:00");
    expect(formatoReloj(0)).toBe("00:00");
  });

  it("minuto actual: arranca en 1 del PT y cambia a ST", () => {
    const pt = { ...base, corriendo: true, iniciadoAt: new Date(AHORA - 12 * 60_000).toISOString() };
    expect(minutoActual(pt, AHORA)).toEqual({ minuto: 13, tiempo: "PT" });

    const st = { ...pt, fase: "segundo_tiempo" as const, segundosBase: 0 };
    expect(minutoActual(st, AHORA)).toEqual({ minuto: 13, tiempo: "ST" });
  });

  it("no pasa del minuto máximo del tiempo", () => {
    const estado = {
      ...base,
      corriendo: true,
      iniciadoAt: new Date(AHORA - 99 * 60_000).toISOString(),
    };
    expect(minutoActual(estado, AHORA).minuto).toBe(25);
  });

  it("durante el entretiempo no se cargan eventos", () => {
    expect(puedeCargarEventos("primer_tiempo")).toBe(true);
    expect(puedeCargarEventos("segundo_tiempo")).toBe(true);
    expect(puedeCargarEventos("entretiempo")).toBe(false);
    expect(puedeCargarEventos("sin_iniciar")).toBe(false);
  });

  it("segundos consumidos es el complemento", () => {
    const estado = { ...base, segundosBase: 120 };
    expect(segundosConsumidos(estado, AHORA)).toBe(120);
  });

  it("etiquetas de fase", () => {
    expect(etiquetaFase("primer_tiempo")).toBe("1T");
    expect(etiquetaFase("entretiempo")).toBe("ENTRETIEMPO");
    expect(etiquetaFase("segundo_tiempo")).toBe("2T");
    expect(etiquetaFase("finalizado")).toBe("FINALIZADO");
  });
});
