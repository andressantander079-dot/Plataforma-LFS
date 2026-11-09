"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, Check } from "lucide-react";

/**
 * FIRMA DIGITAL EN CANVAS — Paso 17C
 * Dibujar con el dedo (táctil) o el mouse. Devuelve la firma como
 * dataURL PNG lista para subir al bucket privado.
 */
export function FirmaCanvas({
  onConfirmar,
  onCancelar,
  etiqueta,
  confirmando = false,
}: {
  onConfirmar: (dataUrl: string) => void;
  onCancelar: () => void;
  etiqueta: string;
  confirmando?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujandoRef = useRef(false);
  const [vacio, setVacio] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fondo blanco (la firma se imprime sobre hoja)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1A2A44";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const posicion = useCallback((e: React.PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  const empezar = (e: React.PointerEvent) => {
    const pos = posicion(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!pos || !ctx) return;
    dibujandoRef.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const mover = (e: React.PointerEvent) => {
    if (!dibujandoRef.current) return;
    const pos = posicion(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!pos || !ctx) return;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setVacio(false);
  };

  const terminar = () => {
    dibujandoRef.current = false;
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setVacio(true);
  };

  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas || vacio) return;
    onConfirmar(canvas.toDataURL("image/png"));
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-center">
        {etiqueta}
      </p>
      <div className="rounded-2xl border-2 border-dashed border-slate-300 overflow-hidden bg-white shadow-inner touch-none">
        <canvas
          ref={canvasRef}
          width={560}
          height={200}
          className="w-full h-40 cursor-crosshair"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={limpiar}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs py-2.5 hover:bg-slate-50 transition-colors"
        >
          <Eraser className="w-3.5 h-3.5" /> Limpiar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="flex-1 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs py-2.5 hover:bg-slate-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={vacio || confirmando}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1A2A44] text-white font-bold text-xs py-2.5 hover:bg-[#24355a] disabled:bg-slate-300 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Confirmar firma
        </button>
      </div>
    </div>
  );
}
