import { describe, expect, it } from "vitest";
import {
  PLAZO_APELACION_HORAS,
  estadoSancion,
  motivoLegible,
  calcularLimiteApelacion,
  puedeApelar,
  validarSancionManual,
  validarModificacionSancion,
  validarAnulacion,
  validarResolucionApelacion,
  validarMotivoApelacion,
  formatoPesos,
  ESTADO_SANCION_UI,
  ESTADO_APELACION_UI,
  ESTADO_MULTA_UI,
} from "../lib/core/rules/tribunalRules";

/**
 * TRIBUNAL DE DISCIPLINA — reglas de negocio
 * Plazos de apelación (72 hs), estados, validaciones de sanciones manuales.
 */

describe("estadoSancion", () => {
  it("anulada gana sobre todo lo demás", () => {
    expect(estadoSancion({ anulada_at: "2026-01-01", partidos_pendientes: 3 })).toBe("anulada");
  });
  it("activa si quedan fechas pendientes", () => {
    expect(estadoSancion({ anulada_at: null, partidos_pendientes: 2 })).toBe("activa");
  });
  it("cumplida si no quedan fechas", () => {
    expect(estadoSancion({ anulada_at: null, partidos_pendientes: 0 })).toBe("cumplida");
  });
  it("todos los estados tienen UI definida", () => {
    for (const estado of ["activa", "cumplida", "anulada"] as const) {
      expect(ESTADO_SANCION_UI[estado].label).toBeTruthy();
      expect(ESTADO_SANCION_UI[estado].clases).toContain("bg-");
    }
  });
});

describe("motivoLegible — compatibilidad con el motor automático (7B)", () => {
  it("traduce los motivos históricos", () => {
    expect(motivoLegible("roja")).toContain("Roja");
    expect(motivoLegible("acumulacion_amarillas")).toContain("Acumulación");
  });
  it("deja pasar texto libre del catálogo/manual", () => {
    expect(motivoLegible("Insultos a la terna arbitral")).toBe("Insultos a la terna arbitral");
  });
});

describe("apelaciones — plazo de 72 horas", () => {
  const creada = "2026-03-01T12:00:00.000Z";

  it("el límite es exactamente 72 hs después", () => {
    expect(calcularLimiteApelacion(creada).toISOString()).toBe("2026-03-04T12:00:00.000Z");
    expect(PLAZO_APELACION_HORAS).toBe(72);
  });

  it("dentro del plazo: puede apelar", () => {
    const r = puedeApelar({
      creadaAtIso: creada,
      ahora: new Date("2026-03-03T12:00:00.000Z"),
      yaApelo: false,
      anulada: false,
    });
    expect(r.ok).toBe(true);
  });

  it("vencido el plazo: no puede apelar", () => {
    const r = puedeApelar({
      creadaAtIso: creada,
      ahora: new Date("2026-03-04T12:00:01.000Z"),
      yaApelo: false,
      anulada: false,
    });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("72");
  });

  it("una sola apelación por sanción", () => {
    const r = puedeApelar({ creadaAtIso: creada, ahora: new Date(creada), yaApelo: true, anulada: false });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("ya tiene");
  });

  it("no se apela una sanción anulada", () => {
    const r = puedeApelar({ creadaAtIso: creada, ahora: new Date(creada), yaApelo: false, anulada: true });
    expect(r.ok).toBe(false);
  });
});

describe("validarSancionManual", () => {
  const base = {
    sancionadoTipo: "jugador" as const,
    playerId: "uuid-jugador",
    nombreLibre: "",
    clubId: "uuid-club",
    infraccion: "Agresión física",
    fechas: 4,
    montoMulta: 25000,
  };

  it("acepta una sanción completa a jugador", () => {
    expect(validarSancionManual(base).ok).toBe(true);
  });

  it("jugador requiere playerId (buscado por DNI)", () => {
    expect(validarSancionManual({ ...base, playerId: null }).ok).toBe(false);
  });

  it("cuerpo técnico requiere nombre libre", () => {
    const r = validarSancionManual({
      ...base,
      sancionadoTipo: "cuerpo_tecnico",
      playerId: null,
      nombreLibre: "Al",
    });
    expect(r.ok).toBe(false);
    const ok = validarSancionManual({
      ...base,
      sancionadoTipo: "cuerpo_tecnico",
      playerId: null,
      nombreLibre: "Marcos Pérez (DT)",
    });
    expect(ok.ok).toBe(true);
  });

  it("sanción a club: no lleva fechas, solo multa", () => {
    const r = validarSancionManual({
      ...base,
      sancionadoTipo: "club",
      playerId: null,
      fechas: 2,
      montoMulta: 20000,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("institucionales");
  });

  it("rechaza sanción vacía (sin fechas ni multa)", () => {
    expect(validarSancionManual({ ...base, fechas: 0, montoMulta: 0 }).ok).toBe(false);
  });

  it("fechas fuera de rango", () => {
    expect(validarSancionManual({ ...base, fechas: -1 }).ok).toBe(false);
    expect(validarSancionManual({ ...base, fechas: 31 }).ok).toBe(false);
    expect(validarSancionManual({ ...base, fechas: 1.5 }).ok).toBe(false);
  });

  it("sin club ni infracción no pasa", () => {
    expect(validarSancionManual({ ...base, clubId: "" }).ok).toBe(false);
    expect(validarSancionManual({ ...base, infraccion: " " }).ok).toBe(false);
  });
});

describe("validaciones de modificación, anulación y fallos", () => {
  it("modificación: fechas válidas y motivo no vacío", () => {
    expect(validarModificacionSancion({ fechas: 2, infraccion: "Roja directa" }).ok).toBe(true);
    expect(validarModificacionSancion({ fechas: -1, infraccion: "X" }).ok).toBe(false);
    expect(validarModificacionSancion({ fechas: 1, infraccion: " " }).ok).toBe(false);
  });

  it("anulación exige motivo fundamentado", () => {
    expect(validarAnulacion("ok").ok).toBe(false);
    expect(validarAnulacion("Error de identidad en la planilla").ok).toBe(true);
  });

  it("resolución de apelación exige fundamentos", () => {
    expect(validarResolucionApelacion("si").ok).toBe(false);
    expect(validarResolucionApelacion("Se verificó el video: no hubo agresión").ok).toBe(true);
  });

  it("apelación del club exige un motivo mínimo", () => {
    expect(validarMotivoApelacion("no").ok).toBe(false);
    expect(validarMotivoApelacion("El jugador identificado no fue el nuestro").ok).toBe(true);
  });
});

describe("formatoPesos y UIs", () => {
  it("formato ARS sin decimales", () => {
    expect(formatoPesos(15000)).toContain("15.000");
  });
  it("estados de apelación y multa tienen UI", () => {
    expect(ESTADO_APELACION_UI.pendiente.label).toBe("Pendiente de fallo");
    expect(ESTADO_MULTA_UI.pagado.label).toBe("Pagada");
    expect(ESTADO_MULTA_UI.pendiente.clases).toContain("amber");
  });
});
