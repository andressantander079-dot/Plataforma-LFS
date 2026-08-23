import { describe, expect, it } from "vitest";
import {
  calcularEdad,
  calcularEsMenor,
  anioDeFecha,
  categoriaSugeridaPorAnio,
  validarCategoriasPorAnio,
  type CategoriaConRango,
} from "../lib/core/rules/jugadoresRules";
import {
  fechaRetornoValida,
  generarTextoConsentimiento,
  generarTextoTutor,
  nombreTramite,
} from "../lib/core/rules/pasesRules";

// Fecha de referencia fija para tests determinísticos
const HOY = new Date("2026-08-24T12:00:00");

const CATEGORIAS: CategoriaConRango[] = [
  { id: "cat-sub12", name: "Sub-12", level_hierarchy: 1, anio_desde: 2014, anio_hasta: 2015 },
  { id: "cat-sub16", name: "Sub-16", level_hierarchy: 2, anio_desde: 2010, anio_hasta: 2011 },
  { id: "cat-sub20", name: "Sub-20", level_hierarchy: 3, anio_desde: 2006, anio_hasta: 2007 },
  { id: "cat-primera", name: "Primera", level_hierarchy: 4, anio_desde: null, anio_hasta: null },
];

// ============================================================================
// calcularEsMenor / calcularEdad
// ============================================================================

describe("calcularEsMenor", () => {
  it("un chico de 15 años es menor", () => {
    expect(calcularEsMenor("2011-03-10", HOY)).toBe(true);
  });

  it("un adulto de 25 años no es menor", () => {
    expect(calcularEsMenor("2001-03-10", HOY)).toBe(false);
  });

  it("el día del 18° cumpleaños ya NO es menor", () => {
    expect(calcularEsMenor("2008-08-24", HOY)).toBe(false);
  });

  it("un día antes del 18° cumpleaños todavía es menor", () => {
    expect(calcularEsMenor("2008-08-25", HOY)).toBe(true);
  });

  it("sin fecha de nacimiento no se considera menor", () => {
    expect(calcularEsMenor(null, HOY)).toBe(false);
  });

  it("fecha inválida no se considera menor", () => {
    expect(calcularEsMenor("no-es-fecha", HOY)).toBe(false);
  });
});

describe("calcularEdad", () => {
  it("calcula la edad antes del cumpleaños del año", () => {
    expect(calcularEdad("2000-12-31", HOY)).toBe(25);
  });

  it("calcula la edad después del cumpleaños del año", () => {
    expect(calcularEdad("2000-01-01", HOY)).toBe(26);
  });

  it("devuelve null si la fecha es inválida", () => {
    expect(calcularEdad("xyz", HOY)).toBeNull();
  });
});

// ============================================================================
// anioDeFecha
// ============================================================================

describe("anioDeFecha", () => {
  it("extrae el año de una fecha ISO", () => {
    expect(anioDeFecha("2011-05-20")).toBe(2011);
  });

  it("devuelve null para null o vacío", () => {
    expect(anioDeFecha(null)).toBeNull();
    expect(anioDeFecha("")).toBeNull();
  });

  it("devuelve null para años absurdos", () => {
    expect(anioDeFecha("1800-01-01")).toBeNull();
  });
});

// ============================================================================
// categoriaSugeridaPorAnio / validarCategoriasPorAnio
// ============================================================================

describe("categoriaSugeridaPorAnio", () => {
  it("sugiere la categoría cuyo rango contiene el año", () => {
    expect(categoriaSugeridaPorAnio(2011, CATEGORIAS)?.name).toBe("Sub-16");
    expect(categoriaSugeridaPorAnio(2014, CATEGORIAS)?.name).toBe("Sub-12");
  });

  it("devuelve null si ningún rango contiene el año", () => {
    expect(categoriaSugeridaPorAnio(1990, CATEGORIAS)).toBeNull();
  });

  it("devuelve null si no hay rangos configurados", () => {
    const sinRangos = CATEGORIAS.map((c) => ({ ...c, anio_desde: null, anio_hasta: null }));
    expect(categoriaSugeridaPorAnio(2011, sinRangos)).toBeNull();
  });
});

describe("validarCategoriasPorAnio", () => {
  it("acepta cuando la categoría base coincide con la sugerida", () => {
    const r = validarCategoriasPorAnio(2011, ["cat-sub16"], CATEGORIAS);
    expect(r.ok).toBe(true);
  });

  it("acepta jugar en su categoría y además subir a una mayor", () => {
    const r = validarCategoriasPorAnio(2011, ["cat-sub16", "cat-sub20"], CATEGORIAS);
    expect(r.ok).toBe(true);
  });

  it("rechaza una categoría menor y sugiere la correcta", () => {
    const r = validarCategoriasPorAnio(2011, ["cat-sub12"], CATEGORIAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Sub-16");
  });

  it("rechaza si solo elige una categoría mayor sin la base", () => {
    const r = validarCategoriasPorAnio(2011, ["cat-sub20"], CATEGORIAS);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Sub-16");
  });

  it("no bloquea si el año queda fuera de todos los rangos", () => {
    const r = validarCategoriasPorAnio(1990, ["cat-primera"], CATEGORIAS);
    expect(r.ok).toBe(true);
  });

  it("no bloquea si la liga no configuró rangos", () => {
    const sinRangos = CATEGORIAS.map((c) => ({ ...c, anio_desde: null, anio_hasta: null }));
    const r = validarCategoriasPorAnio(2011, ["cat-primera"], sinRangos);
    expect(r.ok).toBe(true);
  });

  it("no bloquea si no hay categorías seleccionadas", () => {
    const r = validarCategoriasPorAnio(2011, [], CATEGORIAS);
    expect(r.ok).toBe(true);
  });
});

// ============================================================================
// fechaRetornoValida
// ============================================================================

describe("fechaRetornoValida", () => {
  it("pase definitivo no necesita fecha de retorno", () => {
    expect(fechaRetornoValida(null, "definitivo", HOY).ok).toBe(true);
  });

  it("préstamo sin fecha de retorno es error", () => {
    const r = fechaRetornoValida(null, "prestamo", HOY);
    expect(r.ok).toBe(false);
  });

  it("préstamo con fecha futura es válido", () => {
    expect(fechaRetornoValida("2026-12-31", "prestamo", HOY).ok).toBe(true);
  });

  it("préstamo con retorno el mismo día es error", () => {
    const r = fechaRetornoValida("2026-08-24", "prestamo", HOY);
    expect(r.ok).toBe(false);
  });

  it("préstamo con fecha pasada es error", () => {
    const r = fechaRetornoValida("2020-01-01", "prestamo", HOY);
    expect(r.ok).toBe(false);
  });

  it("préstamo con fecha inválida es error", () => {
    const r = fechaRetornoValida("32/13/2026", "prestamo", HOY);
    expect(r.ok).toBe(false);
  });
});

// ============================================================================
// Documento de conformidad
// ============================================================================

describe("nombreTramite", () => {
  it("definitivo", () => {
    expect(nombreTramite("definitivo")).toBe("PASE DEFINITIVO");
  });

  it("préstamo", () => {
    expect(nombreTramite("prestamo")).toBe("PASE A PRÉSTAMO");
  });
});

describe("generarTextoConsentimiento", () => {
  const base = {
    jugador: "Santander, Andrés",
    dni: "45222333",
    clubOrigen: "Club A",
    clubDestino: "Club B",
  };

  it("pase definitivo: menciona el trámite, el jugador, el DNI y los clubes", () => {
    const texto = generarTextoConsentimiento({ ...base, tipo: "definitivo" });
    expect(texto).toContain("PASE DEFINITIVO");
    expect(texto).toContain("Santander, Andrés");
    expect(texto).toContain("45222333");
    expect(texto).toContain("Club A");
    expect(texto).toContain("Club B");
    expect(texto).not.toContain("retornará automáticamente");
  });

  it("préstamo: incluye trámite, fecha de retorno legible, torneo y retorno automático", () => {
    const texto = generarTextoConsentimiento({
      ...base,
      tipo: "prestamo",
      fechaRetorno: "2026-12-31",
      torneo: "Apertura 2026",
    });
    expect(texto).toContain("PASE A PRÉSTAMO");
    expect(texto).toContain("31/12/2026");
    expect(texto).toContain("Apertura 2026");
    expect(texto).toContain("retornará automáticamente");
  });
});

describe("generarTextoTutor", () => {
  it("incluye parentesco, nombre, apellido y DNI del tutor", () => {
    const texto = generarTextoTutor({
      parentesco: "madre",
      nombre: "Rocío",
      apellido: "González",
      dni: "30111222",
    });
    expect(texto).toContain("AUTORIZACIÓN");
    expect(texto).toContain("madre");
    expect(texto).toContain("González, Rocío");
    expect(texto).toContain("30111222");
  });
});
