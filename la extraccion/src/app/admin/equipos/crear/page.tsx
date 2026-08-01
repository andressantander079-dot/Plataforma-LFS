"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, ArrowLeft, Save, LoaderCircle, AlertTriangle, Plus, Trash2,
  CheckCircle, KeyRound, Info,
} from "lucide-react";
import { crearClub } from "@/lib/actions/equipos.actions";

/**
 * ALTA DE NUEVO CLUB
 * - Presidente y Tesorero (obligatorios)
 * - Representantes extra con botón "+" (Delegados, Secretarios, etc.)
 * - Credenciales de acceso opcionales: la federación asigna email y
 *   contraseña para que el club entre a su panel.
 */

interface Representante {
  full_name: string;
  dni: string;
  phone: string;
  cargo: string;
}

const CARGOS = ["Delegado", "Vicepresidente", "Secretario", "Protesorero", "Otro"];

export default function CrearEquipo() {
  const router = useRouter();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [representantes, setRepresentantes] = useState<Representante[]>([]);

  function agregarRepresentante() {
    setRepresentantes((prev) => [
      ...prev,
      { full_name: "", dni: "", phone: "", cargo: "Delegado" },
    ]);
  }

  function quitarRepresentante(index: number) {
    setRepresentantes((prev) => prev.filter((_, i) => i !== index));
  }

  function actualizarRepresentante(
    index: number,
    campo: keyof Representante,
    valor: string
  ) {
    setRepresentantes((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [campo]: valor } : r))
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAviso(null);
    setCargando(true);

    const formData = new FormData(e.currentTarget);
    formData.set("representantes", JSON.stringify(representantes));

    const result = await crearClub(formData);
    setCargando(false);

    if (!result.ok) {
      setError(result.error ?? "Ocurrió un error inesperado.");
      return;
    }

    if (result.aviso) {
      // El club se creó pero algo secundario falló: avisamos antes de volver
      setAviso(result.aviso);
      setTimeout(() => {
        router.push("/admin/equipos");
        router.refresh();
      }, 4000);
      return;
    }

    router.push("/admin/equipos");
    router.refresh();
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] w-full";

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
            Ingresa los datos institucionales, los representantes y el acceso al sistema.
          </p>
        </div>
      </section>

      {/* Formulario */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-6 shadow-sm"
      >
        {/* Nombre del Club */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">
            Nombre del Club / Institución
          </label>
          <input
            type="text"
            name="name"
            required
            placeholder="Ej: Club Social y Deportivo Galicia"
            className={inputClass}
          />
        </div>

        {/* Datos Presidente */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">
            Datos del Presidente
          </h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre y Apellido</label>
            <input
              type="text"
              name="president_name"
              required
              placeholder="Ej: Guillermo Vargas"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">DNI Presidente</label>
              <input type="text" name="president_dni" required placeholder="DNI único" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Teléfono de Contacto</label>
              <input type="tel" name="president_phone" required placeholder="+54 2901 123456" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Datos Tesorero */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <h3 className="font-serif text-sm font-bold text-[#1A2A44]">
            Datos del Tesorero
          </h3>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Nombre y Apellido</label>
            <input
              type="text"
              name="treasurer_name"
              required
              placeholder="Ej: Roberto Gómez"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">DNI Tesorero</label>
              <input type="text" name="treasurer_dni" required placeholder="DNI único" className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Teléfono de Contacto</label>
              <input type="tel" name="treasurer_phone" required placeholder="+54 2901 123456" className={inputClass} />
            </div>
          </div>
        </div>

        {/* Representantes extra con "+" */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-sm font-bold text-[#1A2A44]">
                Otros Representantes
              </h3>
              <p className="text-slate-400 text-[10px] mt-0.5">
                Opcional: delegados, secretarios u otras autoridades del club.
              </p>
            </div>
            <button
              type="button"
              onClick={agregarRepresentante}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold bg-[#1A2A44] hover:bg-[#1A2A44]/90 text-white transition text-[11px]"
            >
              <Plus className="w-4 h-4" />
              Agregar
            </button>
          </div>

          {representantes.length === 0 && (
            <p className="text-slate-400 text-xs italic">
              Sin representantes adicionales. Tocá "Agregar" para sumar uno.
            </p>
          )}

          {representantes.map((rep, index) => (
            <div
              key={index}
              className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3 bg-slate-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  Representante #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => quitarRepresentante(index)}
                  className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition"
                  title="Quitar representante"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre y Apellido"
                  value={rep.full_name}
                  onChange={(e) => actualizarRepresentante(index, "full_name", e.target.value)}
                  className={inputClass}
                />
                <select
                  value={rep.cargo}
                  onChange={(e) => actualizarRepresentante(index, "cargo", e.target.value)}
                  className={inputClass}
                >
                  {CARGOS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="DNI"
                  value={rep.dni}
                  onChange={(e) => actualizarRepresentante(index, "dni", e.target.value)}
                  className={inputClass}
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={rep.phone}
                  onChange={(e) => actualizarRepresentante(index, "phone", e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Credenciales de acceso */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#F97316]" />
            <h3 className="font-serif text-sm font-bold text-[#1A2A44]">
              Credenciales de Acceso (opcional)
            </h3>
          </div>
          <div className="flex items-start gap-2 p-3 bg-[#1A2A44]/5 text-slate-500 text-[11px] rounded-xl">
            <Info className="w-4 h-4 shrink-0 text-[#F97316]" />
            <span>
              Acá la federación asigna el email y la contraseña con los que el club
              va a entrar a su panel. También podés asignarlas después desde el
              plantel del club. Entrégaselas solo a las autoridades del club.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Email de acceso</label>
              <input
                type="email"
                name="club_email"
                placeholder="club@lfs.org.ar"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Contraseña (mínimo 6 caracteres)
              </label>
              <input
                type="text"
                name="club_password"
                placeholder="Ej: lfs2026camioneros"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Estado Habilitación Inicial */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700">
            Estado de Habilitación Inicial
          </label>
          <select name="status" defaultValue="inhabilitado" className={inputClass}>
            <option value="inhabilitado">Inhabilitado (Espera pago inicial)</option>
            <option value="en_revision">En revisión (Comprobante subido)</option>
            <option value="habilitado">Habilitado (Acceso completo a planteles)</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Aviso parcial */}
        {aviso && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 text-orange-700 text-xs rounded-xl border border-orange-200">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{aviso} (Volviendo a la lista en unos segundos...)</span>
          </div>
        )}

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={cargando}
          className="w-full mt-4 px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
        >
          {cargando ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {cargando ? "Guardando..." : "Registrar Club"}
        </button>
      </form>
    </div>
  );
}
