import { describe, it, expect } from "vitest";
import {
  validarReglasMercado,
  textoRecargo,
  calcularRecargoRescision,
  estadoVentana,
  ultimaActividadPase,
  estaTrabado,
  tabDelPase,
  accionPrincipalAdmin,
  calcularCargoPrevisto,
  armarChecklist,
  timelineDePase,
  type ReglasMercadoInput,
} from "../lib/core/rules/tramitesRules";

const base: ReglasMercadoInput = {
  tenencia_anios: 1,
  recargo_modo: "fijo",
  recargo_valor: 0,
  alerta_trabado_horas: 48,
  cancelacion_trabado_horas: 72,
  aviso_retorno_horas: 72,
  cupo_plantel: 25,
  firma_obligatoria: true,
};

describe("validarReglasMercado", () => {
  it("acepta la configuración base", () => {
    expect(validarReglasMercado(base).ok).toBe(true);
  });
  it("rechaza cancelación anterior o igual a la alerta", () => {
    expect(validarReglasMercado({ ...base, cancelacion_trabado_horas: 48 }).ok).toBe(false);
  });
  it("rechaza multiplicador menor a 1", () => {
    expect(
      validarReglasMercado({ ...base, recargo_modo: "multiplicador", recargo_valor: 0.5 }).ok
    ).toBe(false);
  });
  it("rechaza cupo fuera de rango", () => {
    expect(validarReglasMercado({ ...base, cupo_plantel: 5 }).ok).toBe(false);
  });
});

describe("textoRecargo y calcularRecargoRescision", () => {
  it("fijo 0 = sin recargo", () => {
    expect(textoRecargo("fijo", 0)).toBe("Sin recargo por rescisión");
    expect(calcularRecargoRescision("fijo", 0, 5000)).toBe(0);
  });
  it("fijo con monto", () => {
    expect(calcularRecargoRescision("fijo", 8000, 5000)).toBe(8000);
  });
  it("multiplicador 1 = sin recargo", () => {
    expect(calcularRecargoRescision("multiplicador", 1, 5000)).toBe(0);
  });
  it("multiplicador aplica sobre la tarifa del préstamo", () => {
    expect(calcularRecargoRescision("multiplicador", 1.5, 10000)).toBe(15000);
  });
});

describe("estadoVentana", () => {
  it("próxima / abierta / cerrada según la fecha de hoy", () => {
    expect(estadoVentana("2026-03-01", "2026-03-31", "2026-02-15")).toBe("proxima");
    expect(estadoVentana("2026-03-01", "2026-03-31", "2026-03-15")).toBe("abierta");
    expect(estadoVentana("2026-03-01", "2026-03-31", "2026-04-01")).toBe("cerrada");
  });
});

describe("trabados", () => {
  const hace = (horas: number) => new Date(Date.now() - horas * 3600000).toISOString();

  it("ultimaActividadPase toma el timestamp más reciente", () => {
    const pase = {
      created_at: "2026-01-01T10:00:00Z",
      approved_at: "2026-01-03T10:00:00Z",
      metadata: { firmado_at: "2026-01-05T10:00:00Z" },
    };
    expect(ultimaActividadPase(pase)).toBe(new Date("2026-01-05T10:00:00Z").toISOString());
  });

  it("está trabado si supera las horas de alerta en estado de espera", () => {
    expect(estaTrabado("2_FVF_REVIEW", hace(50), 48)).toBe(true);
    expect(estaTrabado("2_FVF_REVIEW", hace(10), 48)).toBe(false);
  });

  it("también se traba esperando dictamen o firma", () => {
    expect(estaTrabado("4_CLUB_B_DECISION", hace(60), 48)).toBe(true);
    expect(estaTrabado("5_PLAYER_SIGNATURE", hace(60), 48)).toBe(true);
  });

  it("nunca se traba en estados terminales", () => {
    expect(estaTrabado("7_COMPLETED", hace(500), 48)).toBe(false);
    expect(estaTrabado("8_RECHAZADO", hace(500), 48)).toBe(false);
  });
});

describe("tabDelPase", () => {
  const hace = (horas: number) => new Date(Date.now() - horas * 3600000).toISOString();
  it("terminales van al historial", () => {
    expect(tabDelPase("7_COMPLETED", hace(1), 48)).toBe("historial");
  });
  it("trabado manda aunque sea turno de la liga", () => {
    expect(tabDelPase("2_FVF_REVIEW", hace(60), 48)).toBe("trabados");
  });
  it("turno de la liga sin trabar = pendientes", () => {
    expect(tabDelPase("2_FVF_REVIEW", hace(2), 48)).toBe("pendientes");
    expect(tabDelPase("6_FINAL_AUDIT", hace(2), 48)).toBe("pendientes");
  });
  it("esperando a otros = en curso", () => {
    expect(tabDelPase("4_CLUB_B_DECISION", hace(2), 48)).toBe("en_curso");
    expect(tabDelPase("5_PLAYER_SIGNATURE", hace(2), 48)).toBe("en_curso");
  });
});

describe("accionPrincipalAdmin", () => {
  it("trabado propone recordar", () => {
    expect(accionPrincipalAdmin("2_FVF_REVIEW", true).accion).toBe("recordar");
  });
  it("revisión propone aprobar", () => {
    expect(accionPrincipalAdmin("2_FVF_REVIEW", false).accion).toBe("aprobar_revision");
  });
  it("auditoría final propone completar", () => {
    expect(accionPrincipalAdmin("6_FINAL_AUDIT", false).accion).toBe("completar");
  });
  it("terminado no propone nada", () => {
    expect(accionPrincipalAdmin("7_COMPLETED", false).accion).toBe("ninguna");
  });
});

describe("calcularCargoPrevisto", () => {
  const fees = [
    { category_id: "cat1", competition_id: null, tipo: "definitivo", monto: 12000 },
    { category_id: "cat1", competition_id: "torneo9", tipo: "definitivo", monto: 20000 },
    { category_id: "cat1", competition_id: null, tipo: "prestamo", monto: 5000 },
  ];
  it("usa la regla del torneo si existe", () => {
    const r = calcularCargoPrevisto({ fees, categoriaBaseId: "cat1", competitionId: "torneo9", tipoPase: "definitivo" });
    expect(r).toEqual({ monto: 20000, origen: "torneo" });
  });
  it("cae a la regla general si el torneo no tiene", () => {
    const r = calcularCargoPrevisto({ fees, categoriaBaseId: "cat1", competitionId: "otro", tipoPase: "definitivo" });
    expect(r).toEqual({ monto: 12000, origen: "general" });
  });
  it("sin categoría base = sin cargo", () => {
    expect(calcularCargoPrevisto({ fees, categoriaBaseId: null, competitionId: null, tipoPase: "definitivo" }).monto).toBe(0);
  });
});

describe("armarChecklist", () => {
  it("todo en verde cuando está completo", () => {
    const items = armarChecklist({
      tieneDocumentos: true, ventanaAbierta: true, tieneDeudaBloqueante: false,
      deudaSaldada: false, firmaObligatoria: true, firmado: true, cupoPlantel: 25, jugadoresActuales: 20,
    });
    expect(items.every((i) => i.ok)).toBe(true);
  });
  it("deuda bloqueante sin saldar da cruz", () => {
    const items = armarChecklist({
      tieneDocumentos: true, ventanaAbierta: true, tieneDeudaBloqueante: true,
      deudaSaldada: false, firmaObligatoria: true, firmado: true, cupoPlantel: 25, jugadoresActuales: 20,
    });
    expect(items.find((i) => i.id === "deuda")?.ok).toBe(false);
  });
  it("deuda saldada vuelve a verde", () => {
    const items = armarChecklist({
      tieneDocumentos: true, ventanaAbierta: true, tieneDeudaBloqueante: true,
      deudaSaldada: true, firmaObligatoria: true, firmado: true, cupoPlantel: 25, jugadoresActuales: 20,
    });
    expect(items.find((i) => i.id === "deuda")?.ok).toBe(true);
  });
  it("cupo completo da cruz", () => {
    const items = armarChecklist({
      tieneDocumentos: true, ventanaAbierta: true, tieneDeudaBloqueante: false,
      deudaSaldada: false, firmaObligatoria: false, firmado: false, cupoPlantel: 25, jugadoresActuales: 25,
    });
    expect(items.find((i) => i.id === "cupo")?.ok).toBe(false);
  });
});

describe("timelineDePase", () => {
  it("ordena cronológicamente y omite lo que no pasó", () => {
    const tl = timelineDePase({
      created_at: "2026-01-01T10:00:00Z",
      approved_at: "2026-01-02T10:00:00Z",
      metadata: { firmado_at: "2026-01-04T10:00:00Z", completado_at: "2026-01-05T10:00:00Z" },
    });
    expect(tl.map((e) => e.clave)).toEqual(["solicitud", "revision", "firma", "completado"]);
  });
  it("incluye rechazo cuando corresponde", () => {
    const tl = timelineDePase({
      created_at: "2026-01-01T10:00:00Z",
      approved_at: null,
      metadata: { rechazado_at: "2026-01-02T10:00:00Z" },
    });
    expect(tl.map((e) => e.clave)).toEqual(["solicitud", "rechazado"]);
  });
});
