"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Save, AlertTriangle, LoaderCircle, Info } from "lucide-react";
import { validateCategoryEligibility } from "@/lib/core/rules/categoryRules";
import { inscribirJugador } from "@/lib/actions/equipos.actions";

/**
 * PANEL LATERAL DE INSCRIPCIÓN DE JUGADOR
 * Se desliza desde la derecha SOBRE la pantalla del plantel,
 * sin cambiar de página ni perder el contexto.
 * Al guardar con éxito se cierra solo y la tabla se actualiza.
 */

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

interface Props {
  clubId: string;
  clubName: string;
  categories: Category[];
  abierto: boolean;
  onCerrar: () => void;
}

export function PanelInscribirJugador({
  clubId,
  clubName,
  categories,
  abierto,
  onCerrar,
}: Props) {
  const router = useRouter();

  const [baseLevel, setBaseLevel] = useState<number>(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Cerrar con la tecla Escape
  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  // Al abrir el panel, arrancar con la primera categoría como base
  useEffect(() => {
    if (abierto && categories.length > 0) {
      setBaseLevel(categories[0].level_hierarchy);
    }
  }, [abierto, categories]);

  function handleCategoryChange(cat: Category, checked: boolean) {
    setValidationError(null);
    if (checked) {
      try {
        validateCategoryEligibility(baseLevel, cat.level_hierarchy);
        setSelectedIds((prev) => [...prev, cat.id]);
      } catch (err) {
        setValidationError(
          err instanceof Error ? err.message : "Jerarquía de categorías no elegible."
        );
      }
    } else {
      setSelectedIds((prev) => prev.filter((c) => c !== cat.id));
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    if (selectedIds.length === 0) {
      setSubmitError("Asigná al menos una categoría al jugador.");
      return;
    }

    setCargando(true);
    const formData = new FormData(e.currentTarget);
    for (const id of selectedIds) {
      formData.append("categoryIds", id);
    }

    const result = await inscribirJugador(clubId, formData);
    setCargando(false);

    if (!result.ok) {
      setSubmitError(result.error ?? "Ocurrió un error inesperado.");
      return;
    }

    // Éxito: limpiar, cerrar el panel y refrescar la tabla de fondo
    setSelectedIds([]);
    setValidationError(null);
    (e.target as HTMLFormElement).reset();
    onCerrar();
    router.refresh();
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] w-full";

  return (
    <>
      {/* Fondo oscuro: clic afuera cierra el panel */}
      <div
        onClick={onCerrar}
        className={`fixed inset-0 z-40 bg-[#1A2A44]/40 backdrop-blur-[1px] transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel deslizante */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Encabezado del panel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-[#1A2A44]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F97316] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">
                Inscribir Jugador
              </h3>
              <p className="text-slate-400 text-[11px]">{clubName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition"
            aria-label="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-6"
        >
          {categories.length === 0 && (
            <div className="flex items-center gap-2 p-4 bg-orange-50 text-orange-700 text-xs rounded-xl border border-orange-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                No hay categorías cargadas. Ejecutá el script del Paso 2 en Supabase.
              </span>
            </div>
          )}

          {/* Datos personales */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Nombre/s</label>
              <input type="text" name="first_name" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Apellido/s</label>
              <input type="text" name="last_name" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                DNI (Clave Única LFS)
              </label>
              <input
                type="text"
                name="dni"
                required
                placeholder="Ej: 45222333 (sin puntos)"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Categoría Base (por Edad)
              </label>
              <select
                value={baseLevel}
                onChange={(e) => {
                  setBaseLevel(Number(e.target.value));
                  setSelectedIds([]);
                  setValidationError(null);
                }}
                className={inputClass}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.level_hierarchy}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Categorías */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-700">
              Categorías de Inscripción (podés elegir varias)
            </label>
            <div className="grid grid-cols-2 gap-3 mt-1">
              {categories.map((c) => {
                const isChecked = selectedIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none font-semibold text-xs text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleCategoryChange(c, e.target.checked)}
                      className="w-4 h-4 accent-[#F97316] rounded"
                    />
                    {c.name}
                  </label>
                );
              })}
            </div>
            {validationError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 mt-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Nota sobre documentos */}
          <div className="flex items-start gap-2 p-3 bg-[#1A2A44]/5 text-slate-500 text-[11px] rounded-xl">
            <Info className="w-4 h-4 shrink-0 text-[#F97316]" />
            <span>
              Después de inscribirlo, la documentación (ficha médica, DDJJ y foto
              DNI) se sube directamente desde la tabla del plantel, tocando el
              ícono rojo de cada casilla.
            </span>
          </div>

          {/* Error de guardado */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Botón Guardar (fijo abajo del panel) */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={cargando || categories.length === 0}
              className="w-full px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
            >
              {cargando ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {cargando ? "Guardando..." : "Registrar Jugador"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
