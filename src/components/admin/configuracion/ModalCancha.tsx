"use client";

import { useState, useEffect, useRef } from "react";
import { X, MapPin, AlertCircle, Loader2 } from "lucide-react";
import type { VenueItem } from "@/lib/core/rules/configuracionRules";

interface ModalCanchaProps {
  isOpen: boolean;
  canchaAEditar: VenueItem | null;
  onGuardar: (datos: {
    name: string;
    address: string | null;
    capacity: number;
    surface: "parquet" | "sintetico" | "cemento" | "baldosa";
    is_active: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  onCerrar: () => void;
}

export function ModalCancha({
  isOpen,
  canchaAEditar,
  onGuardar,
  onCerrar,
}: ModalCanchaProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [capacity, setCapacity] = useState<number>(500);
  const [surface, setSurface] = useState<"parquet" | "sintetico" | "cemento" | "baldosa">("parquet");
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (canchaAEditar) {
      setName(canchaAEditar.name);
      setAddress(canchaAEditar.address || "");
      setCapacity(canchaAEditar.capacity || 500);
      setSurface(canchaAEditar.surface || "parquet");
      setIsActive(canchaAEditar.is_active ?? true);
    } else {
      setName("");
      setAddress("");
      setCapacity(500);
      setSurface("parquet");
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [canchaAEditar, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("El nombre del escenario deportivo es obligatorio.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onGuardar({
        name: name.trim(),
        address: address.trim() || null,
        capacity: Number(capacity) || 500,
        surface,
        is_active: isActive,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Ocurrió un error al guardar la cancha.");
      } else {
        onCerrar();
      }
    } catch {
      setErrorMsg("Error de conexión al guardar el escenario.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cancha-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-scale-up">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-cancha-title" className="font-serif text-lg font-bold text-[#1A2A44]">
                {canchaAEditar ? "Editar Cancha / Gimnasio" : "Nuevo Escenario Deportivo"}
              </h3>
              <p className="text-xs text-slate-500">
                {canchaAEditar
                  ? "Actualizá dirección, superficie o aforo."
                  : "Registrá una nueva sede de juego en Ushuaia."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre del Escenario</label>
            <input
              ref={firstInputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Gimnasio Hugo Ítalo Favale, Polideportivo Augusto Lasserre"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Dirección / Ubicación Física</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ej: Gdor. Paz y Laserre, Ushuaia"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Tipo de Superficie</label>
              <select
                value={surface}
                onChange={(e) => setSurface(e.target.value as "parquet" | "sintetico" | "cemento" | "baldosa")}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
              >
                <option value="parquet">Parquet Flotante</option>
                <option value="sintetico">Piso Sintético / Vinílico</option>
                <option value="cemento">Cemento Pulido</option>
                <option value="baldosa">Mosaico / Baldosa</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Aforo / Capacidad (Espectadores)</label>
              <input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
            />
            <div>
              <span className="text-xs font-bold text-slate-800 block">Escenario Habilitado</span>
              <span className="text-[10px] text-slate-400 block">Disponible para la designación y programación de encuentros.</span>
            </div>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onCerrar}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Guardando...
                </>
              ) : (
                canchaAEditar ? "Guardar Cambios" : "Agregar Escenario"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
