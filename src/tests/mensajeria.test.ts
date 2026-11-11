import { describe, expect, it } from "vitest";
import {
  sanitizarHtml,
  textoPlanoDeHtml,
  leerMetadata,
  esComunicado,
  bloqueaRespuestas,
  puedeEscribir,
  validarAsunto,
  validarCuerpoHtml,
  validarArchivoAdjunto,
  formatearTamanioArchivo,
  validarFechaProgramada,
  TIPOGRAFIAS_DISPONIBLES,
  TAMANIOS_FUENTE_DISPONIBLES,
  CATEGORIAS_MENSAJE,
  PRIORIDADES_MENSAJE,
  MAX_BYTES_ADJUNTO,
  TIPO_COMUNICADO,
} from "../lib/core/rules/mensajeriaRules";

/**
 * MENSAJERÍA PREMIUM — Reglas de negocio y sanitizer HTML
 * Cubre seguridad (XSS), 10 tipografías, tamaños de letra, sangrías,
 * metadata de comunicados, adjuntos hasta 10 MB y programación de envíos.
 */

describe("sanitizarHtml — seguridad XSS", () => {
  it("elimina <script> con todo su contenido", () => {
    const sucio = '<p>Hola</p><script>alert("hack")</script><p>Chau</p>';
    const limpio = sanitizarHtml(sucio);
    expect(limpio).not.toContain("script");
    expect(limpio).not.toContain("alert");
    expect(limpio).toContain("<p>Hola</p>");
    expect(limpio).toContain("<p>Chau</p>");
  });

  it("elimina atributos on* (onclick, onerror, onload)", () => {
    const sucio = '<p onclick="robar()">Texto</p><span onmouseover="x()">Y</span>';
    const limpio = sanitizarHtml(sucio);
    expect(limpio).not.toContain("onclick");
    expect(limpio).not.toContain("onmouseover");
    expect(limpio).toContain("Texto");
  });

  it("bloquea href con javascript: y conserva el texto", () => {
    const sucio = '<a href="javascript:alert(1)">Click acá</a>';
    const limpio = sanitizarHtml(sucio);
    expect(limpio).not.toContain("javascript:");
    expect(limpio).not.toContain("<a");
    expect(limpio).toContain("Click acá");
  });

  it("bloquea href con espacios camuflados (java\\tscript:)", () => {
    const sucio = '<a href="java\tscript:alert(1)">Link</a>';
    expect(sanitizarHtml(sucio)).not.toContain("<a");
  });

  it("elimina iframe, object y form con contenido", () => {
    const sucio = '<iframe src="http://mal.com"></iframe><form><input></form><b>OK</b>';
    const limpio = sanitizarHtml(sucio);
    expect(limpio).not.toContain("iframe");
    expect(limpio).not.toContain("form");
    expect(limpio).toContain("<b>OK</b>");
  });

  it("elimina estilos peligrosos (url, expression, javascript)", () => {
    const sucio =
      '<span style="color: red; background-image: url(http://x); width: expression(alert(1))">T</span>';
    const limpio = sanitizarHtml(sucio);
    expect(limpio).toContain("color: red");
    expect(limpio).not.toContain("url(");
    expect(limpio).not.toContain("expression");
  });

  it("escapa texto suelto con < y >", () => {
    const limpio = sanitizarHtml("2 < 3 y 5 > 4");
    expect(limpio).toContain("2 &lt; 3");
    expect(limpio).toContain("5 &gt; 4");
  });
});

describe("sanitizarHtml — conserva formato legítimo y las 10 tipografías", () => {
  it("conserva negrita, itálica, subrayado y tachado", () => {
    const html = "<b>N</b><strong>N2</strong><i>I</i><em>I2</em><u>U</u><s>S</s>";
    expect(sanitizarHtml(html)).toBe(html);
  });

  it("conserva listas, títulos, citas y alineación", () => {
    const html =
      '<h2 style="text-align: center">Título</h2><ul><li>A</li><li>B</li></ul><blockquote>Cita</blockquote>';
    expect(sanitizarHtml(html)).toBe(html);
  });

  it("conserva colores de texto y resaltado", () => {
    const html = '<span style="color: #F97316; background-color: yellow">Aviso</span>';
    expect(sanitizarHtml(html)).toBe(html);
  });

  it("dispone de las 10 familias tipográficas requeridas y conserva font-family, font-size y sangría", () => {
    expect(TIPOGRAFIAS_DISPONIBLES.length).toBe(10);
    const nombres = TIPOGRAFIAS_DISPONIBLES.map((t) => t.nombre);
    expect(nombres).toEqual([
      "Arial",
      "Helvetica",
      "Roboto",
      "Open Sans",
      "Lato",
      "Montserrat",
      "Poppins",
      "Georgia",
      "Times New Roman",
      "Verdana",
    ]);

    for (const font of TIPOGRAFIAS_DISPONIBLES) {
      const html = `<span style="font-family: ${font.cssFamily}; font-size: 18px">Texto</span>`;
      const limpio = sanitizarHtml(html);
      expect(limpio).toContain("font-family:");
      expect(limpio).toContain("font-size: 18px");
    }

    const conSangria = '<p style="margin-left: 40px; padding-left: 20px">Indented</p><hr>';
    const limpioSangria = sanitizarHtml(conSangria);
    expect(limpioSangria).toContain("margin-left: 40px");
    expect(limpioSangria).toContain("padding-left: 20px");
    expect(limpioSangria).toContain("<hr>");
  });

  it("conserva enlaces https y fuerza target/rel seguros", () => {
    const limpio = sanitizarHtml('<a href="https://liga.com.ar/aviso">Web</a>');
    expect(limpio).toContain('href="https://liga.com.ar/aviso"');
    expect(limpio).toContain('target="_blank"');
    expect(limpio).toContain("noopener");
  });

  it("quita etiquetas desconocidas pero conserva su texto", () => {
    const limpio = sanitizarHtml("<marquee>Importante</marquee>");
    expect(limpio).toBe("Importante");
  });
});

describe("textoPlanoDeHtml", () => {
  it("extrae texto plano para previews", () => {
    expect(textoPlanoDeHtml("<p>Hola <b>club</b></p>")).toBe("Hola club");
  });

  it("decodifica entidades comunes", () => {
    expect(textoPlanoDeHtml("Pepe &amp; Cia &lt;ok&gt;")).toBe("Pepe & Cia <ok>");
  });

  it("recorta con puntos suspensivos", () => {
    const largo = "a".repeat(200);
    const plano = textoPlanoDeHtml(largo, 50);
    expect(plano.length).toBeLessThanOrEqual(50);
    expect(plano.endsWith("…")).toBe(true);
  });
});

describe("metadata de mensajes — comunicados, prioridad y adjuntos", () => {
  const comunicado = {
    tipo: TIPO_COMUNICADO,
    asunto: "Fecha 12 suspendida",
    sin_respuestas: true,
    html: true,
    anuncio_id: "abc-123",
    prioridad: "urgente",
    categoria: "Torneo y Fixture",
    adjuntos: [
      { path: "federacion/1.pdf", name: "boletin.pdf", type: "application/pdf", size: 2048 },
    ],
  };

  it("leerMetadata tolera valores inválidos", () => {
    expect(leerMetadata(null)).toEqual({});
    expect(leerMetadata("texto")).toEqual({});
    expect(leerMetadata([1, 2])).toEqual({});
  });

  it("detecta comunicados, bloqueo de respuestas, prioridad, categoría y adjuntos", () => {
    expect(esComunicado(comunicado)).toBe(true);
    expect(bloqueaRespuestas(comunicado)).toBe(true);
    const meta = leerMetadata(comunicado);
    expect(meta.prioridad).toBe("urgente");
    expect(meta.categoria).toBe("Torneo y Fixture");
    expect(meta.adjuntos?.length).toBe(1);
    expect(meta.adjuntos?.[0].name).toBe("boletin.pdf");
    expect(esComunicado({ tipo: "chat" })).toBe(false);
    expect(bloqueaRespuestas({ tipo: "chat" })).toBe(false);
  });

  it("un comunicado CON respuestas no bloquea", () => {
    expect(bloqueaRespuestas({ tipo: TIPO_COMUNICADO, sin_respuestas: false })).toBe(false);
  });

  it("puedeEscribir: el club queda bloqueado, el admin nunca", () => {
    expect(puedeEscribir({ esAdmin: false, ultimoMensajeMetadata: comunicado })).toBe(false);
    expect(puedeEscribir({ esAdmin: true, ultimoMensajeMetadata: comunicado })).toBe(true);
    expect(puedeEscribir({ esAdmin: false, ultimoMensajeMetadata: null })).toBe(true);
  });
});

describe("validaciones del compositor, adjuntos (10 MB) y programación", () => {
  it("asunto: mínimo 3, máximo 120 caracteres", () => {
    expect(validarAsunto("ab").ok).toBe(false);
    expect(validarAsunto("   ").ok).toBe(false);
    expect(validarAsunto("Fecha 12").ok).toBe(true);
    expect(validarAsunto("x".repeat(121)).ok).toBe(false);
  });

  it("cuerpo: rechaza vacío (aunque tenga solo etiquetas)", () => {
    expect(validarCuerpoHtml("<p><br></p>").ok).toBe(false);
    expect(validarCuerpoHtml("<p>Hola club</p>").ok).toBe(true);
  });

  it("archivos adjuntos: valida formatos permitidos (JPG, JPEG, PNG, WEBP, PDF) y límite de 10 MB", () => {
    expect(
      validarArchivoAdjunto({ name: "foto.jpg", type: "image/jpeg", size: 500_000 }).ok
    ).toBe(true);
    expect(
      validarArchivoAdjunto({ name: "foto.png", type: "image/png", size: MAX_BYTES_ADJUNTO }).ok
    ).toBe(true);
    expect(
      validarArchivoAdjunto({ name: "foto.webp", type: "image/webp", size: 1024 }).ok
    ).toBe(true);
    expect(
      validarArchivoAdjunto({
        name: "pesado.jpg",
        type: "image/jpeg",
        size: MAX_BYTES_ADJUNTO + 1,
      }).ok
    ).toBe(false);
    expect(
      validarArchivoAdjunto({ name: "script.exe", type: "application/x-msdownload", size: 1024 }).ok
    ).toBe(false);
    expect(formatearTamanioArchivo(1024 * 1024 * 2.5)).toBe("2.50 MB");
  });

  it("programación de envíos: exige fecha y hora futuras", () => {
    const base = new Date("2026-11-10T12:00:00Z");
    expect(validarFechaProgramada("2026-11-10T11:00:00Z", base).ok).toBe(false);
    expect(validarFechaProgramada("2026-11-11T15:00:00Z", base).ok).toBe(true);
    expect(TAMANIOS_FUENTE_DISPONIBLES.length).toBeGreaterThanOrEqual(8);
    expect(CATEGORIAS_MENSAJE.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(PRIORIDADES_MENSAJE)).toEqual(["normal", "importante", "urgente"]);
  });
});
