"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ArrowLeft, Save } from "lucide-react";

export default function CrearEquipo() {
  const router = useRouter();

  // Estados del Formulario
  const [name, setName] = useState("");
  const [presDni, setPresDni] = useState("");
  const [presPhone, setPresPhone] = useState("");
  const [treasDni, setTreasDni] = useState("");
  const [treasPhone, setTreasPhone] = useState("");
  const [status, setStatus] = useState("inhabilitado");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !presDni.trim() || !presPhone.trim() || !treasDni.trim() || !treasPhone.trim()) {
      alert("Por favor complete todos los campos obligatorios.");
      return;
    }

    // Datos simulados a guardar en base de datos
    console.log("Creando Club LFS:", {
      name,
      president_dni: presDni,
      president_phone: presPhone,
      treasurer_dni: treasDni,
      treasurer_phone: treasPhone,
      status
    });

    alert("¡Club registrado exitosamente! Se han enviado las credenciales por correo.");
    router.push("/admin/equipos");
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button
          type="button"
          onClick={() => router.push("/admin/equipos")}
          className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#F97316]" />
            Alta de Nuevo Club
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Ingresa los datos institucionales y de los directivos responsables del club.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
        
        {/* Nombre del Club */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Nombre del Club / Institución</label>
          <input
            type="text"
            required
            placeholder="Ej: Club Social y Deportivo Galicia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        {/* Datos Presidente */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">Datos del Presidente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">DNI Presidente</label>
              <input
                type="text"
                required
                placeholder="DNI único"
                value={presDni}
                onChange={(e) => setPresDni(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Teléfono de Contacto</label>
              <input
                type="tel"
                required
                placeholder="+54 2901 123456"
                value={presPhone}
                onChange={(e) => setPresPhone(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Datos Tesorero */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">Datos del Tesorero</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">DNI Tesorero</label>
              <input
                type="text"
                required
                placeholder="DNI único"
                value={treasDni}
                onChange={(e) => setTreasDni(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Teléfono de Contacto</label>
              <input
                type="tel"
                required
                placeholder="+54 2901 123456"
                value={treasPhone}
                onChange={(e) => setTreasPhone(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Estado Habilitación Inicial */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">Estado de Habilitación Inicial</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none"
          >
            <option value="inhabilitado">Inhabilitado (Espera pago inicial)</option>
            <option value="en_revision">En revisión (Comprobante subido)</option>
            <option value="habilitado">Habilitado (Acceso completo a planteles)</option>
          </select>
        </div>

        {/* Botón Guardar */}
        <button
          type="submit"
          className="w-full mt-4 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
        >
          <Save className="w-4 h-4" />
          Registrar Club
        </button>

      </form>
    </div>
  );
}
