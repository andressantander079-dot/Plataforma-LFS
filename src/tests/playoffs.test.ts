import { describe, expect, it } from "vitest";
import {
  asignarGrupos,
  crucesEntreGrupos,
  crucesSembrados,
  emparejarSiguienteRonda,
  etapaParaCantidad,
  ordenSembrado,
  primeraRondaEliminacion,
  siguienteEtapa,
} from "../lib/core/competencias/playoff";

describe("Playoffs — etapas", () => {
  it("elige la etapa inicial según la cantidad de equipos", () => {
    expect(etapaParaCantidad(2)).toBe("final");
    expect(etapaParaCantidad(4)).toBe("semifinal");
    expect(etapaParaCantidad(8)).toBe("cuartos");
    expect(etapaParaCantidad(16)).toBe("octavos");
  });

  it("encadena las etapas hasta la final", () => {
    expect(siguienteEtapa("octavos")).toBe("cuartos");
    expect(siguienteEtapa("cuartos")).toBe("semifinal");
    expect(siguienteEtapa("semifinal")).toBe("final");
    expect(siguienteEtapa("final")).toBeNull();
    expect(siguienteEtapa("fase_regular")).toBeNull();
  });
});

describe("Playoffs — sembrado", () => {
  it("con 4 equipos: 1° vs 4° y 2° vs 3°", () => {
    expect(ordenSembrado(4)).toEqual([1, 4, 2, 3]);
    const cruces = crucesSembrados(4);
    expect(cruces).toEqual([
      { homeIndex: 0, awayIndex: 3, orden: 1 },
      { homeIndex: 1, awayIndex: 2, orden: 2 },
    ]);
  });

  it("con 8 equipos: el 1° y el 2° solo se cruzan en la final", () => {
    expect(ordenSembrado(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const cruces = crucesSembrados(8);
    expect(cruces).toHaveLength(4);
    // Partidos 1 y 2 alimentan una semifinal: contienen semillas 1 y 4/5
    expect(cruces[0]).toEqual({ homeIndex: 0, awayIndex: 7, orden: 1 });
    expect(cruces[1]).toEqual({ homeIndex: 3, awayIndex: 4, orden: 2 });
    // El 2° está en la otra mitad de la llave (partidos 3 o 4)
    const mitadBaja = [cruces[2], cruces[3]].flatMap((c) => [c.homeIndex, c.awayIndex]);
    expect(mitadBaja).toContain(1); // índice 1 = semilla 2
  });
});

describe("Playoffs — grupos", () => {
  it("reparte en serpiente: grupos parejos con 8 equipos y 2 grupos", () => {
    const equipos = ["1", "2", "3", "4", "5", "6", "7", "8"];
    const grupos = asignarGrupos(equipos, 2);
    expect(grupos[0]).toEqual({ nombre: "A", teamIds: ["1", "4", "5", "8"] });
    expect(grupos[1]).toEqual({ nombre: "B", teamIds: ["2", "3", "6", "7"] });
  });

  it("cruza 1° de un grupo contra 2° del otro (semifinales)", () => {
    const clasificados = [
      { grupo: "A", posicion: 1, teamId: "1A" },
      { grupo: "A", posicion: 2, teamId: "2A" },
      { grupo: "B", posicion: 1, teamId: "1B" },
      { grupo: "B", posicion: 2, teamId: "2B" },
    ];
    const cruces = crucesEntreGrupos(clasificados);
    expect(cruces).toEqual([
      { home: "1A", away: "2B", orden: 1 },
      { home: "1B", away: "2A", orden: 2 },
    ]);
  });
});

describe("Playoffs — eliminación directa con byes", () => {
  it("con 8 equipos exactos: 4 cuartos sin byes", () => {
    const equipos = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ronda = primeraRondaEliminacion(equipos);
    expect(ronda.etapa).toBe("cuartos");
    expect(ronda.cruces).toHaveLength(4);
    expect(ronda.byes).toHaveLength(0);
  });

  it("con 5 equipos: 1 partido y 3 byes que completan la semifinal", () => {
    const equipos = ["a", "b", "c", "d", "e"];
    const ronda = primeraRondaEliminacion(equipos);
    expect(ronda.etapa).toBe("cuartos");
    expect(ronda.cruces).toHaveLength(1);
    expect(ronda.byes).toHaveLength(3);
    // ganador + 3 byes = 4 → semifinal
    const participantes = emparejarSiguienteRonda(["GANADOR", ...ronda.byes]);
    expect(participantes).toHaveLength(2);
  });

  it("empareja ganadores consecutivos para la siguiente ronda", () => {
    const cruces = emparejarSiguienteRonda(["w1", "w2", "w3", "w4"]);
    expect(cruces).toEqual([
      { home: "w1", away: "w2", orden: 1 },
      { home: "w3", away: "w4", orden: 2 },
    ]);
  });
});
