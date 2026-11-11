"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Unlink,
  Quote,
  Heading2,
  Heading3,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Highlighter,
  Palette,
  IndentIncrease,
  IndentDecrease,
  Minus,
} from "lucide-react";
import {
  TIPOGRAFIAS_DISPONIBLES,
  TAMANIOS_FUENTE_DISPONIBLES,
} from "@/lib/core/rules/mensajeriaRules";

/**
 * EDITOR DE TEXTO ENRIQUECIDO EMPRESARIAL LFS — estilo Word, sin dependencias externas.
 * contentEditable + comandos nativos del navegador (toolbar propia).
 * Incluye:
 *  - 10 familias tipográficas (Arial, Helvetica, Roboto, Open Sans, Lato,
 *    Montserrat, Poppins, Georgia, Times New Roman, Verdana).
 *  - Selector de tamaño de fuente (12px a 32px).
 *  - Formato: negrita, cursiva, subrayado, tachado, color de texto, resaltado,
 *    enlaces, citas, encabezados y limpiar formato.
 *  - Alineación: izquierda, centro, derecha, justificado.
 *  - Organización: listas con viñetas, numeradas, sangrías (+/-) y separador (<hr>).
 *
 * Produce HTML que SIEMPRE se vuelve a sanitizar en el servidor
 * (sanitizarHtml de mensajeriaRules) antes de guardarse.
 */

const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,400;0,700;1,400&family=Montserrat:ital,wght@0,400;0,600;0,700;1,400&family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&family=Poppins:ital,wght@0,400;0,600;0,700;1,400&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap";

interface EditorTextoEnriquecidoProps {
  valorInicial?: string;
  /** Incrementar cuando se carga una plantilla o borrador externo para sincronizar el DOM */
  versionContenido?: number;
  onChange: (html: string) => void;
  placeholder?: string;
  alturaMinima?: number;
}

function BotonBarra({
  titulo,
  onClick,
  activo = false,
  children,
}: {
  titulo: string;
  onClick: () => void;
  activo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onMouseDown={(e) => {
        e.preventDefault(); // no robar el foco/selección del editor
        onClick();
      }}
      className={`min-w-8 h-8 px-1.5 rounded-lg flex items-center justify-center transition shrink-0 ${
        activo
          ? "bg-[#F97316] text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-200/80 hover:text-[#1A2A44]"
      }`}
    >
      {children}
    </button>
  );
}

function Separador() {
  return <div className="w-px h-5 bg-slate-300/80 mx-1 shrink-0" />;
}

export function EditorTextoEnriquecido({
  valorInicial = "",
  versionContenido = 0,
  onChange,
  placeholder = "Escribí el mensaje…",
  alturaMinima = 240,
}: EditorTextoEnriquecidoProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [vacio, setVacio] = useState(!valorInicial);
  const [tipografiaActual, setTipografiaActual] = useState<string>(
    TIPOGRAFIAS_DISPONIBLES[0].cssFamily
  );
  const [tamanioActual, setTamanioActual] = useState<string>("14px");
  const inicializadoRef = useRef(false);
  const ultimaVersionRef = useRef(versionContenido);

  // Inyectar Google Fonts una sola vez para las 5 tipografías web (Roboto, Open Sans, Lato, Montserrat, Poppins)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const idLink = "lfs-editor-google-fonts";
    if (!document.getElementById(idLink)) {
      const link = document.createElement("link");
      link.id = idLink;
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_HREF;
      document.head.appendChild(link);
    }
  }, []);

  // Cargar el valor inicial o sincronizar cuando se aplica una plantilla/borrador
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    if (!inicializadoRef.current || ultimaVersionRef.current !== versionContenido) {
      el.innerHTML = valorInicial;
      setVacio(!el.textContent?.trim());
      inicializadoRef.current = true;
      ultimaVersionRef.current = versionContenido;
    }

    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      // Ignorar en entornos sin soporte de execCommand
    }
  }, [valorInicial, versionContenido]);

  function emitirCambio() {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setVacio(!el.textContent?.trim());
    onChange(html);
  }

  function comando(nombre: string, valor?: string) {
    editorRef.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand(nombre, false, valor);
    } catch {
      // fallback silencioso
    }
    emitirCambio();
  }

  function aplicarTipografia(cssFamily: string) {
    setTipografiaActual(cssFamily);
    editorRef.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontName", false, cssFamily);
    } catch {
      // fallback
    }
    emitirCambio();
  }

  function aplicarTamanioFuente(valorPx: string) {
    setTamanioActual(valorPx);
    const el = editorRef.current;
    if (!el) return;
    el.focus();

    try {
      document.execCommand("styleWithCSS", false, "true");
      document.execCommand("fontSize", false, "7");

      // Reemplazar el marcador temporal de tamaño 7 por el valor exacto en px
      const spans = el.querySelectorAll(
        'font[size="7"], span[style*="xxx-large"], span[style*="-webkit-xxx-large"]'
      );
      spans.forEach((nodo) => {
        if (nodo.tagName.toLowerCase() === "font") {
          const span = document.createElement("span");
          span.style.fontSize = valorPx;
          span.innerHTML = nodo.innerHTML;
          nodo.replaceWith(span);
        } else {
          (nodo as HTMLElement).style.fontSize = valorPx;
        }
      });
    } catch {
      // fallback
    }
    emitirCambio();
  }

  function insertarEnlace() {
    const url = window.prompt("Pegá la dirección del enlace (https://… o mailto:…)");
    if (!url) return;
    const limpia = url.trim();
    if (!/^https?:\/\//i.test(limpia) && !/^mailto:/i.test(limpia)) {
      window.alert("El enlace tiene que empezar con https:// o mailto:");
      return;
    }
    comando("createLink", limpia);
  }

  function aplicarColor(color: string) {
    comando("foreColor", color);
  }

  function aplicarResaltado(color: string) {
    comando("hiliteColor", color);
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#F97316]/50 focus-within:border-[#F97316] transition shadow-2xs">
      {/* Fila 1: Tipografía, Tamaño de fuente, Deshacer/Rehacer y Estilos de bloque */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 border-b border-slate-200 overflow-x-auto">
        <BotonBarra titulo="Deshacer (Ctrl+Z)" onClick={() => comando("undo")}>
          <Undo2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Rehacer (Ctrl+Y)" onClick={() => comando("redo")}>
          <Redo2 className="w-4 h-4" />
        </BotonBarra>

        <Separador />

        {/* Selector de 10 Familias Tipográficas */}
        <select
          aria-label="Familia tipográfica"
          title="Tipografía"
          value={tipografiaActual}
          onChange={(e) => aplicarTipografia(e.target.value)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 shrink-0 cursor-pointer"
        >
          {TIPOGRAFIAS_DISPONIBLES.map((f) => (
            <option key={f.id} value={f.cssFamily} style={{ fontFamily: f.cssFamily }}>
              {f.nombre}
            </option>
          ))}
        </select>

        {/* Selector de Tamaño de Fuente */}
        <select
          aria-label="Tamaño de fuente"
          title="Tamaño de letra"
          value={tamanioActual}
          onChange={(e) => aplicarTamanioFuente(e.target.value)}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 shrink-0 cursor-pointer"
        >
          {TAMANIOS_FUENTE_DISPONIBLES.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>

        <Separador />

        <BotonBarra titulo="Título principal (H2)" onClick={() => comando("formatBlock", "h2")}>
          <Heading2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Subtítulo (H3)" onClick={() => comando("formatBlock", "h3")}>
          <Heading3 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Párrafo normal" onClick={() => comando("formatBlock", "p")}>
          <Type className="w-4 h-4" />
        </BotonBarra>
      </div>

      {/* Fila 2: Formato de texto, Colores, Alineación, Listas, Sangrías, Enlaces y Separador */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-50/90 border-b border-slate-200 overflow-x-auto">
        <BotonBarra titulo="Negrita (Ctrl+B)" onClick={() => comando("bold")}>
          <Bold className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Cursiva (Ctrl+I)" onClick={() => comando("italic")}>
          <Italic className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Subrayado (Ctrl+U)" onClick={() => comando("underline")}>
          <Underline className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Tachado" onClick={() => comando("strikeThrough")}>
          <Strikethrough className="w-4 h-4" />
        </BotonBarra>

        <Separador />

        <label
          className="min-w-8 h-8 px-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200/80 hover:text-[#1A2A44] transition cursor-pointer shrink-0 relative"
          title="Color de letra"
        >
          <Palette className="w-4 h-4 pointer-events-none" />
          <input
            type="color"
            defaultValue="#1A2A44"
            onChange={(e) => aplicarColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Color de letra"
          />
        </label>
        <label
          className="min-w-8 h-8 px-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200/80 hover:text-[#1A2A44] transition cursor-pointer shrink-0 relative"
          title="Color de fondo del texto (Resaltado)"
        >
          <Highlighter className="w-4 h-4 pointer-events-none" />
          <input
            type="color"
            defaultValue="#fef08a"
            onChange={(e) => aplicarResaltado(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Color de fondo del texto"
          />
        </label>

        <Separador />

        <BotonBarra titulo="Alinear a la izquierda" onClick={() => comando("justifyLeft")}>
          <AlignLeft className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Centrar" onClick={() => comando("justifyCenter")}>
          <AlignCenter className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Alinear a la derecha" onClick={() => comando("justifyRight")}>
          <AlignRight className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Justificar" onClick={() => comando("justifyFull")}>
          <AlignJustify className="w-4 h-4" />
        </BotonBarra>

        <Separador />

        <BotonBarra titulo="Lista con viñetas" onClick={() => comando("insertUnorderedList")}>
          <List className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Lista numerada" onClick={() => comando("insertOrderedList")}>
          <ListOrdered className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Aumentar sangría" onClick={() => comando("indent")}>
          <IndentIncrease className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Disminuir sangría" onClick={() => comando("outdent")}>
          <IndentDecrease className="w-4 h-4" />
        </BotonBarra>

        <Separador />

        <BotonBarra titulo="Insertar enlace" onClick={insertarEnlace}>
          <Link2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Quitar enlace" onClick={() => comando("unlink")}>
          <Unlink className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Cita destacada" onClick={() => comando("formatBlock", "blockquote")}>
          <Quote className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra
          titulo="Insertar línea separadora"
          onClick={() => comando("insertHorizontalRule")}
        >
          <Minus className="w-4 h-4" />
        </BotonBarra>

        <Separador />

        <BotonBarra titulo="Limpiar formato" onClick={() => comando("removeFormat")}>
          <Eraser className="w-4 h-4" />
        </BotonBarra>
      </div>

      {/* Área de escritura */}
      <div className="relative">
        {vacio && (
          <span className="absolute top-3.5 left-4 text-sm text-slate-400 pointer-events-none select-none">
            {placeholder}
          </span>
        )}
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Cuerpo del mensaje"
          onInput={emitirCambio}
          onBlur={emitirCambio}
          className="prose-lfs px-4 py-3.5 text-sm text-[#1A2A44] outline-none overflow-y-auto"
          style={{ minHeight: alturaMinima, maxHeight: 460 }}
        />
      </div>
    </div>
  );
}
