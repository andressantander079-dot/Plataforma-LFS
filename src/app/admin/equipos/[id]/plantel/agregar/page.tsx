"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, ArrowLeft, Save, FileUp, AlertTriangle } from "lucide-react";
import { validateCategoryEligibility } from "../../../../../../lib/core/rules/categoryRules";

export default function AgregarJugador() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;

  // Estados del Formulario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [baseCategory, setBaseCategory] = useState("3"); // 1: Sub-14, 2: Sub-16, 3: Sub-18, 4: Primera
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  const categories = [
    { label: "Sub-14 (Menores)", value: "1" },
    { label: "Sub-16 (Cadetes)", value: "2" },
    { label: "Sub-18 (Juveniles)", value: "3" },
    { label: "Primera División", value: "4" },
  ];

  // Manejar cambio en selección de categorías con validación de jerarquía
  const handleCategoryChange = (val: string, checked: boolean) => {
    setValidationError(null);
    if (checked) {
      try {
        // Validar: jugador no puede jugar en categoría menor a su baseCategory
        validateCategoryEligibility(parseInt(baseCategory), parseInt(val));
        setSelectedCategories((prev) => [...prev, val]);
      } catch (err: any) {
        setValidationError(err.message || "Jerarquía de categorías no elegible.");
      }
    } else {
      setSelectedCategories((prev) => prev.filter((c) => c !== val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !dni.trim()) {
      alert("Por favor complete los datos obligatorios.");
      return;
    }
    if (selectedCategories.length === 0) {
      alert("Por favor asigne al menos una categoría al jugador.");
      return;
    }

    console.log("Inscribiendo Jugador en Club LFS:", {
      firstName,
      lastName,
      dni,
      baseCategory,
      selectedCategories,
    });

    alert("¡Jugador inscrito con éxito en el plantel!");
    router.push(`/admin/equipos/${clubId}/plantel`);
  };

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
            Inscribir Nuevo Jugador
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Carga los datos y documentos requeridos para habilitar al jugador en competencias.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
        
        {/* Datos Personales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre/s</label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Apellido/s</label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">DNI (Clave Única LFS)</label>
            <input
              type="text"
              required
              placeholder="Ej: 45222333"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Categoría Base (por Edad)</label>
            <select
              value={baseCategory}
              onChange={(e) => {
                setBaseCategory(e.target.value);
                setSelectedCategories([]);
                setValidationError(null);
              }}
              className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
            >
              <option value="1">Sub-14</option>
              <option value="2">Sub-16</option>
              <option value="3">Sub-18</option>
              <option value="4">Primera</option>
            </select>
          </div>
        </div>

        {/* Categorías de Inscripción */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-700">Categorías de Inscripción (Múltiples categorías permitidas)</label>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {categories.map((c) => {
              const isChecked = selectedCategories.includes(c.value);
              return (
                <label key={c.value} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer select-none font-semibold text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleCategoryChange(c.value, e.target.checked)}
                    className="w-4 h-4 accent-[#F97316] rounded"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
          {validationError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-750 text-xs rounded-xl border border-red-100 mt-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>{validationError}</span>
            </div>
          )}
        </div>

        {/* Documentos */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">Subida de Documentación Obligatoria</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer text-center gap-2 text-[10px] font-bold text-slate-500">
              <FileUp className="w-5 h-5 text-slate-400" />
              <span>Ficha Médica (PDF/JPG, max 5MB)</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer text-center gap-2 text-[10px] font-bold text-slate-500">
              <FileUp className="w-5 h-5 text-slate-400" />
              <span>Declaración Jurada (PDF/JPG)</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer text-center gap-2 text-[10px] font-bold text-slate-500">
              <FileUp className="w-5 h-5 text-slate-400" />
              <span>Foto DNI (Frente/Dorso)</span>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <button
          type="submit"
          className="w-full mt-4 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
        >
          <Save className="w-4 h-4" />
          Registrar Jugador
        </button>

      </form>
    </div>
  );
}
