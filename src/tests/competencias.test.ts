import { describe, it, expect } from "vitest";
import { generarCruces, cantidadPartidos, cantidadFechas } from "../lib/core/competencias/fixture";
import { calcularTabla, vallaMenosVencida } from "../lib/core/competencias/tabla";

describe("generador de fixture (todos contra todos)", () => {
  it("6 equipos a 1 vuelta: 15 partidos, 5 fechas, cada par se cruza una vez", () => {
    const cruces = generarCruces(6, 1);
    expect(cruces.length).toBe(15);
    expect(cantidadPartidos(6, 1)).toBe(15);
    expect(cantidadFechas(6, 1)).toBe(5);

    const pares = new Set(cruces.map((c) => [c.homeIndex, c.awayIndex].sort().join("-")));
    expect(pares.size).toBe(15); // todos los pares posibles de 6 equipos
  });

  it("5 equipos (impar): 10 partidos, 5 fechas, nadie se enfrenta a sí mismo", () => {
    const cruces = generarCruces(5, 1);
    expect(cruces.length).toBe(10);
    expect(cantidadFechas(5, 1)).toBe(5);
    for (const c of cruces) {
      expect(c.homeIndex).not.toBe(c.awayIndex);
      expect(c.homeIndex).toBeLessThan(5);
      expect(c.awayIndex).toBeLessThan(5);
    }
  });

  it("4 equipos a 2 vueltas: 12 partidos y la vuelta invierte las localías", () => {
    const cruces = generarCruces(4, 2);
    expect(cruces.length).toBe(12);
    expect(cantidadFechas(4, 2)).toBe(6);

    const ida = cruces.filter((c) => c.round === 1);
    const vuelta = cruces.filter((c) => c.round === 2);
    expect(ida.length).toBe(6);
    expect(vuelta.length).toBe(6);

    for (const p of ida) {
      const invertido = vuelta.some(
        (v) => v.homeIndex === p.awayIndex && v.awayIndex === p.homeIndex
      );
      expect(invertido).toBe(true);
    }
  });
});

describe("tabla de posiciones", () => {
  const config = {
    pointsWin: 3,
    pointsDraw: 1,
    pointsLoss: 0,
    tiebreaker: "diferencia_gol" as const,
  };

  it("suma puntos, goles y ordena por puntos y diferencia de gol", () => {
    const tabla = calcularTabla(
      ["A", "B", "C"],
      [
        { homeTeamId: "A", awayTeamId: "B", homeScore: 3, awayScore: 0 }, // A gana
        { homeTeamId: "C", awayTeamId: "A", homeScore: 1, awayScore: 1 }, // empate
        { homeTeamId: "B", awayTeamId: "C", homeScore: 2, awayScore: 2 }, // empate
      ],
      config
    );

    expect(tabla[0].teamId).toBe("A"); // 4 pts, +3
    expect(tabla[0].puntos).toBe(4);
    expect(tabla[0].dif).toBe(3);
    expect(tabla[1].teamId).toBe("C"); // 2 pts, 0
    expect(tabla[2].teamId).toBe("B"); // 1 pt
    expect(tabla[2].gf).toBe(2);
    expect(tabla[2].gc).toBe(5);
  });

  it("respeta puntos configurables (2 por victoria)", () => {
    const tabla = calcularTabla(
      ["A", "B"],
      [{ homeTeamId: "A", awayTeamId: "B", homeScore: 1, awayScore: 0 }],
      { ...config, pointsWin: 2 }
    );
    expect(tabla[0].puntos).toBe(2);
  });

  it("desempata por enfrentamiento directo cuando está configurado", () => {
    // A y B empatan en puntos y en DIF general, pero B le ganó a A
    const tabla = calcularTabla(
      ["A", "B", "C"],
      [
        { homeTeamId: "A", awayTeamId: "C", homeScore: 2, awayScore: 0 }, // A 3pts +2
        { homeTeamId: "B", awayTeamId: "C", homeScore: 2, awayScore: 0 }, // B 3pts +2
        { homeTeamId: "B", awayTeamId: "A", homeScore: 1, awayScore: 0 }, // B le ganó a A
      ],
      { ...config, tiebreaker: "enfrentamiento_directo" }
    );

    expect(tabla[0].teamId).toBe("B"); // 6 pts
    expect(tabla[1].teamId).toBe("A"); // 3 pts
    expect(tabla[2].teamId).toBe("C");
  });

  it("detecta la valla menos vencida", () => {
    const tabla = calcularTabla(
      ["A", "B", "C"],
      [
        { homeTeamId: "A", awayTeamId: "B", homeScore: 0, awayScore: 0 },
        { homeTeamId: "C", awayTeamId: "A", homeScore: 1, awayScore: 2 },
      ],
      config
    );
    const valla = vallaMenosVencida(tabla);
    expect(valla?.teamId).toBe("B"); // 0 goles en contra
  });
});
