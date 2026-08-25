"use client";

import { useState } from "react";
import { Save, LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { actualizarConfiguracionClub } from "@/lib/actions/equipos.actions";

interface FormularioConfiguracionClubProps {
  clubId: string;
  initialPhone: string;
  initialCamiseta: string;
  initialCamisetaAlternativa: string;
}

export function FormularioConfiguracionClub({
  clubId,
  initialPhone,
  initialCamiseta,
  initialCamisetaAlternativa,
}: FormularioConfiguracionClubProps) {
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setExito(false);

    const formData = new FormData(e.currentTarget);
    const res = await actualizarConfiguracionClub(clubId, formData);
    setCargando(false);

    if (res.ok) {
      setExito(true);
      setTimeout(() => setExito(false), 4000);
    } else {
      setError(res.error ?? "Ocurrió un error al guardar.");
    }
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] w-full disabled:opacity-60";

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Teléfono Delegado */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Teléfono Delegado / Contacto</label>
          <input
            type="text"
            name="phone"
            defaultValue={initialPhone}
            placeholder="Ej: +54 2901 442211"
            className={inputClass}
            disabled={cargando}
          />
        </div>

        {/* Camiseta Principal */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Camiseta Principal (Colores)</label>
          <input
            type="text"
            name="camiseta"
            defaultValue={initialCamiseta}
            placeholder="Ej: Verde y Blanco"
            className={inputClass}
            disabled={cargando}
          />
        </div>

        {/* Camiseta Alternativa */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Camiseta Alternativa</label>
          <input
            type="text"
            name="camiseta_alternativa"
            defaultValue={initialCamisetaAlternativa}
            placeholder="Ej: Azul Marino"
            className={inputClass}
            disabled={cargando}
          />
        </div>
      </div>

      {exito && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-200">
          <CheckCircle2 className="w-4.5 h-4.5 shrink-0" />
          <span className="font-semibold">¡Ajustes guardados con éxito en el portal!</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          <AlertCircle className="w-4.5 h-4.5 shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="w-full py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md shadow-[#F97316]/10 flex items-center justify-center gap-1.5 hover:bg-[#F97316]/95 transition disabled:opacity-60"
      >
        {cargando ? (
          <LoaderCircle className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {cargando ? "Guardando..." : "Guardar Ajustes"}
      </button>
    </form>
  );
}
