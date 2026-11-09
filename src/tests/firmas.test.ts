import { describe, expect, it } from "vitest";
import {
  esFirmaObligatoria,
  estadoFirmas,
  ganadorFigura,
  registrarVoto,
  rolesPresentes,
  rutaFirma,
  votacionCompleta,
  votantesEsperados,
  type MapaFirmas,
  type VotoFigura,
} from "../lib/core/rules/firmasRules";

describe("firmas digitales", () => {
  it("solo la del árbitro principal es obligatoria", () => {
    expect(esFirmaObligatoria("principal")).toBe(true);
    expect(esFirmaObligatoria("dt_local")).toBe(false);
    expect(esFirmaObligatoria("capitan_visitante")).toBe(false);
  });

  it("roles presentes sin 2do ni planillero (categorías chicas)", () => {
    const roles = rolesPresentes({ haySegundoArbitro: false, hayPlanillero: false });
    expect(roles).not.toContain("segundo_arbitro");
    expect(roles).not.toContain("planillero");
    expect(roles).toContain("principal");
    expect(roles).toContain("dt_local");
  });

  it("ruta de la firma dentro del bucket", () => {
    expect(rutaFirma("abc-123", "principal")).toBe("abc-123/principal.png");
  });

  it("estado: puede cerrar solo con la firma del principal", () => {
    const presentes = rolesPresentes({ haySegundoArbitro: false, hayPlanillero: false });
    const sinPrincipal: MapaFirmas = {
      dt_local: { path: "m/dt.png", nombre: "Juan", firmo: true, firmadoAt: "x" },
    };
    expect(estadoFirmas(sinPrincipal, presentes).puedeCerrar).toBe(false);

    const conPrincipal: MapaFirmas = {
      ...sinPrincipal,
      principal: { path: "m/p.png", nombre: "Ref", firmo: true, firmadoAt: "x" },
    };
    const estado = estadoFirmas(conPrincipal, presentes);
    expect(estado.puedeCerrar).toBe(true);
    expect(estado.firmadas).toBe(2);
  });

  it("registra los que no firmaron", () => {
    const firmas: MapaFirmas = {
      principal: { path: "m/p.png", nombre: "Ref", firmo: true, firmadoAt: "x" },
      dt_visitante: { path: null, nombre: "Pedro", firmo: false, firmadoAt: null },
    };
    const estado = estadoFirmas(firmas, ["principal", "dt_visitante", "capitan_local"]);
    expect(estado.noFirmaron).toEqual(["dt_visitante"]);
    expect(estado.faltantes).toEqual(["capitan_local"]);
    expect(estado.puedeCerrar).toBe(true);
  });
});

describe("votación de la figura", () => {
  it("votantes esperados según oficiales presentes", () => {
    expect(votantesEsperados({ haySegundoArbitro: false, hayPlanillero: false })).toEqual([
      "dt_local",
      "dt_visitante",
      "principal",
    ]);
    expect(votantesEsperados({ haySegundoArbitro: true, hayPlanillero: true })).toHaveLength(5);
  });

  it("votar dos veces pisa el voto anterior", () => {
    let votos: VotoFigura[] = [];
    votos = registrarVoto(votos, "principal", "jugador-a");
    votos = registrarVoto(votos, "principal", "jugador-b");
    expect(votos).toHaveLength(1);
    expect(votos[0].jugadorId).toBe("jugador-b");
  });

  it("votación completa cuando votaron todos", () => {
    const esperados = votantesEsperados({ haySegundoArbitro: false, hayPlanillero: false });
    const votos: VotoFigura[] = [
      { votante: "dt_local", jugadorId: "a" },
      { votante: "dt_visitante", jugadorId: "a" },
      { votante: "principal", jugadorId: "b" },
    ];
    expect(votacionCompleta(votos, esperados)).toBe(true);
    expect(votacionCompleta(votos.slice(0, 2), esperados)).toBe(false);
  });

  it("gana el más votado", () => {
    const votos: VotoFigura[] = [
      { votante: "dt_local", jugadorId: "a" },
      { votante: "dt_visitante", jugadorId: "a" },
      { votante: "principal", jugadorId: "b" },
    ];
    expect(ganadorFigura(votos)).toEqual({ jugadorId: "a", votos: 2, empate: false });
  });

  it("en empate decide el voto del principal", () => {
    const votos: VotoFigura[] = [
      { votante: "dt_local", jugadorId: "a" },
      { votante: "dt_visitante", jugadorId: "b" },
      { votante: "segundo_arbitro", jugadorId: "a" },
      { votante: "principal", jugadorId: "b" },
    ];
    expect(ganadorFigura(votos)).toEqual({ jugadorId: "b", votos: 2, empate: true });
  });

  it("empate sin voto del principal no define ganador", () => {
    const votos: VotoFigura[] = [
      { votante: "dt_local", jugadorId: "a" },
      { votante: "dt_visitante", jugadorId: "b" },
    ];
    expect(ganadorFigura(votos)).toBeNull();
  });
});
