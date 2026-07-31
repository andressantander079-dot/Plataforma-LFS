"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ArrowLeft, Save, Plus } from "lucide-react";

export default function CrearCompetencia() {
  const router = useRouter();
  
  // Estados del Formulario
  const [name, setName] = useState("");
  const [year, setYear] = useState(2026);
  const [category, setCategory] = useState("Primera");
  const [gender, setGender] = useState("Masculino");
  const [winPoints, setWinPoints] = useState(3);
  const [drawPoints, setDrawPoints] = useState(1);
  const [lossPoints, setLossPoints] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Por favor ingrese el nombre del torneo.");
      return;
    }

    // Datos simulados a guardar en base de datos
    console.log("Guardando Competencia LFS:", {
      name,
      year,
      category,
      gender,
      points_system: { winPoints, drawPoints, lossPoints }
    });

    alert("¡Competencia creada con éxito!");
    router.push("/admin/competencias");
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.push("/admin/competencias")}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Trophy className="w-7 h-7 text-[#F97316]" />
            Nueva Competencia
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Configura las reglas, categorías y sistema de puntuación para un nuevo torneo.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
        
        {/* Nombre del torneo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Nombre de la Competencia</label>
          <input
            type="text"
            required
            placeholder="Ej: Torneo Clausura LFS 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        {/* Año y Categoría */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Año de Edición</label>
            <input
              type="number"
              required
              min={2020}
              max={2030}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316]"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Categoría</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
            >
              <option value="Primera">Primera División</option>
              <option value="Sub-18">Sub-18 (Juveniles)</option>
              <option value="Sub-16">Sub-16</option>
              <option value="Sub-14">Sub-14</option>
            </select>
          </div>
        </div>

        {/* Género/Rama */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Rama / Género</label>
          <div className="flex gap-4">
            {["Masculino", "Femenino", "Mixto"].map((g) => (
              <label key={g} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer font-semibold">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === g}
                  onChange={() => setGender(g)}
                  className="w-4 h-4 accent-[#F97316]"
                />
                {g}
              </label>
            ))}
          </div>
        </div>

        {/* Sistema de Puntuación */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">Sistema de Puntuación (Puntos por Partido)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-450 uppercase">Victoria</label>
              <input
                type="number"
                min={0}
                value={winPoints}
                onChange={(e) => setWinPoints(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold text-center focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-450 uppercase">Empate</label>
              <input
                type="number"
                min={0}
                value={drawPoints}
                onChange={(e) => setDrawPoints(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold text-center focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-450 uppercase">Derrota</label>
              <input
                type="number"
                min={0}
                value={lossPoints}
                onChange={(e) => setLossPoints(parseInt(e.target.value))}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold text-center focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <button
          type="submit"
          className="w-full mt-4 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
        >
          <Save className="w-4 h-4" />
          Guardar Competencia
        </button>

      </form>
    </div>
  );
}
