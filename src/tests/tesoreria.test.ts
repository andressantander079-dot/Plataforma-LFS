import { describe, expect, it } from "vitest";
import {
  estadoCargo,
  estaVencido,
  formatoPesos,
  redondear,
  totalConRecargo,
} from "../lib/core/tesoreria/money";

const HOY = new Date("2026-08-18T12:00:00");

describe("Tesorería — recargo por mora", () => {
  it("sin vencimiento no hay recargo", () => {
    expect(totalConRecargo(10000, null, 10, HOY)).toBe(10000);
  });

  it("antes del vencimiento no hay recargo", () => {
    expect(totalConRecargo(10000, "2026-08-31", 10, HOY)).toBe(10000);
  });

  it("el día del vencimiento todavía no hay recargo", () => {
    expect(totalConRecargo(10000, "2026-08-18", 10, HOY)).toBe(10000);
  });

  it("vencido aplica el porcentaje sobre el monto", () => {
    expect(totalConRecargo(10000, "2026-08-10", 10, HOY)).toBe(11000);
    expect(totalConRecargo(45000, "2026-01-01", 15, HOY)).toBe(51750);
  });

  it("sin porcentaje configurado no hay recargo aunque esté vencido", () => {
    expect(totalConRecargo(10000, "2026-08-10", 0, HOY)).toBe(10000);
  });
});

describe("Tesorería — estado de cargo", () => {
  it("pendiente: no venció y no tiene pagos", () => {
    const e = estadoCargo(10000, "2026-08-31", 10, 0, false, HOY);
    expect(e.estado).toBe("pendiente");
    expect(e.saldo).toBe(10000);
  });

  it("parcial: pagó una parte", () => {
    const e = estadoCargo(10000, "2026-08-31", 10, 4000, false, HOY);
    expect(e.estado).toBe("parcial");
    expect(e.pagado).toBe(4000);
    expect(e.saldo).toBe(6000);
  });

  it("pagado: cubrió el total", () => {
    expect(estadoCargo(10000, "2026-08-31", 10, 10000, false, HOY).estado).toBe("pagado");
  });

  it("vencido: pasó la fecha y todavía debe", () => {
    const e = estadoCargo(10000, "2026-08-10", 10, 0, false, HOY);
    expect(e.estado).toBe("vencido");
    expect(e.total).toBe(11000);
    expect(e.recargo).toBe(1000);
    expect(e.saldo).toBe(11000);
  });

  it("vencido con pago parcial: el saldo incluye el recargo", () => {
    const e = estadoCargo(10000, "2026-08-10", 10, 5000, false, HOY);
    expect(e.estado).toBe("vencido");
    expect(e.saldo).toBe(6000);
  });

  it("vencido pagado completo CON recargo queda saldado", () => {
    expect(estadoCargo(10000, "2026-08-10", 10, 11000, false, HOY).estado).toBe("pagado");
  });

  it("vencido que pagó solo el monto original todavía debe el recargo", () => {
    const e = estadoCargo(10000, "2026-08-10", 10, 10000, false, HOY);
    expect(e.estado).toBe("vencido");
    expect(e.saldo).toBe(1000);
  });

  it("anulado: no debe nada y manda sobre todo", () => {
    const e = estadoCargo(10000, "2026-08-10", 10, 0, true, HOY);
    expect(e.estado).toBe("anulado");
    expect(e.saldo).toBe(0);
  });
});

describe("Tesorería — utilidades", () => {
  it("redondea a 2 decimales", () => {
    expect(redondear(10000 * 1.1)).toBe(11000);
    expect(redondear(0.1 + 0.2)).toBe(0.3);
  });

  it("formatea pesos argentinos", () => {
    expect(formatoPesos(45000)).toContain("45.000");
    expect(formatoPesos(1000.5)).toContain("1.000,50");
  });

  it("estaVencido respeta el día completo del vencimiento", () => {
    expect(estaVencido("2026-08-18", HOY)).toBe(false);
    expect(estaVencido("2026-08-17", HOY)).toBe(true);
    expect(estaVencido(null, HOY)).toBe(false);
  });
});
