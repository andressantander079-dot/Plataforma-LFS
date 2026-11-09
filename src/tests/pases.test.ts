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
  FeePaseSchema,
  VentanaMercadoSchema,
  IdSchema,
  feePaseADb,
  ventanaADb,
  type EstadoPase,
  type PlayerStatus,
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


// ============================================================================
// FASE 1 — Casos borde de dominio (inscripción vía RPC y configuración de pases)
// ============================================================================

const UUID_OK = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const ANIO_ACTUAL = new Date().getFullYear();

describe("Dominio: validarElegibilidadCategoria — casos borde", () => {
  const CATS: CategoriaElegibilidad[] = [
    { id: "c1", name: "Sub-14", level_hierarchy: 1, anio_desde: 2012, anio_hasta: 2013 },
    { id: "c2", name: "Sub-16", level_hierarchy: 2, anio_desde: 2010, anio_hasta: 2011 },
    { id: "c3", name: "Sub-18", level_hierarchy: 3, anio_desde: 2008, anio_hasta: 2009 },
    { id: "c4", name: "Primera", level_hierarchy: 4, anio_desde: null, anio_hasta: null },
  ];

  it("toma como base el límite inferior del rango (2012 → Sub-14)", () => {
    const res = validarElegibilidadCategoria(2012, ["c1"], CATS);
    expect(res.valid).toBe(true);
    expect(res.sugerida?.id).toBe("c1");
  });

  it("toma como base el límite superior del rango (2013 → Sub-14)", () => {
    const res = validarElegibilidadCategoria(2013, ["c1"], CATS);
    expect(res.valid).toBe(true);
    expect(res.sugerida?.id).toBe("c1");
  });

  it("el año inmediatamente fuera del rango cae en la categoría vecina", () => {
    expect(validarElegibilidadCategoria(2014, ["c1"], CATS).sugerida).toBeUndefined();
    expect(validarElegibilidadCategoria(2011, ["c2"], CATS).sugerida?.id).toBe("c2");
  });

  it("permite jugar para arriba con varias categorías a la vez (base + todas las superiores)", () => {
    const res = validarElegibilidadCategoria(2012, ["c1", "c2", "c3", "c4"], CATS);
    expect(res.valid).toBe(true);
  });

  it("las permitidas son la base y las de jerarquía superior, nunca las inferiores", () => {
    const res = validarElegibilidadCategoria(2008, ["c3"], CATS);
    expect(res.permitidasIds).toEqual(["c3", "c4"]);
    expect(res.permitidasIds).not.toContain("c1");
    expect(res.permitidasIds).not.toContain("c2");
  });

  it("bloquea una inferior aunque la base también esté seleccionada", () => {
    const res = validarElegibilidadCategoria(2010, ["c1", "c2"], CATS);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("no puede competir en Sub-14");
  });

  it("al elegir varias superiores sin la base, exige la base", () => {
    const res = validarElegibilidadCategoria(2010, ["c3", "c4"], CATS);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("categoría base (Sub-16)");
  });

  it("sin categorías configuradas, cualquier selección es válida", () => {
    const res = validarElegibilidadCategoria(2010, ["x"], []);
    expect(res.valid).toBe(true);
    expect(res.permitidasIds).toEqual([]);
  });
});

describe("Tipos: PlayerStatus", () => {
  it("acepta exactamente los 5 estados que permite el CHECK de la base", () => {
    const estados: PlayerStatus[] = ["pendiente", "activo", "en_deuda", "denegado", "inactivo"];
    expect(new Set(estados).size).toBe(5);
  });
});

describe("InscripcionJugadorInputSchema — casos borde", () => {
  const base = {
    dni: "44111222",
    first_name: "Andrés",
    last_name: "Santander",
    fecha_nacimiento: "2008-05-12",
    foto_path: "club-1/player-1.webp",
    category_ids: [UUID_OK],
  };

  it("acepta un DNI de 8 dígitos y un player_id UUID opcional", () => {
    expect(InscripcionJugadorInputSchema.safeParse(base).success).toBe(true);
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, player_id: UUID_OK }).success).toBe(true);
  });

  it("acepta los extremos de longitud del DNI (6 y 10 dígitos)", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, dni: "123456" }).success).toBe(true);
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, dni: "1234567890" }).success).toBe(true);
  });

  it("rechaza DNI con puntos", () => {
    const res = InscripcionJugadorInputSchema.safeParse({ ...base, dni: "44.111.222" });
    expect(res.success).toBe(false);
  });

  it("rechaza DNI con letras", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, dni: "4411122A" }).success).toBe(false);
  });

  it("rechaza DNI demasiado corto (5) o largo (11)", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, dni: "12345" }).success).toBe(false);
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, dni: "12345678901" }).success).toBe(false);
  });

  it("recorta espacios del DNI antes de validar", () => {
    const res = InscripcionJugadorInputSchema.safeParse({ ...base, dni: "  44111222  " });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.dni).toBe("44111222");
  });

  it("rechaza fechas de nacimiento futuras con mensaje claro", () => {
    const res = InscripcionJugadorInputSchema.safeParse({
      ...base,
      fecha_nacimiento: `${ANIO_ACTUAL + 1}-01-01`,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("no puede ser futura");
    }
  });

  it("rechaza formato de fecha inválido", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, fecha_nacimiento: "12/05/2008" }).success).toBe(false);
  });

  it("rechaza una fecha con formato correcto pero imposible (mes 13)", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, fecha_nacimiento: "2008-13-45" }).success).toBe(false);
  });

  it("exige al menos una categoría", () => {
    const res = InscripcionJugadorInputSchema.safeParse({ ...base, category_ids: [] });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("al menos una categoría");
    }
  });

  it("rechaza categorías que no son UUID", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, category_ids: ["sub-14"] }).success).toBe(false);
  });

  it("rechaza foto_path vacío o solo espacios", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, foto_path: "" }).success).toBe(false);
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, foto_path: "   " }).success).toBe(false);
  });

  it("rechaza nombre o apellido de menos de 2 caracteres", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, first_name: "A" }).success).toBe(false);
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, last_name: " " }).success).toBe(false);
  });

  it("rechaza un player_id que no es UUID", () => {
    expect(InscripcionJugadorInputSchema.safeParse({ ...base, player_id: "abc" }).success).toBe(false);
  });
});

describe("PaseSettingsSchema — casos borde", () => {
  const base = {
    tenencia_anios: 2,
    recargo_rescision: 15000,
    alerta_trabado_horas: 48,
    cancelacion_trabado_horas: 72,
    aviso_retorno_horas: 24,
  };

  it("exige que cancelación sea ESTRICTAMENTE mayor que alerta (igual falla)", () => {
    const res = PaseSettingsSchema.safeParse({ ...base, alerta_trabado_horas: 72, cancelacion_trabado_horas: 72 });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.path).toContain("cancelacion_trabado_horas");
    }
  });

  it("acepta cancelación = alerta + 1", () => {
    const res = PaseSettingsSchema.safeParse({ ...base, alerta_trabado_horas: 48, cancelacion_trabado_horas: 49 });
    expect(res.success).toBe(true);
  });

  it("acepta los límites de horas (1 y 720) y rechaza 0 y 721", () => {
    expect(
      PaseSettingsSchema.safeParse({ ...base, alerta_trabado_horas: 1, cancelacion_trabado_horas: 720, aviso_retorno_horas: 1 })
        .success
    ).toBe(true);
    expect(PaseSettingsSchema.safeParse({ ...base, alerta_trabado_horas: 0 }).success).toBe(false);
    expect(PaseSettingsSchema.safeParse({ ...base, cancelacion_trabado_horas: 721 }).success).toBe(false);
    expect(PaseSettingsSchema.safeParse({ ...base, aviso_retorno_horas: 721 }).success).toBe(false);
  });

  it("limita la tenencia entre 0 y 5 años, enteros", () => {
    expect(PaseSettingsSchema.safeParse({ ...base, tenencia_anios: 0 }).success).toBe(true);
    expect(PaseSettingsSchema.safeParse({ ...base, tenencia_anios: 5 }).success).toBe(true);
    expect(PaseSettingsSchema.safeParse({ ...base, tenencia_anios: 6 }).success).toBe(false);
    expect(PaseSettingsSchema.safeParse({ ...base, tenencia_anios: -1 }).success).toBe(false);
    expect(PaseSettingsSchema.safeParse({ ...base, tenencia_anios: 1.5 }).success).toBe(false);
  });

  it("no admite recargo negativo, pero sí cero", () => {
    expect(PaseSettingsSchema.safeParse({ ...base, recargo_rescision: 0 }).success).toBe(true);
    expect(PaseSettingsSchema.safeParse({ ...base, recargo_rescision: -1 }).success).toBe(false);
  });
});

describe("RangoCategoriaSchema — casos borde", () => {
  it("acepta ambos años en null (categoría sin rango, ej. Primera)", () => {
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: null, anio_hasta: null }).success).toBe(true);
  });

  it("rechaza que solo uno de los dos años esté completo", () => {
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 2010, anio_hasta: null }).success).toBe(false);
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: null, anio_hasta: 2010 }).success).toBe(false);
  });

  it("acepta desde == hasta (una sola generación)", () => {
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 2010, anio_hasta: 2010 }).success).toBe(true);
  });

  it("rechaza años anteriores a 1950 o posteriores al año actual", () => {
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 1949, anio_hasta: 2000 }).success).toBe(false);
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 2000, anio_hasta: ANIO_ACTUAL + 1 }).success).toBe(false);
  });

  it("acepta el año actual como tope y 1950 como piso", () => {
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 1950, anio_hasta: ANIO_ACTUAL }).success).toBe(true);
  });

  it("rechaza ids que no son UUID y años decimales", () => {
    expect(RangoCategoriaSchema.safeParse({ id: "x", anio_desde: 2010, anio_hasta: 2011 }).success).toBe(false);
    expect(RangoCategoriaSchema.safeParse({ id: UUID_OK, anio_desde: 2010.5, anio_hasta: 2011 }).success).toBe(false);
  });
});

describe("VentanaMercadoSchema — casos borde", () => {
  const base = {
    nombre: "Mercado Apertura 2026",
    fecha_inicio: "2026-03-01",
    fecha_fin: "2026-03-31",
    activa: true,
  };

  it("acepta una ventana válida", () => {
    expect(VentanaMercadoSchema.safeParse(base).success).toBe(true);
  });

  it("acepta fecha de inicio igual a la de fin (ventana de un día)", () => {
    expect(VentanaMercadoSchema.safeParse({ ...base, fecha_inicio: "2026-03-10", fecha_fin: "2026-03-10" }).success).toBe(true);
  });

  it("rechaza fin anterior al inicio e indica el campo fecha_fin", () => {
    const res = VentanaMercadoSchema.safeParse({ ...base, fecha_inicio: "2026-03-31", fecha_fin: "2026-03-01" });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toContain("fecha_fin");
  });

  it("exige nombre de al menos 3 caracteres (después de recortar espacios)", () => {
    expect(VentanaMercadoSchema.safeParse({ ...base, nombre: "ab" }).success).toBe(false);
    expect(VentanaMercadoSchema.safeParse({ ...base, nombre: "  ab  " }).success).toBe(false);
    expect(VentanaMercadoSchema.safeParse({ ...base, nombre: "abc" }).success).toBe(true);
  });

  it("rechaza fechas con formato inválido y 'activa' que no sea booleano", () => {
    expect(VentanaMercadoSchema.safeParse({ ...base, fecha_inicio: "01/03/2026" }).success).toBe(false);
    expect(VentanaMercadoSchema.safeParse({ ...base, activa: "si" }).success).toBe(false);
  });

  it("ventanaADb traduce a las columnas reales y descarta 'activa'", () => {
    const parsed = VentanaMercadoSchema.parse(base);
    const fila = ventanaADb(parsed);
    expect(fila).toEqual({
      nombre: "Mercado Apertura 2026",
      fecha_desde: "2026-03-01",
      fecha_hasta: "2026-03-31",
    });
    expect(fila).not.toHaveProperty("activa");
  });
});

describe("FeePaseSchema — casos borde", () => {
  const base = { category_id: UUID_OK, tipo_pase: "definitivo" as const, monto: 25000 };

  it("acepta un derecho de pase válido (tournament_id opcional / nullable)", () => {
    expect(FeePaseSchema.safeParse(base).success).toBe(true);
    expect(FeePaseSchema.safeParse({ ...base, tournament_id: null }).success).toBe(true);
    expect(FeePaseSchema.safeParse({ ...base, tournament_id: UUID_OK, tipo_pase: "prestamo" }).success).toBe(true);
  });

  it("acepta monto 0 y rechaza monto negativo", () => {
    expect(FeePaseSchema.safeParse({ ...base, monto: 0 }).success).toBe(true);
    expect(FeePaseSchema.safeParse({ ...base, monto: -1 }).success).toBe(false);
  });

  it("rechaza un tipo de pase desconocido y categorías que no son UUID", () => {
    expect(FeePaseSchema.safeParse({ ...base, tipo_pase: "cesion" }).success).toBe(false);
    expect(FeePaseSchema.safeParse({ ...base, category_id: "sub-14" }).success).toBe(false);
  });

  it("feePaseADb traduce tipo_pase/tournament_id a tipo/competition_id", () => {
    const parsed = FeePaseSchema.parse({ ...base, tipo_pase: "prestamo", tournament_id: UUID_OK });
    expect(feePaseADb(parsed)).toEqual({
      category_id: UUID_OK,
      tipo: "prestamo",
      competition_id: UUID_OK,
      monto: 25000,
    });
    expect(feePaseADb(FeePaseSchema.parse(base)).competition_id).toBeNull();
  });
});

describe("IdSchema", () => {
  it("acepta UUID y rechaza cualquier otra cosa", () => {
    expect(IdSchema.safeParse(UUID_OK).success).toBe(true);
    expect(IdSchema.safeParse("123").success).toBe(false);
    expect(IdSchema.safeParse("").success).toBe(false);
  });
});
