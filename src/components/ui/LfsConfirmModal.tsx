"use client";

import { useState } from "react";

interface LfsConfirmModalProps {
  title: string;
  description?: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmText?: string;
}

/**
 * Modal de confirmación destructiva oficial de la LFS.
 * Requiere marcar explícitamente el checkbox de aceptación antes de habilitar la acción.
 */
export function LfsConfirmModal({
  title,
  description,
  onConfirm,
  onClose,
  confirmText = "Confirmar",
}: LfsConfirmModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div 
      className="fixed inset-0 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      id="lfs-confirm-modal-overlay"
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4"
        id="lfs-confirm-modal-card"
      >
        <div className="flex flex-col gap-2">
          <h3 className="font-sans font-black text-xl text-[#1A2A44]">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {/* Checkbox destructivo obligatorio de LFS */}
        <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer select-none py-2 border-y border-slate-100 my-1">
          <input
            type="checkbox"
            id="lfs-confirm-modal-checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="w-4 h-4 accent-[#F97316] rounded border-slate-350 cursor-pointer focus:ring-[#F97316]"
          />
          <span className="font-sans text-slate-700">
            Entiendo que esta acción no se puede deshacer
          </span>
        </label>

        <div className="flex gap-3 justify-end pt-2">
          <button
            type="button"
            id="lfs-confirm-modal-cancel"
            onClick={onClose}
            className="px-4 py-2 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="lfs-confirm-modal-submit"
            disabled={!isChecked}
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white disabled:opacity-50 disabled:cursor-not-allowed transition font-sans shadow-lg shadow-[#F97316]/10"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
