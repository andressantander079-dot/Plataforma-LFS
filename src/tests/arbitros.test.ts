import { describe, it, expect } from "vitest";
import {
  textoDesignacion,
  debeResponder,
  estaBloqueado,
  rangosSeSolapan,
  conflictoHorario,
  validarBloqueDisponibilidad,
  calcularEstadisticasArbitro,
  calcularLiquidacion,
  tarifaEfectiva,
  periodoActual,
  nombrePeriodo,
  partidoLiquidable,
  validarNivelArbitro,
  validarEventoArbitral,
  ordenarArbitrosPadron,
  validarRegistroArbitro,
} from "../lib/core/rules/arbitrosRules";

describe("designaciones", () => {
  it("texto según modo y estado", () => {
    expect(textoDesignacion(null, null)).toBe("Sin designar");
    expect(textoDesignacion("directa", null)).toBe("Designado");
    expect(textoDesignacion("propuesta", "pendiente")).toBe("Esperando respuesta");
    expect(textoDesignacion("propuesta", "aceptada")).toBe("Aceptada");
    expect(textoDesignacion("propuesta", "rechazada")).toBe("Rechazada");
  });

  it("debe responder solo propuestas pendientes", () => {
    expect(debeResponder("propuesta", "pendiente")).toBe(true);
    expect(debeResponder("propuesta", "aceptada")).toBe(false);
    expect(debeResponder("directa", null)).toBe(false);
    expect(debeResponder(null, null)).toBe(false);
  });
});

describe("disponibilidad", () => {
  const bloques = [{ desde: "2026-10-10", hasta: "2026-10-15", motivo: "Viaje" }];

  it("detecta día bloqueado dentro del rango", () => {
    expect(estaBloqueado("2026-10-12T18:00:00", bloques)?.motivo).toBe("Viaje");
    expect(estaBloqueado("2026-10-10", bloques)).not.toBeNull();
    expect(estaBloqueado("2026-10-15T23:00:00", bloques)).not.toBeNull();
  });

  it("día fuera del rango no bloquea", () => {
    expect(estaBloqueado("2026-10-16", bloques)).toBeNull();
    expect(estaBloqueado("2026-10-09", bloques)).toBeNull();
    expect(estaBloqueado(null, bloques)).toBeNull();
  });

  it("solapamiento de rangos", () => {
    expect(rangosSeSolapan("2026-10-01", "2026-10-10", "2026-10-05", "2026-10-20")).toBe(true);
    expect(rangosSeSolapan("2026-10-01", "2026-10-10", "2026-10-11", "2026-10-20")).toBe(false);
    expect(rangosSeSolapan("2026-10-10", "2026-10-10", "2026-10-10", "2026-10-10")).toBe(true);
  });

  it("valida bloques de disponibilidad", () => {
    expect(validarBloqueDisponibilidad({ desde: "2026-10-01", hasta: "2026-10-05" }).ok).toBe(true);
    expect(validarBloqueDisponibilidad({ desde: "2026-10-05", hasta: "2026-10-01" }).ok).toBe(false);
    expect(validarBloqueDisponibilidad({ desde: "mal", hasta: "2026-10-01" }).ok).toBe(false);
    expect(
      validarBloqueDisponibilidad({ desde: "2026-01-01", hasta: "2026-06-01" }).ok
    ).toBe(false); // más de 90 días
  });
});

describe("conflicto de horario", () => {
  const partidos = [
    { id: "m1", scheduled_at: "2026-10-12T18:00:00" },
    { id: "m2", scheduled_at: "2026-10-12T22:00:00" },
  ];

  it("detecta partido a menos de 2 hs", () => {
    expect(conflictoHorario(partidos, "2026-10-12T19:00:00")?.id).toBe("m1");
    expect(conflictoHorario(partidos, "2026-10-12T23:30:00")?.id).toBe("m2");
  });

  it("sin conflicto si hay 2 hs o más", () => {
    // 20:00 está a exactamente 2 hs de ambos (18:00 y 22:00) → no es conflicto
    expect(conflictoHorario(partidos, "2026-10-12T20:00:00")).toBeNull();
    expect(conflictoHorario(partidos, "2026-10-12T15:00:00")).toBeNull();
  });

  it("excluye el propio partido al redesignar", () => {
    expect(conflictoHorario(partidos, "2026-10-12T18:30:00", "m1")).toBeNull();
  });

  it("sin horario → sin conflicto", () => {
    expect(conflictoHorario(partidos, null)).toBeNull();
    expect(conflictoHorario([{ id: "x", scheduled_at: null }], "2026-10-12T18:00:00")).toBeNull();
  });
});

describe("estadísticas del árbitro", () => {
  it("calcula promedios con partidos reales", () => {
    const stats = calcularEstadisticasArbitro([
      { status: "jugado", home_score: 3, away_score: 2, amarillas: 4, rojas: 1 },
      { status: "jugado", home_score: 1, away_score: 1, amarillas: 2, rojas: 0 },
      { status: "wo", home_score: null, away_score: null, amarillas: 0, rojas: 0 },
      { status: "programado", home_score: null, away_score: null, amarillas: 0, rojas: 0 },
    ]);
    expect(stats.dirigidos).toBe(3);
    expect(stats.golesPromedio).toBe(3.5); // (5+2)/2 jugados
    expect(stats.amarillasPromedio).toBe(2); // 6/3 dirigidos
    expect(stats.rojasTotal).toBe(1);
    expect(stats.wo).toBe(1);
  });

  it("sin partidos → todo cero", () => {
    const stats = calcularEstadisticasArbitro([]);
    expect(stats).toEqual({
      dirigidos: 0,
      golesPromedio: 0,
      amarillasPromedio: 0,
      rojasTotal: 0,
      wo: 0,
    });
  });
});

describe("liquidaciones", () => {
  it("monto = partidos × tarifa", () => {
    expect(calcularLiquidacion(5, 8000)).toBe(40000);
    expect(calcularLiquidacion(0, 8000)).toBe(0);
    expect(calcularLiquidacion(5, 0)).toBe(0);
  });

  it("tarifa efectiva: override gana sobre nivel", () => {
    expect(tarifaEfectiva(9500, 8000)).toBe(9500);
    expect(tarifaEfectiva(null, 8000)).toBe(8000);
    expect(tarifaEfectiva(0, 8000)).toBe(8000);
    expect(tarifaEfectiva(null, null)).toBe(0);
  });

  it("período actual y nombre lindo", () => {
    expect(periodoActual(new Date("2026-10-07T12:00:00"))).toBe("2026-10");
    expect(nombrePeriodo("2026-10")).toBe("octubre 2026");
    expect(nombrePeriodo("2026-01")).toBe("enero 2026");
  });

  it("partido liquidable: jugado/wo y confirmado", () => {
    expect(partidoLiquidable("jugado", true)).toBe(true);
    expect(partidoLiquidable("wo", true)).toBe(true);
    expect(partidoLiquidable("jugado", false)).toBe(false);
    expect(partidoLiquidable("programado", true)).toBe(false);
  });
});

describe("validaciones de configuración", () => {
  it("nivel arbitral", () => {
    expect(validarNivelArbitro({ nombre: "Categoría A", orden: 1, tarifa_partido: 8000 }).ok).toBe(true);
    expect(validarNivelArbitro({ nombre: "A", orden: 1, tarifa_partido: 0 }).ok).toBe(false);
    expect(validarNivelArbitro({ nombre: "Nivel X", orden: 0, tarifa_partido: 0 }).ok).toBe(false);
    expect(validarNivelArbitro({ nombre: "Nivel X", orden: 1, tarifa_partido: -5 }).ok).toBe(false);
  });

  it("evento arbitral", () => {
    expect(validarEventoArbitral({ fecha: "2026-11-01", titulo: "Clínica AFA" }).ok).toBe(true);
    expect(validarEventoArbitral({ fecha: "ayer", titulo: "Clínica AFA" }).ok).toBe(false);
    expect(validarEventoArbitral({ fecha: "2026-11-01", titulo: "Ab" }).ok).toBe(false);
  });
});

describe("padrón del colegio", () => {
  it("ordena por nivel y nombre", () => {
    const ordenado = ordenarArbitrosPadron([
      { nombre: "Zulema", nivelOrden: 2 },
      { nombre: "Ana", nivelOrden: 1 },
      { nombre: "Beto", nivelOrden: 1 },
      { nombre: "SinNivel", nivelOrden: null },
    ]);
    expect(ordenado.map((a) => a.nombre)).toEqual(["Ana", "Beto", "Zulema", "SinNivel"]);
  });

  it("valida registro de nuevo árbitro con credenciales", () => {
    // Válido completo
    expect(
      validarRegistroArbitro({
        nombre: "Martín Palermo",
        email: "arbitro@lfs.com",
        password: "password123",
        telefono: "2901-445566",
        rol: "arbitro",
        tarifaOverride: 12000,
      }).ok
    ).toBe(true);

    // Válido mínimo
    expect(
      validarRegistroArbitro({
        nombre: "Juan Perez",
        email: "juan@gmail.com",
        password: "secret",
      }).ok
    ).toBe(true);

    // Nombre muy corto
    expect(
      validarRegistroArbitro({
        nombre: "Al",
        email: "al@lfs.com",
        password: "password123",
      }).ok
    ).toBe(false);

    // Email inválido
    expect(
      validarRegistroArbitro({
        nombre: "Carlos Gómez",
        email: "email-invalido",
        password: "password123",
      }).ok
    ).toBe(false);

    // Password menor a 6 caracteres
    expect(
      validarRegistroArbitro({
        nombre: "Carlos Gómez",
        email: "carlos@lfs.com",
        password: "12345",
      }).ok
    ).toBe(false);

    // Tarifa negativa
    expect(
      validarRegistroArbitro({
        nombre: "Carlos Gómez",
        email: "carlos@lfs.com",
        password: "password123",
        tarifaOverride: -100,
      }).ok
    ).toBe(false);
  });
});
