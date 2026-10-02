/**
 * TESTS — Reglas de dashboard (Paso 12)
 * Saludos, semáforo 48hs, racha W/D/L, sparkline, countdown y docs incompletas.
 * Imports RELATIVOS (vitest no resuelve alias "@/").
 */
import { describe, expect, it } from "vitest";
import {
  armarSaludo,
  bucketsPorDia,
  calcularRacha,
  clasificarUrgencia,
  contarDocumentacionIncompleta,
  horaUshuaia,
  ordenarPorUrgencia,
  puntosSparkline,
  saludoPorHora,
  textoConteo,
  textoCountdown,
  type ItemAtencion,
} from "../lib/core/rules/dashboardRules";

describe("saludoPorHora", () => {
  it("mañana, tarde y noche", () => {
    expect(saludoPorHora(6)).toBe("Buenos días");
    expect(saludoPorHora(11)).toBe("Buenos días");
    expect(saludoPorHora(12)).toBe("Buenas tardes");
    expect(saludoPorHora(19)).toBe("Buenas tardes");
    expect(saludoPorHora(20)).toBe("Buenas noches");
    expect(saludoPorHora(3)).toBe("Buenas noches");
  });

  it("armarSaludo usa el primer nombre y pluraliza", () => {
    const base = new Date("2026-10-02T15:00:00-03:00");
    expect(armarSaludo("Andrés Santander", 0, base)).toContain("Andrés");
    expect(armarSaludo("Andrés Santander", 0, base)).toContain("todo al día");
    expect(armarSaludo("Andrés Santander", 1, base)).toContain("1 cosa");
    expect(armarSaludo("Andrés Santander", 3, base)).toContain("3 cosas");
    expect(armarSaludo(null, 2, base)).toContain("equipo");
  });

  it("horaUshuaia devuelve 0-23", () => {
    const h = horaUshuaia(new Date());
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(24);
  });
});

describe("clasificarUrgencia (semáforo 48hs)", () => {
  const ahora = new Date("2026-10-02T12:00:00Z");

  it("rojo si pasaron 48 hs o más", () => {
    const hace72 = new Date("2026-09-29T11:00:00Z");
    expect(clasificarUrgencia(hace72, ahora)).toBe("rojo");
    const hace48 = new Date("2026-09-30T12:00:00Z");
    expect(clasificarUrgencia(hace48, ahora)).toBe("rojo");
  });

  it("amarillo si pasó la fecha pero menos de 48 hs", () => {
    const hace10 = new Date("2026-10-02T02:00:00Z");
    expect(clasificarUrgencia(hace10, ahora)).toBe("amarillo");
  });

  it("info si es futura, nula o inválida", () => {
    const maniana = new Date("2026-10-03T12:00:00Z");
    expect(clasificarUrgencia(maniana, ahora)).toBe("info");
    expect(clasificarUrgencia(null, ahora)).toBe("info");
    expect(clasificarUrgencia("no-es-fecha", ahora)).toBe("info");
  });

  it("respeta umbral configurable", () => {
    const hace30 = new Date("2026-10-01T06:00:00Z");
    expect(clasificarUrgencia(hace30, ahora, 24)).toBe("rojo");
    expect(clasificarUrgencia(hace30, ahora, 48)).toBe("amarillo");
  });
});

describe("ordenarPorUrgencia", () => {
  it("rojo primero, info al final", () => {
    const items: ItemAtencion[] = [
      { nivel: "info", titulo: "i", detalle: "", href: "#", accion: "Ver" },
      { nivel: "rojo", titulo: "r", detalle: "", href: "#", accion: "Ver" },
      { nivel: "amarillo", titulo: "a", detalle: "", href: "#", accion: "Ver" },
    ];
    const orden = ordenarPorUrgencia(items).map((i) => i.nivel);
    expect(orden).toEqual(["rojo", "amarillo", "info"]);
  });
});

describe("calcularRacha", () => {
  it("devuelve W/D/L de los últimos 5 en orden cronológico", () => {
    const partidos = [
      { golesFavor: 3, golesContra: 1 }, // W
      { golesFavor: 0, golesContra: 2 }, // L
      { golesFavor: 2, golesContra: 2 }, // D
      { golesFavor: 1, golesContra: 0 }, // W
      { golesFavor: 4, golesContra: 3 }, // W
      { golesFavor: 0, golesContra: 1 }, // L (el más reciente)
    ];
    expect(calcularRacha(partidos)).toEqual(["L", "D", "W", "W", "L"]);
  });

  it("con menos de 5 partidos devuelve lo que hay", () => {
    expect(calcularRacha([{ golesFavor: 1, golesContra: 1 }])).toEqual(["D"]);
    expect(calcularRacha([])).toEqual([]);
  });
});

describe("bucketsPorDia", () => {
  it("cuenta partidos por día terminando hoy", () => {
    const hoy = new Date("2026-10-02T18:00:00");
    const ayer = new Date("2026-10-01T10:00:00");
    const hace2 = new Date("2026-09-30T23:00:00");
    const viejo = new Date("2026-08-01T10:00:00");
    const buckets = bucketsPorDia([hoy, hoy, ayer, hace2, viejo], 7, hoy);
    expect(buckets).toHaveLength(7);
    expect(buckets[6]).toBe(2); // hoy
    expect(buckets[5]).toBe(1); // ayer
    expect(buckets[4]).toBe(1); // anteayer
    expect(buckets[0]).toBe(0); // hace 6 días
  });

  it("tolera fechas inválidas", () => {
    const buckets = bucketsPorDia(["basura"], 5, new Date("2026-10-02"));
    expect(buckets.every((b) => b === 0)).toBe(true);
  });
});

describe("puntosSparkline", () => {
  it("genera puntos x,y para la polyline", () => {
    const puntos = puntosSparkline([0, 5, 10], 100, 30, 2);
    const coords = puntos.split(" ");
    expect(coords).toHaveLength(3);
    expect(coords[0].startsWith("2.0,")).toBe(true);
    // el valor máximo toca el tope (y = padding)
    expect(coords[2].endsWith(",2.0")).toBe(true);
  });

  it("todo ceros = línea plana sin romper", () => {
    const puntos = puntosSparkline([0, 0, 0], 100, 30);
    expect(puntos.split(" ")).toHaveLength(3);
  });

  it("arrays vacíos y de un solo valor no rompen", () => {
    expect(puntosSparkline([], 100, 30)).toBe("");
    expect(puntosSparkline([7], 100, 30).split(" ")).toHaveLength(2);
  });
});

describe("textoCountdown", () => {
  const ahora = new Date("2026-10-02T12:00:00");

  it("minutos cuando falta menos de 1 hora", () => {
    expect(textoCountdown(new Date("2026-10-02T12:45:00"), ahora)).toBe("Faltan 45 min");
  });

  it("'es hoy' cuando falta más de 1 hora en el mismo día", () => {
    const texto = textoCountdown(new Date("2026-10-02T18:30:00"), ahora);
    expect(texto).toContain("¡Es hoy!");
    expect(texto).toContain("6 hs 30 min");
  });

  it("días y horas para partidos lejanos", () => {
    expect(textoCountdown(new Date("2026-10-04T16:00:00"), ahora)).toBe("Faltan 2 días y 4 hs");
    expect(textoCountdown(new Date("2026-10-03T12:00:00"), ahora)).toBe("Falta 1 día");
  });

  it("partido en curso o finalizado", () => {
    expect(textoCountdown(new Date("2026-10-02T11:00:00"), ahora)).toBe("¡Se está jugando!");
    expect(textoCountdown(new Date("2026-10-02T06:00:00"), ahora)).toBe("Finalizado");
  });

  it("fecha inválida devuelve vacío", () => {
    expect(textoCountdown("basura", ahora)).toBe("");
  });
});

describe("textoConteo", () => {
  it("singular y plural", () => {
    expect(textoConteo(1, "planilla", "planillas")).toBe("1 planilla");
    expect(textoConteo(3, "planilla", "planillas")).toBe("3 planillas");
  });
});

describe("contarDocumentacionIncompleta", () => {
  const claves = ["dni", "cemad_medico", "cemad_autorizacion", "comprobante_federacion"] as const;

  it("cuenta solo jugadores a los que les falta algún documento", () => {
    const jugadores: { documents: Record<string, string> | null }[] = [
      { documents: { dni: "a.pdf", cemad_medico: "b.pdf", cemad_autorizacion: "c.pdf", comprobante_federacion: "d.pdf" } },
      { documents: { dni: "a.pdf" } },
      { documents: null },
      { documents: {} },
    ];
    expect(contarDocumentacionIncompleta(jugadores, claves)).toBe(3);
  });

  it("lista vacía = 0", () => {
    expect(contarDocumentacionIncompleta([], claves)).toBe(0);
  });
});
