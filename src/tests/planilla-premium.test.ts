import { describe, expect, it } from "vitest";
import {
  amarillasDeJugador,
  construirSemaforo,
  esDobleAmarilla,
  faltasAcumuladas,
  formatearMinuto,
  jugadorExpulsado,
  marcadorDesdeEventos,
  minutoTotal,
  nivelFaltas,
  numerosDuplicados,
  puedeIniciarPartido,
  puedePedirTiempo,
  tiemposPedidosUsados,
  type DatosSemaforo,
  type EventoBase,
} from "../lib/core/rules/planillaPremiumRules";

const HOME = "team-local";
const AWAY = "team-visitante";

const datosOk: DatosSemaforo = {
  convocatoriaLocalConfirmada: true,
  convocatoriaVisitanteConfirmada: true,
  titularesLocal: 5,
  titularesVisitante: 6,
  capitanLocal: true,
  capitanVisitante: true,
  numerosDuplicadosLocal: [],
  numerosDuplicadosVisitante: [],
  segundoArbitroAsignado: true,
  planilleroAsignado: false,
};

describe("semáforo pre-partido", () => {
  it("todo en verde habilita el inicio", () => {
    const items = construirSemaforo(datosOk);
    expect(puedeIniciarPartido(items)).toBe(true);
  });

  it("convocatoria sin confirmar bloquea", () => {
    const items = construirSemaforo({ ...datosOk, convocatoriaVisitanteConfirmada: false });
    expect(puedeIniciarPartido(items)).toBe(false);
    const item = items.find((i) => i.clave === "convocatorias");
    expect(item?.estado).toBe("bloqueante");
    expect(item?.detalle).toContain("visitante");
  });

  it("menos de 5 titulares bloquea", () => {
    const items = construirSemaforo({ ...datosOk, titularesLocal: 4 });
    expect(items.find((i) => i.clave === "titulares")?.estado).toBe("bloqueante");
    expect(puedeIniciarPartido(items)).toBe(false);
  });

  it("sin 2do árbitro solo advierte (no bloquea)", () => {
    const items = construirSemaforo({ ...datosOk, segundoArbitroAsignado: false });
    expect(items.find((i) => i.clave === "segundo_arbitro")?.estado).toBe("advertencia");
    expect(puedeIniciarPartido(items)).toBe(true);
  });

  it("capitán faltante bloquea", () => {
    const items = construirSemaforo({ ...datosOk, capitanVisitante: false });
    expect(items.find((i) => i.clave === "capitanes")?.estado).toBe("bloqueante");
  });

  it("números duplicados bloquean", () => {
    const items = construirSemaforo({ ...datosOk, numerosDuplicadosLocal: [7, 10] });
    expect(items.find((i) => i.clave === "numeros")?.estado).toBe("bloqueante");
  });
});

describe("números de camiseta", () => {
  it("detecta repetidos ignorando nulls", () => {
    expect(numerosDuplicados([1, 2, 2, 3, null, 3, 3, null])).toEqual([2, 3]);
    expect(numerosDuplicados([1, 2, 3])).toEqual([]);
    expect(numerosDuplicados([null, null])).toEqual([]);
  });
});

describe("faltas acumuladas", () => {
  const eventos: EventoBase[] = [
    { tipo: "falta", teamId: HOME, playerId: "p1", tiempo: "PT" },
    { tipo: "falta", teamId: HOME, playerId: "p2", tiempo: "PT" },
    { tipo: "falta", teamId: HOME, playerId: "p1", tiempo: "ST" },
    { tipo: "falta", teamId: AWAY, playerId: "p9", tiempo: "PT" },
    { tipo: "gol", teamId: HOME, playerId: "p1", tiempo: "PT" },
  ];

  it("cuenta por equipo y tiempo, ignorando otros eventos", () => {
    const faltas = faltasAcumuladas(eventos, HOME, AWAY);
    expect(faltas.local).toEqual({ PT: 2, ST: 1 });
    expect(faltas.visitante).toEqual({ PT: 1, ST: 0 });
  });

  it("niveles: aviso en la 4ta, límite en la 5ta", () => {
    expect(nivelFaltas(3)).toBe("normal");
    expect(nivelFaltas(4)).toBe("aviso");
    expect(nivelFaltas(5)).toBe("limite");
    expect(nivelFaltas(7)).toBe("limite");
  });
});

describe("tarjetas y doble amarilla", () => {
  const eventos: EventoBase[] = [
    { tipo: "amarilla", teamId: HOME, playerId: "p1", tiempo: "PT" },
  ];

  it("cuenta amarillas del jugador", () => {
    expect(amarillasDeJugador(eventos, "p1")).toBe(1);
    expect(amarillasDeJugador(eventos, "p2")).toBe(0);
  });

  it("la segunda amarilla sugiere roja", () => {
    expect(esDobleAmarilla(eventos, "p1")).toBe(true);
    expect(esDobleAmarilla(eventos, "p2")).toBe(false);
  });

  it("si ya fue expulsado no sugiere de nuevo", () => {
    const conRoja: EventoBase[] = [...eventos, { tipo: "roja", teamId: HOME, playerId: "p1", tiempo: "PT" as const }];
    expect(jugadorExpulsado(conRoja, "p1")).toBe(true);
    expect(esDobleAmarilla(conRoja, "p1")).toBe(false);
  });
});

describe("tiempos pedidos", () => {
  it("uno por equipo por tiempo", () => {
    const eventos: EventoBase[] = [
      { tipo: "tiempo_muerto", teamId: HOME, playerId: null, tiempo: "PT" },
    ];
    expect(puedePedirTiempo(eventos, HOME, "PT")).toBe(false);
    expect(puedePedirTiempo(eventos, HOME, "ST")).toBe(true);
    expect(puedePedirTiempo(eventos, AWAY, "PT")).toBe(true);
  });

  it("conteo usados por equipo", () => {
    const eventos: EventoBase[] = [
      { tipo: "tiempo_muerto", teamId: HOME, playerId: null, tiempo: "PT" },
      { tipo: "tiempo_muerto", teamId: HOME, playerId: null, tiempo: "ST" },
      { tipo: "tiempo_muerto", teamId: AWAY, playerId: null, tiempo: "PT" },
    ];
    const usados = tiemposPedidosUsados(eventos, HOME, AWAY);
    expect(usados.local).toEqual({ PT: 1, ST: 1 });
    expect(usados.visitante).toEqual({ PT: 1, ST: 0 });
  });
});

describe("formato de minuto y marcador", () => {
  it("12' PT / 7' ST", () => {
    expect(formatearMinuto(12, "PT")).toBe("12' PT");
    expect(formatearMinuto(7, "ST")).toBe("7' ST");
    expect(formatearMinuto(null, null)).toBe("—");
  });

  it("minuto total suma la duración del PT en el ST", () => {
    expect(minutoTotal(10, "PT", 25)).toBe(10);
    expect(minutoTotal(7, "ST", 25)).toBe(32);
  });

  it("el gol en contra suma al rival", () => {
    const eventos: EventoBase[] = [
      { tipo: "gol", teamId: HOME, playerId: "p1" },
      { tipo: "gol", teamId: AWAY, playerId: "p9" },
      { tipo: "gol_en_contra", teamId: AWAY, playerId: "p8" }, // suma al LOCAL
    ];
    expect(marcadorDesdeEventos(eventos, HOME, AWAY)).toEqual({ local: 2, visitante: 1 });
  });
});
