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
} from "lucide-react";

/**
 * EDITOR DE TEXTO ENRIQUECIDO — estilo Word, sin dependencias externas.
 * contentEditable + comandos nativos del navegador (toolbar propia).
 * Produce HTML que SIEMPRE se vuelve a sanitizar en el servidor
 * (sanitizarHtml de mensajeriaRules) antes de guardarse.
 *
 * Mobile: la barra de herramientas se desliza horizontal y los botones
 * tienen área táctil cómoda (iOS/Android).
 */

interface EditorTextoEnriquecidoProps {
  valorInicial?: string;
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
      className={`min-w-9 h-9 px-1.5 rounded-lg flex items-center justify-center transition shrink-0 ${
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
  return <div className="w-px h-6 bg-slate-300/70 mx-1 shrink-0" />;
}

export function EditorTextoEnriquecido({
  valorInicial = "",
  onChange,
  placeholder = "Escribí el mensaje…",
  alturaMinima = 220,
}: EditorTextoEnriquecidoProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [vacio, setVacio] = useState(!valorInicial);
  const inicializadoRef = useRef(false);

  // Cargar el valor inicial una sola vez (no controlado: evita saltos de cursor)
  useEffect(() => {
    if (editorRef.current && !inicializadoRef.current) {
      editorRef.current.innerHTML = valorInicial;
      inicializadoRef.current = true;
    }
    // Activar estilos CSS en los comandos (span con style en vez de <font>)
    document.execCommand("styleWithCSS", false, "true");
  }, [valorInicial]);

  function emitirCambio() {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    setVacio(!el.textContent?.trim());
    onChange(html);
  }

  function comando(nombre: string, valor?: string) {
    editorRef.current?.focus();
    document.execCommand(nombre, false, valor);
    emitirCambio();
  }

  function insertarEnlace() {
    const url = window.prompt("Pegá la dirección del enlace (https://…)");
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
    <div className="rounded-xl border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#F97316]/50 focus-within:border-[#F97316] transition">
      {/* Barra de herramientas (deslizable en móvil) */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-slate-100/90 border-b border-slate-200 overflow-x-auto">
        <BotonBarra titulo="Deshacer" onClick={() => comando("undo")}>
          <Undo2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Rehacer" onClick={() => comando("redo")}>
          <Redo2 className="w-4 h-4" />
        </BotonBarra>
        <Separador />
        <BotonBarra titulo="Negrita" onClick={() => comando("bold")}>
          <Bold className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Itálica" onClick={() => comando("italic")}>
          <Italic className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Subrayado" onClick={() => comando("underline")}>
          <Underline className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Tachado" onClick={() => comando("strikeThrough")}>
          <Strikethrough className="w-4 h-4" />
        </BotonBarra>
        <Separador />
        <label
          className="min-w-9 h-9 px-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200/80 hover:text-[#1A2A44] transition cursor-pointer shrink-0 relative"
          title="Color de texto"
        >
          <Palette className="w-4 h-4 pointer-events-none" />
          <input
            type="color"
            defaultValue="#1A2A44"
            onChange={(e) => aplicarColor(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Color de texto"
          />
        </label>
        <label
          className="min-w-9 h-9 px-1.5 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-200/80 hover:text-[#1A2A44] transition cursor-pointer shrink-0 relative"
          title="Resaltado"
        >
          <Highlighter className="w-4 h-4 pointer-events-none" />
          <input
            type="color"
            defaultValue="#fef08a"
            onChange={(e) => aplicarResaltado(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Color de resaltado"
          />
        </label>
        <Separador />
        <BotonBarra titulo="Título grande" onClick={() => comando("formatBlock", "h2")}>
          <Heading2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Título chico" onClick={() => comando("formatBlock", "h3")}>
          <Heading3 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Texto normal" onClick={() => comando("formatBlock", "p")}>
          <Type className="w-4 h-4" />
        </BotonBarra>
        <Separador />
        <BotonBarra titulo="Lista con viñetas" onClick={() => comando("insertUnorderedList")}>
          <List className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Lista numerada" onClick={() => comando("insertOrderedList")}>
          <ListOrdered className="w-4 h-4" />
        </BotonBarra>
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
        <BotonBarra titulo="Insertar enlace" onClick={insertarEnlace}>
          <Link2 className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Quitar enlace" onClick={() => comando("unlink")}>
          <Unlink className="w-4 h-4" />
        </BotonBarra>
        <BotonBarra titulo="Cita" onClick={() => comando("formatBlock", "blockquote")}>
          <Quote className="w-4 h-4" />
        </BotonBarra>
        <Separador />
        <BotonBarra titulo="Limpiar formato" onClick={() => comando("removeFormat")}>
          <Eraser className="w-4 h-4" />
        </BotonBarra>
      </div>

      {/* Área de escritura */}
      <div className="relative">
        {vacio && (
          <span className="absolute top-3 left-4 text-sm text-slate-400 pointer-events-none select-none">
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
          className="prose-lfs px-4 py-3 text-sm text-[#1A2A44] outline-none overflow-y-auto"
          style={{ minHeight: alturaMinima, maxHeight: 420 }}
        />
      </div>
    </div>
  );
}
