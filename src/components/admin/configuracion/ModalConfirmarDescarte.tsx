"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface ModalConfirmarDescarteProps {
  isOpen: boolean;
  seccionesConCambios: string[];
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function ModalConfirmarDescarte({
  isOpen,
  seccionesConCambios,
  onConfirmar,
  onCancelar,
}: ModalConfirmarDescarteProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancelar]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-descarte-title"
      aria-describedby="modal-descarte-desc"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 animate-scale-up"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-descarte-title" className="font-serif text-lg font-bold text-[#1A2A44]">
                Cambios sin guardar
              </h3>
              <p id="modal-descarte-desc" className="text-xs text-slate-500 mt-0.5">
                Tenés modificaciones pendientes en la configuración.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold mb-1">Secciones con cambios no guardados:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800 font-medium">
            {seccionesConCambios.map((sec) => (
              <li key={sec}>{sec}</li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-700">
            Si cambiás de pestaña o salís ahora, las modificaciones realizadas en esta sección se perderán.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-300 transition"
          >
            Permanecer y Guardar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition"
          >
            Descartar y Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
