"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, PlusCircle, Trash2, Loader2, AlertCircle, Users } from "lucide-react";
import { crearPlantel, eliminarPlantel } from "@/lib/actions/equipos.actions";

export interface CategoriaBasica {
  id: string;
  name: string;
  level_hierarchy: number;
}

export interface PlantelResumen {
  plantelId: string;
  categoryId: string;
  categoriaNombre: string;
  cantidadJugadores: number;
}

/**
 * GESTIÓN DE PLANTELES (vista del admin, Paso 10B)
 * El admin puede crear y eliminar planteles de cualquier club.
 *  · Crear: una categoría de la liga que el club todavía no usa.
 *  · Eliminar: solo planteles vacíos (sin jugadores inscriptos).
 * Un jugador solo puede inscribirse si su plantel ya existe.
 */
export function GestionPlanteles({
  clubId,
  planteles,
  categoriasSinPlantel,
}: {
  clubId: string;
  planteles: PlantelResumen[];
  categoriasSinPlantel: CategoriaBasica[];
}) {
  const router = useRouter();
  const [categoriaElegida, setCategoriaElegida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function crear() {
    if (!categoriaElegida) return;
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await crearPlantel(clubId, categoriaElegida);
      if ("error" in res && res.error) setError(res.error);
      else {
        setOk("✅ Plantel creado. Ya se pueden inscribir jugadores en esa categoría.");
        setCategoriaElegida("");
        router.refresh();
      }
    });
  }

  function eliminar(plantelId: string) {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await eliminarPlantel(plantelId);
      if ("error" in res && res.error) setError(res.error);
      else {
        setOk("✅ Plantel eliminado.");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-[#F97316]" />
        <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wider">
          Planteles del club (por categoría)
        </h3>
      </div>

      {/* Crear plantel */}
      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={categoriaElegida}
          onChange={(e) => setCategoriaElegida(e.target.value)}
          className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
        >
          <option value="">
            {categoriasSinPlantel.length > 0
              ? "Elegí la categoría del nuevo plantel…"
              : "El club ya tiene un plantel en cada categoría"}
          </option>
          {categoriasSinPlantel.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pendiente || !categoriaElegida}
          onClick={crear}
          className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-[11px] font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5 justify-center"
        >
          {pendiente ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <PlusCircle className="w-3.5 h-3.5" />
          )}
          Crear plantel
        </button>
      </div>

      {/* Planteles existentes */}
      {planteles.length === 0 ? (
        <p className="text-xs text-slate-500">
          Este club todavía no tiene planteles. Creá el primero para habilitar la inscripción de
          jugadores.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {planteles.map((p) => (
            <div
              key={p.plantelId}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <span className="text-xs font-bold text-[#1A2A44]">{p.categoriaNombre}</span>
              <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                <Users className="w-3 h-3" /> {p.cantidadJugadores}
              </span>
              {p.cantidadJugadores === 0 && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => eliminar(p.plantelId)}
                  title="Eliminar plantel vacío"
                  className="text-red-500 hover:text-red-700 transition disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && <p className="text-xs font-semibold text-green-700">{ok}</p>}

      <p className="text-[10px] text-slate-400">
        Solo se puede eliminar un plantel vacío. La inscripción de jugadores exige que el plantel
        de su categoría ya exista.
      </p>
    </div>
  );
}
