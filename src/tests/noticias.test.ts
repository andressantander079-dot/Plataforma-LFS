import { describe, expect, it } from "vitest";
import {
  esColorValido,
  esSlugValido,
  esVisiblePublica,
  estadoDerivado,
  extraerYoutubeId,
  limpiarHtml,
  resumenAutomatico,
  slugify,
  tiempoLecturaMin,
  validarImagen,
  validarNoticia,
  validarVideo,
} from "../lib/core/rules/noticiasRules";

describe("slugify", () => {
  it("genera slugs limpios con tildes, ñ y signos", () => {
    expect(slugify("¡Copa de Campeones — Femenino 2026!")).toBe("copa-de-campeones-femenino-2026");
    expect(slugify("Niño, Niña & Señor: Última Hora")).toBe("nino-nina-senor-ultima-hora");
    expect(slugify("  Reglamento   Nuevo!!! ")).toBe("reglamento-nuevo");
  });

  it("respeta el largo máximo y no deja guiones colgados", () => {
    const largo = slugify("palabra-".repeat(30));
    expect(largo.length).toBeLessThanOrEqual(80);
    expect(largo.endsWith("-")).toBe(false);
    expect(esSlugValido(largo)).toBe(true);
  });

  it("valida formato de slug", () => {
    expect(esSlugValido("copa-2026")).toBe(true);
    expect(esSlugValido("Copa 2026")).toBe(false);
    expect(esSlugValido("-copa-")).toBe(false);
    expect(esSlugValido("copa--2026")).toBe(false);
  });
});

describe("contenido", () => {
  it("limpiarHtml deja texto plano", () => {
    expect(limpiarHtml("<p>Hola <b>liga</b></p><p>Segunda&nbsp;línea</p>")).toBe("Hola liga Segunda línea");
    expect(limpiarHtml("<script>alert(1)</script><p>Texto</p>")).toBe("Texto");
  });

  it("tiempoLecturaMin usa 200 ppm con mínimo 1", () => {
    expect(tiempoLecturaMin("<p>uno dos</p>")).toBe(1);
    const palabras = Array(450).fill("palabra").join(" ");
    expect(tiempoLecturaMin(`<p>${palabras}</p>`)).toBe(3);
  });

  it("resumenAutomatico corta sin romper palabras", () => {
    const texto = Array(60).fill("contenido").join(" ");
    const resumen = resumenAutomatico(`<p>${texto}</p>`, 100);
    expect(resumen.length).toBeLessThanOrEqual(101);
    expect(resumen.endsWith("…")).toBe(true);
    expect(resumenAutomatico("<p>Corto</p>", 100)).toBe("Corto");
  });
});

describe("visibilidad pública y estado derivado", () => {
  const base = { estado: "publicada" as const, publicar_at: null, publicada_at: "2026-11-01T10:00:00Z", created_at: "2026-11-01T10:00:00Z" };

  it("visible si está publicada sin vencimiento", () => {
    expect(esVisiblePublica({ ...base, vence_at: null }, new Date("2026-11-10"))).toBe(true);
  });

  it("no visible: borrador, archivada o vencida", () => {
    expect(esVisiblePublica({ estado: "borrador", publicar_at: null, vence_at: null, publicada_at: null }, new Date())).toBe(false);
    expect(esVisiblePublica({ estado: "archivada", publicar_at: null, vence_at: null, publicada_at: null }, new Date())).toBe(false);
    expect(esVisiblePublica({ ...base, vence_at: "2026-11-05T00:00:00Z" }, new Date("2026-11-10"))).toBe(false);
  });

  it("estadoDerivado marca vencida a una publicada con vence_at pasado", () => {
    expect(estadoDerivado({ ...base, vence_at: "2026-11-05T00:00:00Z" }, new Date("2026-11-10"))).toBe("vencida");
    expect(estadoDerivado({ ...base, vence_at: "2027-01-01T00:00:00Z" }, new Date("2026-11-10"))).toBe("publicada");
    expect(estadoDerivado({ estado: "borrador", publicar_at: null, vence_at: null, publicada_at: null }, new Date())).toBe("borrador");
  });
});

describe("video de YouTube", () => {
  it("extrae el ID de todos los formatos", () => {
    expect(extraerYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extraerYoutubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extraerYoutubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extraerYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extraerYoutubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extraerYoutubeId("https://google.com")).toBe(null);
  });
});

describe("validaciones", () => {
  const valido = {
    titulo: "Comienza la Copa de Campeones",
    resumen: "Resumen válido de la noticia.",
    contenido: "<p>Contenido con más de veinte caracteres seguro.</p>",
  };

  it("acepta una noticia correcta", () => {
    expect(validarNoticia(valido)).toEqual({});
  });

  it("rechaza título corto y resumen largo", () => {
    expect(validarNoticia({ ...valido, titulo: "Hola" }).titulo).toBeTruthy();
    expect(validarNoticia({ ...valido, resumen: "x".repeat(300) }).resumen).toBeTruthy();
  });

  it("exige link válido para video youtube y archivo para mp4", () => {
    expect(validarNoticia({ ...valido, videoTipo: "youtube", videoUrl: "https://google.com" }).video).toBeTruthy();
    expect(validarNoticia({ ...valido, videoTipo: "youtube", videoUrl: "https://youtu.be/dQw4w9WgXcQ" }).video).toBeUndefined();
    expect(validarNoticia({ ...valido, videoTipo: "mp4" }).video).toBeTruthy();
    expect(validarNoticia({ ...valido, videoTipo: "mp4", videoPath: "n1/video.mp4" }).video).toBeUndefined();
  });

  it("programada exige fecha y vencimiento posterior", () => {
    expect(validarNoticia({ ...valido, estado: "programada" }).publicarAt).toBeTruthy();
    expect(
      validarNoticia({ ...valido, publicarAt: "2026-11-10T10:00", venceAt: "2026-11-09T10:00" }).venceAt
    ).toBeTruthy();
  });

  it("valida imágenes y videos por extensión y peso", () => {
    expect(validarImagen("foto.png", 1024)).toBe(null);
    expect(validarImagen("foto.gif", 1024)).toBeTruthy();
    expect(validarImagen("foto.jpg", 6 * 1024 * 1024)).toBeTruthy();
    expect(validarVideo("clip.mp4", 1024)).toBe(null);
    expect(validarVideo("clip.mov", 1024)).toBeTruthy();
    expect(validarVideo("clip.mp4", 101 * 1024 * 1024)).toBeTruthy();
  });

  it("valida colores de categoría", () => {
    expect(esColorValido("#F97316")).toBe(true);
    expect(esColorValido("naranja")).toBe(false);
    expect(esColorValido("#FFF")).toBe(false);
  });
});
