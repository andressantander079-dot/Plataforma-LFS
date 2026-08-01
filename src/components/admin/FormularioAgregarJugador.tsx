"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, ArrowLeft, Save, FileUp, AlertTriangle, LoaderCircle,
} from "lucide-react";
import { validateCategoryEligibility } from "@/lib/core/rules/categoryRules";
import { inscribirJugador } from "@/lib/actions/equipos.actions";

/**
 * FORMULARIO DE INSCRIPCIÓN DE JUGADOR (cliente)
 * Recibe las categorías reales de la base de datos y
 * guarda el jugador mediante una Server Action segura.
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
}

export function FormularioAgregarJugador({ clubId, clubName, categories }: Props) {
  const router = useRouter();

  const [baseLevel, setBaseLevel] = useState<number>(categories[0]?.level_hierarchy ?? 1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Validación de jerarquía: categoría base limita las elegibles
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

    router.push(`/admin/equipos/${clubId}/plantel`);
    router.refresh();
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316]";

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.push(`/admin/equipos/${clubId}/plantel`)}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#F97316]" />
            Inscribir Jugador — {clubName}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Carga los datos del jugador y asigná sus categorías reglamentarias.
          </p>
        </div>
      </section>

      {/* Sin categorías cargadas */}
      {categories.length === 0 && (
        <div className="flex items-center gap-2 p-4 bg-orange-50 text-orange-700 text-xs rounded-xl border border-orange-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            No hay categorías en la base de datos. Ejecutá el script
            <strong> supabase_paso2_rls_y_categorias.sql </strong>
            en el SQL Editor de Supabase y recargá esta página.
          </span>
        </div>
      )}

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm"
      >
        {/* Datos Personales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre/s</label>
            <input type="text" name="first_name" required className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Apellido/s</label>
            <input type="text" name="last_name" required className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Categorías de Inscripción */}
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

        {/* Documentos (visual — la subida real es el Paso 3) */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">
            Documentación Obligatoria
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {["Ficha Médica", "Declaración Jurada", "Foto DNI"].map((doc) => (
              <div
                key={doc}
                className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl text-center gap-2 text-[10px] font-bold text-slate-400"
              >
                <FileUp className="w-5 h-5 text-slate-300" />
                <span>{doc}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-400">
            La subida de archivos se habilita en el Paso 3 (Supabase Storage). Por ahora el
            jugador queda registrado con la documentación pendiente.
          </p>
        </div>

        {/* Error de guardado */}
        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={cargando || categories.length === 0}
          className="w-full mt-4 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
        >
          {cargando ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {cargando ? "Guardando..." : "Registrar Jugador"}
        </button>
      </form>
    </div>
  );
}

