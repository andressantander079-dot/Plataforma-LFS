"use client";

import { useRef, useState, useTransition } from "react";
import { CircleAlert, Loader2, Plus, Trash2 } from "lucide-react";
import {
  eliminarNivelArbitro,
  guardarNivelArbitro,
  actualizarTarifaNivel,
  type NivelArbitroUI,
} from "@/lib/actions/arbitros.actions";

/**
 * NIVELES ARBITRALES (admin) — categorías A/B/C configurables con su tarifa
 * por partido (de acá sale la liquidación mensual de honorarios).
 */
export function GestionNiveles({ niveles }: { niveles: NivelArbitroUI[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [tarifaEdit, setTarifaEdit] = useState<Record<string, string>>({});

  const crear = (formData: FormData) => {
    setAviso(null);
    startTransition(async () => {
      const res = await guardarNivelArbitro(formData);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({ tipo: "ok", texto: "Nivel creado." });
        formRef.current?.reset();
      }
    });
  };

  const guardarTarifa = (nivelId: string) => {
    const valor = Number(tarifaEdit[nivelId]);
    if (isNaN(valor)) return;
    startTransition(async () => {
      const res = await actualizarTarifaNivel(nivelId, valor);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Tarifa actualizada." });
    });
  };

  const eliminar = (nivelId: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar el nivel "${nombre}"?`)) return;
    startTransition(async () => {
      const res = await eliminarNivelArbitro(nivelId);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Nivel eliminado." });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {aviso && (
        <p
          className={`text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 ${
            aviso.tipo === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <CircleAlert className="w-4 h-4 shrink-0" /> {aviso.texto}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3 w-14">Orden</th>
              <th className="px-4 py-3">Nivel</th>
              <th className="px-4 py-3">Tarifa por partido</th>
              <th className="px-4 py-3 text-right w-16">Borrar</th>
            </tr>
          </thead>
          <tbody>
            {niveles.map((n) => (
              <tr key={n.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-black text-slate-400 text-xs">{n.orden}</td>
                <td className="px-4 py-3 font-bold text-[#1A2A44] text-xs">{n.nombre}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      min={0}
                      defaultValue={n.tarifa_partido}
                      onChange={(e) =>
                        setTarifaEdit((prev) => ({ ...prev, [n.id]: e.target.value }))
                      }
                      className="w-28 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-[#F97316]/60"
                    />
                    <button
                      onClick={() => guardarTarifa(n.id)}
                      disabled={pendiente || tarifaEdit[n.id] === undefined}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-[#1A2A44] hover:text-white text-[10px] font-bold transition disabled:opacity-40"
                    >
                      Guardar
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => eliminar(n.id, n.nombre)}
                    disabled={pendiente}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {niveles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                  No hay niveles. Creá el primero abajo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        ref={formRef}
        action={crear}
        className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-3"
      >
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#F97316]" /> Nuevo nivel
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            name="nombre"
            required
            placeholder="Nombre (ej: Categoría D)"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          />
          <input
            name="orden"
            type="number"
            min={1}
            max={99}
            required
            placeholder="Orden (1 = más alto)"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          />
          <input
            name="tarifa_partido"
            type="number"
            min={0}
            step="0.01"
            required
            placeholder="Tarifa por partido ($)"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          />
        </div>
        <button
          type="submit"
          disabled={pendiente}
          className="w-full sm:w-48 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-black text-xs transition flex items-center justify-center gap-2"
        >
          {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
          Crear nivel
        </button>
      </form>
    </div>
  );
}
