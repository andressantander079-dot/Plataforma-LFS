import { describe, expect, it } from "vitest";
import {
  aQuienLeToca,
  esEstadoTerminal,
  ESTADO_PASE_UI,
  ESTADOS_TERMINALES,
  isCredentialActive,
  PASOS_CIRCUITO,
  progresoPase,
  validarElegibilidadCategoria,
  InscripcionJugadorInputSchema,
  PaseSettingsSchema,
  RangoCategoriaSchema,
  TransferFeeInputSchema,
  TransferWindowInputSchema,
  type EstadoPase,
  type CategoriaElegibilidad,
} from "../lib/core/rules/pasesRules";

describe("Pases — credencial de firma (72 hs)", () => {
  it("sigue activa dentro de las 72 horas", () => {
    const hace12hs = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    expect(isCredentialActive(hace12hs)).toBe(true);
  });

  it("vence después de las 72 horas", () => {
    const hace80hs = new Date(Date.now() - 80 * 3600 * 1000).toISOString();
    expect(isCredentialActive(hace80hs)).toBe(false);
  });

  it("sin fecha de aprobación no está activa", () => {
    expect(isCredentialActive("")).toBe(false);
  });
});

describe("Pases — máquina de estados", () => {
  it("los estados terminales son completado, rechazado y cancelado", () => {
    expect(esEstadoTerminal("7_COMPLETED")).toBe(true);
    expect(esEstadoTerminal("8_RECHAZADO")).toBe(true);
    expect(esEstadoTerminal("9_CANCELADO")).toBe(true);
    expect(esEstadoTerminal("1_INIT_CLUB_A")).toBe(false);
    expect(esEstadoTerminal("5_PLAYER_SIGNATURE")).toBe(false);
    expect(ESTADOS_TERMINALES).toHaveLength(3);
  });

  it("cada estado tiene su etiqueta de UI", () => {
    const estados: EstadoPase[] = [
      "1_INIT_CLUB_A",
      "2_FVF_REVIEW",
      "3_NOTIFY_CLUB_B",
      "4_CLUB_B_DECISION",
      "5_PLAYER_SIGNATURE",
      "6_FINAL_AUDIT",
      "7_COMPLETED",
      "8_RECHAZADO",
      "9_CANCELADO",
    ];
    for (const e of estados) {
      expect(ESTADO_PASE_UI[e].label.length).toBeGreaterThan(0);
      expect(ESTADO_PASE_UI[e].className.length).toBeGreaterThan(0);
    }
  });

  it("el stepper tiene 5 momentos y cada estado cae en el suyo", () => {
    expect(PASOS_CIRCUITO).toHaveLength(5);
    expect(progresoPase("1_INIT_CLUB_A")).toBe(0);
    expect(progresoPase("2_FVF_REVIEW")).toBe(0);
    expect(progresoPase("4_CLUB_B_DECISION")).toBe(1);
    expect(progresoPase("5_PLAYER_SIGNATURE")).toBe(2);
    expect(progresoPase("6_FINAL_AUDIT")).toBe(3);
    expect(progresoPase("7_COMPLETED")).toBe(4);
  });

  it("los estados terminales malos rompen el stepper (-1)", () => {
    expect(progresoPase("8_RECHAZADO")).toBe(-1);
    expect(progresoPase("9_CANCELADO")).toBe(-1);
  });

  it("cada estado sabe a quién le toca actuar", () => {
    expect(aQuienLeToca("1_INIT_CLUB_A")).toContain("liga");
    expect(aQuienLeToca("4_CLUB_B_DECISION")).toContain("club de origen");
    expect(aQuienLeToca("5_PLAYER_SIGNATURE")).toContain("jugador");
    expect(aQuienLeToca("6_FINAL_AUDIT")).toContain("liga");
    expect(aQuienLeToca("7_COMPLETED")).toContain("terminó");
  });
});

describe("Domain: validarElegibilidadCategoria (Regla Jugar para Arriba)", () => {
  const CATEGORIAS_MOCK: CategoriaElegibilidad[] = [
    { id: "c1", name: "Sub-14", level_hierarchy: 1, anio_desde: 2012, anio_hasta: 2013 },
    { id: "c2", name: "Sub-16", level_hierarchy: 2, anio_desde: 2010, anio_hasta: 2011 },
    { id: "c3", name: "Sub-18", level_hierarchy: 3, anio_desde: 2008, anio_hasta: 2009 },
    { id: "c4", name: "Primera", level_hierarchy: 4, anio_desde: null, anio_hasta: null },
  ];

  it("permite inscribir en la categoría base correspondiente al año de nacimiento", () => {
    const res = validarElegibilidadCategoria(2010, ["c2"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(true);
    expect(res.sugerida?.name).toBe("Sub-16");
  });

  it("permite jugar para arriba (base Sub-16 + mayor Sub-18)", () => {
    const res = validarElegibilidadCategoria(2010, ["c2", "c3"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(true);
  });

  it("permite jugar para arriba sumando Primera división", () => {
    const res = validarElegibilidadCategoria(2010, ["c2", "c4"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(true);
  });

  it("bloquea estrictamente la inscripción en una categoría inferior", () => {
    const res = validarElegibilidadCategoria(2010, ["c1"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("no puede competir en Sub-14");
    expect(res.error).toContain("Su categoría base es Sub-16");
  });

  it("rechaza si se seleccionan solo categorías superiores omitiendo la categoría base", () => {
    const res = validarElegibilidadCategoria(2010, ["c3"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("debe incluir obligatoriamente su categoría base (Sub-16)");
  });

  it("permite cualquier categoría si el año cae fuera de todos los rangos (ej: Primera libre)", () => {
    const res = validarElegibilidadCategoria(1995, ["c4"], CATEGORIAS_MOCK);
    expect(res.valid).toBe(true);
    expect(res.sugerida).toBeUndefined();
    expect(res.permitidasIds).toHaveLength(4);
  });
});

describe("Zod Validation Schemas", () => {
  it("InscripcionJugadorInputSchema valida datos completos correctos", () => {
    const res = InscripcionJugadorInputSchema.safeParse({
      dni: "44111222",
      first_name: "Andrés",
      last_name: "Santander",
      fecha_nacimiento: "2008-05-12",
      foto_path: "club-1/player-1.webp",
      category_ids: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    });
    expect(res.success).toBe(true);
  });

  it("InscripcionJugadorInputSchema rechaza DNI con formato inválido", () => {
    const res = InscripcionJugadorInputSchema.safeParse({
      dni: "44.111.222",
      first_name: "Andrés",
      last_name: "Santander",
      fecha_nacimiento: "2008-05-12",
      foto_path: "club-1/player-1.webp",
      category_ids: ["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    });
    expect(res.success).toBe(false);
  });

  it("PaseSettingsSchema valida parámetros coherentes", () => {
    const res = PaseSettingsSchema.safeParse({
      tenencia_anios: 2,
      recargo_rescision: 15000,
      alerta_trabado_horas: 48,
      cancelacion_trabado_horas: 72,
      aviso_retorno_horas: 24,
    });
    expect(res.success).toBe(true);
  });

  it("PaseSettingsSchema rechaza si cancelación <= alerta", () => {
    const res = PaseSettingsSchema.safeParse({
      tenencia_anios: 2,
      recargo_rescision: 15000,
      alerta_trabado_horas: 72,
      cancelacion_trabado_horas: 48,
      aviso_retorno_horas: 24,
    });
    expect(res.success).toBe(false);
  });

  it("RangoCategoriaSchema valida rango de años coherente", () => {
    const res = RangoCategoriaSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      anio_desde: 2010,
      anio_hasta: 2011,
    });
    expect(res.success).toBe(true);
  });

  it("RangoCategoriaSchema rechaza año desde > año hasta", () => {
    const res = RangoCategoriaSchema.safeParse({
      id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      anio_desde: 2015,
      anio_hasta: 2010,
    });
    expect(res.success).toBe(false);
  });

  it("TransferFeeInputSchema valida monto positivo y tipo", () => {
    const res = TransferFeeInputSchema.safeParse({
      category_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      tipo: "definitivo",
      monto: 25000,
    });
    expect(res.success).toBe(true);
  });

  it("TransferWindowInputSchema valida fechas cronológicas", () => {
    const res = TransferWindowInputSchema.safeParse({
      nombre: "Mercado Apertura 2026",
      fecha_desde: "2026-03-01",
      fecha_hasta: "2026-03-31",
    });
    expect(res.success).toBe(true);
  });

  it("TransferWindowInputSchema rechaza fecha fin anterior a inicio", () => {
    const res = TransferWindowInputSchema.safeParse({
      nombre: "Mercado Apertura 2026",
      fecha_desde: "2026-03-31",
      fecha_hasta: "2026-03-01",
    });
    expect(res.success).toBe(false);
  });
});
