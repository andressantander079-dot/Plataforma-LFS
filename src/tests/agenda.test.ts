import { describe, it, expect } from "vitest";
import {
  TIPOS_EVENTO,
  esTipoEventoValido,
  esAudienciaValida,
  validarEvento,
  ordenarItemsAgenda,
  agruparPorFecha,
  celdasDelMes,
  mesMovido,
  etiquetaMes,
  esPasado,
  fechaLocalISO,
  type ItemAgenda,
} from "../lib/core/rules/agendaRules";

describe("tipos de evento y audiencias", () => {
  it("hay 6 tipos con color definido", () => {
    expect(Object.keys(TIPOS_EVENTO)).toHaveLength(6);
    for (const ui of Object.values(TIPOS_EVENTO)) {
      expect(ui.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(ui.nombre.length).toBeGreaterThan(2);
    }
  });

  it("valida tipos y audiencias", () => {
    expect(esTipoEventoValido("congreso")).toBe(true);
    expect(esTipoEventoValido("fiesta")).toBe(false);
    expect(esAudienciaValida("todos")).toBe(true);
    expect(esAudienciaValida("vecinos")).toBe(false);
  });
});

describe("validarEvento", () => {
  const base = {
    titulo: "Reunión de delegados",
    tipo: "reunion_delegados",
    fecha: "2026-11-20",
  };

  it("acepta un evento correcto", () => {
    expect(validarEvento(base)).toEqual({});
  });

  it("rechaza título corto y fecha inválida", () => {
    const e1 = validarEvento({ ...base, titulo: "Ir" });
    expect(e1.titulo).toBeTruthy();
    const e2 = validarEvento({ ...base, fecha: "20/11/2026" });
    expect(e2.fecha).toBeTruthy();
  });

  it("rechaza hora mal formada y descripción larguísima", () => {
    const e1 = validarEvento({ ...base, hora: "25:99" });
    expect(e1.hora).toBeTruthy();
    const e2 = validarEvento({ ...base, descripcion: "x".repeat(501) });
    expect(e2.descripcion).toBeTruthy();
  });
});

describe("ordenamiento y agrupación de ítems", () => {
  const item = (id: string, fecha: string, hora: string | null, titulo = id): ItemAgenda => ({
    kind: "evento",
    id,
    fecha,
    hora,
    titulo,
    detalle: null,
    tipo: "otro",
    href: null,
  });

  it("ordena por fecha y luego por hora (los sin hora al final del día)", () => {
    const ordenados = ordenarItemsAgenda([
      item("b", "2026-11-12", "20:00"),
      item("a", "2026-11-10", null),
      item("c", "2026-11-12", "09:00"),
      item("d", "2026-11-12", null),
    ]);
    expect(ordenados.map((i) => i.id)).toEqual(["a", "c", "b", "d"]);
  });

  it("agrupa por fecha", () => {
    const grupos = agruparPorFecha([item("a", "2026-11-10", null), item("b", "2026-11-10", "20:00"), item("c", "2026-11-12", null)]);
    expect(grupos.get("2026-11-10")).toHaveLength(2);
    expect(grupos.get("2026-11-12")).toHaveLength(1);
  });
});

describe("calendario mensual", () => {
  it("genera 42 celdas y marca el mes actual", () => {
    const celdas = celdasDelMes("2026-11", "2026-11-10");
    expect(celdas).toHaveLength(42);
    expect(celdas.filter((c) => c.esDelMes)).toHaveLength(30); // noviembre
    expect(celdas.find((c) => c.fecha === "2026-11-10")?.esHoy).toBe(true);
  });

  it("empieza en lunes: noviembre 2026 arranca domingo 1 → la grilla abre el lunes 26/10", () => {
    const celdas = celdasDelMes("2026-11");
    expect(celdas[0].fecha).toBe("2026-10-26");
  });

  it("navega meses hacia adelante y atrás, incluso cruzando el año", () => {
    expect(mesMovido("2026-11", 1)).toBe("2026-12");
    expect(mesMovido("2026-11", -1)).toBe("2026-10");
    expect(mesMovido("2026-12", 1)).toBe("2027-01");
    expect(mesMovido("2026-01", -1)).toBe("2025-12");
  });

  it("etiqueta el mes en español con mayúscula inicial", () => {
    expect(etiquetaMes("2026-11")).toMatch(/^[A-ZÁÉÍÓÚ]/);
    expect(etiquetaMes("2026-11").toLowerCase()).toContain("noviembre");
  });

  it("detecta fechas pasadas", () => {
    expect(esPasado("2026-11-09", "2026-11-10")).toBe(true);
    expect(esPasado("2026-11-10", "2026-11-10")).toBe(false);
  });

  it("fechaLocalISO formatea con ceros", () => {
    expect(fechaLocalISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
