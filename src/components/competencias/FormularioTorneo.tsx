"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trophy, Loader2, AlertCircle, Info } from "lucide-react";
import { crearTorneo } from "@/lib/actions/competencias.actions";

/**
 * FORMULARIO DE ALTA DE TORNEO (admin)
 * Nombre libre, categoría, formato, ida/vuelta, puntos, desempate y W.O.
 * Al crearlo, los clubes habilitados se inscriben automáticamente.
 */

interface Categoria {
  id: string;
  name: string;
}

const CLASE_INPUT =
  "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]";
const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

export function FormularioTorneo({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await crearTorneo(formData);
          if (res.error) setError(res.error);
          else if (res.id) router.push(`/admin/competencias/${res.id}`);
        });
      }}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-5 max-w-2xl"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className={CLASE_LABEL}>
          Nombre del torneo
          <input
            name="name"
            required
            placeholder="Ej: Apertura 2026"
            className={CLASE_INPUT}
          />
        </label>

        <label className={CLASE_LABEL}>
          Temporada
          <input
            name="season"
            defaultValue={new Date().getFullYear().toString()}
            placeholder="2026"
            className={CLASE_INPUT}
          />
        </label>

        <label className={CLASE_LABEL}>
          Categoría
          <select name="category_id" required className={CLASE_INPUT}>
            <option value="">Elegí una categoría…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className={CLASE_LABEL}>
          Formato
          <select name="format" defaultValue="liga" className={CLASE_INPUT}>
            <option value="liga">Liga — todos contra todos</option>
            <option value="eliminacion" disabled>
              Eliminación directa (fase 2)
            </option>
            <option value="grupos_playoffs" disabled>
              Grupos + Playoffs (fase 2)
            </option>
            <option value="liga_playoffs" disabled>
              Liga + Playoffs (fase 2)
            </option>
          </select>
        </label>

        <label className={CLASE_LABEL}>
          Partidos
          <select name="rounds" defaultValue="1" className={CLASE_INPUT}>
            <option value="1">Solo ida</option>
            <option value="2">Ida y vuelta</option>
          </select>
        </label>

        <label className={CLASE_LABEL}>
          Desempate en la tabla
          <select name="tiebreaker" defaultValue="diferencia_gol" className={CLASE_INPUT}>
            <option value="diferencia_gol">Diferencia de gol, luego goles a favor</option>
            <option value="enfrentamiento_directo">Enfrentamiento directo primero</option>
          </select>
        </label>
      </div>

      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">Sistema de puntos</legend>
        <div className="grid grid-cols-3 gap-3">
          <label className={CLASE_LABEL}>
            Victoria
            <input name="points_win" type="number" min={0} defaultValue={3} className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Empate
            <input name="points_draw" type="number" min={0} defaultValue={1} className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Derrota
            <input name="points_loss" type="number" min={0} defaultValue={0} className={CLASE_INPUT} />
          </label>
        </div>
      </fieldset>

      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">W.O. y disciplina</legend>
        <div className="grid grid-cols-3 gap-3">
          <label className={CLASE_LABEL}>
            Goles W.O. ganador
            <input name="wo_home_goals" type="number" min={0} defaultValue={5} className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Goles W.O. perdedor
            <input name="wo_away_goals" type="number" min={0} defaultValue={0} className={CLASE_INPUT} />
          </label>
          <label className={CLASE_LABEL}>
            Amarillas = 1 fecha
            <input
              name="yellow_cards_suspension"
              type="number"
              min={1}
              defaultValue={5}
              className={CLASE_INPUT}
            />
          </label>
        </div>
      </fieldset>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#F97316]" />
        Al crear el torneo, todos los clubes HABILITADOS se inscriben automáticamente con un
        equipo. Después podés agregar equipos extra o quitar los que no participen.
      </p>

      {error && (
        <p className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
      >
        {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
        Crear torneo
      </button>
    </form>
  );
}
