"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight, Images } from "lucide-react";
import type { ItemGaleria } from "@/lib/actions/noticias.actions";

/** Galería de fotos con visor a pantalla completa (táctil y teclado). */
export function GaleriaNoticia({ fotos, titulo }: { fotos: ItemGaleria[]; titulo: string }) {
  const [abierta, setAbierta] = useState<number | null>(null);

  useEffect(() => {
    if (abierta === null) return;
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierta(null);
      if (e.key === "ArrowRight") setAbierta((a) => (a === null ? a : (a + 1) % fotos.length));
      if (e.key === "ArrowLeft") setAbierta((a) => (a === null ? a : (a - 1 + fotos.length) % fotos.length));
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierta, fotos.length]);

  if (fotos.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-2">
        <Images className="w-4 h-4" /> Galería ({fotos.length})
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {fotos.map((foto, i) => (
          <button
            key={foto.path}
            type="button"
            id={`btn-foto-galeria-${i}`}
            onClick={() => setAbierta(i)}
            className="relative h-28 sm:h-36 rounded-xl overflow-hidden bg-slate-100 group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto.url}
              alt={`${titulo} — foto ${i + 1}`}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          </button>
        ))}
      </div>

      {/* Visor a pantalla completa */}
      {abierta !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setAbierta(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Visor de fotos"
        >
          <button
            type="button"
            id="btn-cerrar-visor"
            onClick={() => setAbierta(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 rounded-full transition"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          {fotos.length > 1 && (
            <>
              <button
                type="button"
                id="btn-visor-anterior"
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierta((abierta - 1 + fotos.length) % fotos.length);
                }}
                className="absolute left-3 p-2.5 text-white/80 hover:text-white bg-white/10 rounded-full transition"
                title="Anterior"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                id="btn-visor-siguiente"
                onClick={(e) => {
                  e.stopPropagation();
                  setAbierta((abierta + 1) % fotos.length);
                }}
                className="absolute right-3 p-2.5 text-white/80 hover:text-white bg-white/10 rounded-full transition"
                title="Siguiente"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotos[abierta].url}
            alt={`${titulo} — foto ${abierta + 1}`}
            className="max-h-[85vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <span className="absolute bottom-4 text-white/70 text-xs font-bold">
            {abierta + 1} / {fotos.length}
          </span>
        </div>
      )}
    </section>
  );
}
