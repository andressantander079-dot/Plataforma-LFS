"use client";

import { useState, useEffect, useRef } from "react";
import { X, Layers, AlertCircle, Loader2 } from "lucide-react";
import type { CategoryItem } from "@/lib/core/rules/configuracionRules";

interface ModalCategoriaProps {
  isOpen: boolean;
  categoriaAEditar: CategoryItem | null;
  onGuardar: (datos: {
    name: string;
    level_hierarchy: number;
    gender: "masculino" | "femenino" | "mixto";
    anio_desde: number | null;
    anio_hasta: number | null;
    is_active: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  onCerrar: () => void;
}

export function ModalCategoria({
  isOpen,
  categoriaAEditar,
  onGuardar,
  onCerrar,
}: ModalCategoriaProps) {
  const currentYear = new Date().getFullYear();

  const [name, setName] = useState("");
  const [levelHierarchy, setLevelHierarchy] = useState<number>(1);
  const [gender, setGender] = useState<"masculino" | "femenino" | "mixto">("masculino");
  const [anioDesde, setAnioDesde] = useState<string>("");
  const [anioHasta, setAnioHasta] = useState<string>("");
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (categoriaAEditar) {
      setName(categoriaAEditar.name);
      setLevelHierarchy(categoriaAEditar.level_hierarchy || 1);
      setGender(categoriaAEditar.gender || "masculino");
      setAnioDesde(categoriaAEditar.anio_desde ? String(categoriaAEditar.anio_desde) : "");
      setAnioHasta(categoriaAEditar.anio_hasta ? String(categoriaAEditar.anio_hasta) : "");
      setIsActive(categoriaAEditar.is_active ?? true);
    } else {
      setName("");
      setLevelHierarchy(1);
      setGender("masculino");
      setAnioDesde("");
      setAnioHasta("");
      setIsActive(true);
    }
    setErrorMsg(null);
  }, [categoriaAEditar, isOpen]);

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
      setErrorMsg("El nombre de la categoría es obligatorio.");
      return;
    }

    const numDesde = anioDesde.trim() ? parseInt(anioDesde.trim(), 10) : null;
    const numHasta = anioHasta.trim() ? parseInt(anioHasta.trim(), 10) : null;

    if (numDesde !== null && numHasta !== null && numDesde > numHasta) {
      setErrorMsg("El año de inicio (desde) debe ser menor o igual al año límite (hasta).");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onGuardar({
        name: name.trim(),
        level_hierarchy: Number(levelHierarchy),
        gender,
        anio_desde: numDesde,
        anio_hasta: numHasta,
        is_active: isActive,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Ocurrió un error al guardar la categoría.");
      } else {
        onCerrar();
      }
    } catch {
      setErrorMsg("Error de conexión al guardar.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-categoria-title"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 flex flex-col gap-4 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 id="modal-categoria-title" className="font-serif text-lg font-bold text-[#1A2A44]">
                {categoriaAEditar ? "Editar Categoría" : "Nueva Categoría"}
              </h3>
              <p className="text-xs text-slate-500">
                {categoriaAEditar
                  ? "Modificá jerarquía, género o rangos de edad."
                  : "Definí una nueva categoría para la liga de fútsal."}
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

        {/* Alerta de Error */}
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre de la Categoría</label>
            <input
              ref={firstInputRef}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Primera División, Sub-16, Senior +35"
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Jerarquía Numérica
                <span className="text-[10px] text-slate-400 font-normal block">
                  (1: Menor, 4: Primera)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={50}
                required
                value={levelHierarchy}
                onChange={(e) => setLevelHierarchy(parseInt(e.target.value, 10) || 1)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Género / Rama
                <span className="text-[10px] text-slate-400 font-normal block">Competencia</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as "masculino" | "femenino" | "mixto")}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50 focus:bg-white transition"
              >
                <option value="masculino">Masculino</option>
                <option value="femenino">Femenino</option>
                <option value="mixto">Mixto</option>
              </select>
            </div>
          </div>

          {/* Rango de Años para Validación de Edad */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-800">
                Rango de Año de Nacimiento
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Opcional para Primera</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-1">Año Desde (Mayor edad)</span>
                <input
                  type="number"
                  min={1950}
                  max={currentYear}
                  placeholder="Ej: 2008"
                  value={anioDesde}
                  onChange={(e) => setAnioDesde(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-1">Año Hasta (Menor edad)</span>
                <input
                  type="number"
                  min={1950}
                  max={currentYear}
                  placeholder="Ej: 2009"
                  value={anioHasta}
                  onChange={(e) => setAnioHasta(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Se utiliza en el módulo de planteles e inscripciones para validar automáticamente la categoría base según DNI/fecha de nacimiento.
            </p>
          </div>

          {/* Estado de Habilitación */}
          <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
            />
            <div>
              <span className="text-xs font-bold text-slate-800 block">Categoría Habilitada</span>
              <span className="text-[10px] text-slate-400 block">
                Si se desactiva, queda bloqueada para nuevos torneos e inscripciones, pero conserva todo el histórico.
              </span>
            </div>
          </label>

          {/* Botones de Acción */}
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
                categoriaAEditar ? "Guardar Cambios" : "Crear Categoría"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
