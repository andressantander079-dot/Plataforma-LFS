"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";

const ANCHO = 560;
const ALTO = 180;

/**
 * Canvas para dibujar la firma con el dedo o el mouse.
 * Llama a onCambio con el dataURL PNG de la firma (o null si se limpia).
 */
export function FirmaCanvas({
  onCambio,
  etiqueta = "Firmá acá adentro",
}: {
  onCambio: (dataUrl: string | null) => void;
  etiqueta?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujandoRef = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1A2A44";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * ANCHO,
      y: ((e.clientY - rect.top) / rect.height) * ALTO,
    };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    dibujandoRef.current = true;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujandoRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!tieneTrazo) setTieneTrazo(true);
  }

  function terminar() {
    if (!dibujandoRef.current) return;
    dibujandoRef.current = false;
    const canvas = canvasRef.current;
    if (canvas && tieneTrazo) onCambio(canvas.toDataURL("image/png"));
  }

  function limpiar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, ANCHO, ALTO);
    setTieneTrazo(false);
    onCambio(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`relative rounded-xl border-2 bg-white overflow-hidden transition ${
          tieneTrazo ? "border-green-300" : "border-dashed border-slate-300"
        }`}
      >
        <canvas
          ref={canvasRef}
          width={ANCHO}
          height={ALTO}
          className="w-full touch-none cursor-crosshair"
          style={{ aspectRatio: `${ANCHO}/${ALTO}` }}
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
        {!tieneTrazo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
              <PenLine className="w-4 h-4" /> {etiqueta}
            </p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400">
          {tieneTrazo ? "✅ Firma lista" : "Dibujá tu firma con el dedo o el mouse"}
        </p>
        {tieneTrazo && (
          <button
            type="button"
            onClick={limpiar}
            className="text-[10px] font-bold text-slate-500 hover:text-red-600 transition flex items-center gap-1"
          >
            <Eraser className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
