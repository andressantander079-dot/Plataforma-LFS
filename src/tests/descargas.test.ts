import { describe, expect, it } from "vitest";
import {
  CARPETAS_DESCARGAS,
  esCarpetaValida,
  formatoDeArchivo,
  ordenarDocumentos,
  ordenarVersiones,
  siguienteVersion,
  textoTamano,
  validarArchivoDescarga,
  validarDocumento,
} from "../lib/core/rules/descargasRules";

describe("carpetas fijas", () => {
  it("son exactamente las 4 reglamentarias", () => {
    expect(CARPETAS_DESCARGAS).toEqual(["Reglamentos", "Boletines", "Formularios", "Planillas"]);
    expect(esCarpetaValida("Reglamentos")).toBe(true);
    expect(esCarpetaValida("Otra")).toBe(false);
  });
});

describe("formatos y tamaño", () => {
  it("mapea extensiones a formato lógico", () => {
    expect(formatoDeArchivo("reglamento.pdf")).toBe("PDF");
    expect(formatoDeArchivo("acta.DOCX")).toBe("DOCX");
    expect(formatoDeArchivo("planilla.xls")).toBe("XLSX");
    expect(formatoDeArchivo("planilla.xlsx")).toBe("XLSX");
    expect(formatoDeArchivo("foto.webp")).toBe("Imagen");
    expect(formatoDeArchivo("virus.exe")).toBe(null);
    expect(formatoDeArchivo("sinextension")).toBe(null);
  });

  it("textoTamano formatea como el mock", () => {
    expect(textoTamano(450)).toBe("450 B");
    expect(textoTamano(820 * 1024)).toBe("820 KB");
    expect(textoTamano(1.4 * 1024 * 1024)).toBe("1.4 MB");
    expect(textoTamano(12 * 1024 * 1024)).toBe("12 MB");
  });

  it("valida extensión permitida y límite de 10 MB", () => {
    expect(validarArchivoDescarga("doc.pdf", 1024)).toBe(null);
    expect(validarArchivoDescarga("doc.exe", 1024)).toBeTruthy();
    expect(validarArchivoDescarga("doc.pdf", 11 * 1024 * 1024)).toBeTruthy();
  });
});

describe("ordenamiento", () => {
  it("fijados primero, luego orden manual, luego alfabético", () => {
    const docs = ordenarDocumentos([
      { nombre: "Beta", fijado: false, orden: 0 },
      { nombre: "Zeta", fijado: true, orden: 5 },
      { nombre: "Alfa", fijado: false, orden: 1 },
      { nombre: "Delta", fijado: false, orden: 0 },
    ]);
    expect(docs.map((d) => d.nombre)).toEqual(["Zeta", "Beta", "Delta", "Alfa"]);
  });

  it("versiones de más nueva a más vieja y siguiente número", () => {
    const versiones = ordenarVersiones([{ version: 2 }, { version: 5 }, { version: 1 }]);
    expect(versiones.map((v) => v.version)).toEqual([5, 2, 1]);
    expect(siguienteVersion([])).toBe(1);
    expect(siguienteVersion(versiones)).toBe(6);
  });
});

describe("validarDocumento", () => {
  it("acepta un documento correcto", () => {
    expect(validarDocumento({ nombre: "Reglamento 2026", carpeta: "Reglamentos", ambito: "publico" })).toEqual({});
  });

  it("rechaza nombre corto, carpeta y ámbito inválidos", () => {
    expect(validarDocumento({ nombre: "ABC", carpeta: "Reglamentos", ambito: "publico" }).nombre).toBeTruthy();
    expect(validarDocumento({ nombre: "Reglamento 2026", carpeta: "Varios", ambito: "publico" }).carpeta).toBeTruthy();
    expect(validarDocumento({ nombre: "Reglamento 2026", carpeta: "Reglamentos", ambito: "todos" }).ambito).toBeTruthy();
    expect(
      validarDocumento({ nombre: "Reglamento 2026", carpeta: "Reglamentos", ambito: "clubes", descripcion: "x".repeat(300) }).descripcion
    ).toBeTruthy();
  });
});
