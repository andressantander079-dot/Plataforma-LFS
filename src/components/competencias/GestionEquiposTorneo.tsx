"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Users, Loader2, AlertCircle } from "lucide-react";
import { agregarEquipo, quitarEquipo } from "@/lib/actions/competencias.actions";

/**
 * GESTIÓN DE EQUIPOS DEL TORNEO (admin)
 * Los clubes habilitados entran automáticamente al crear el torneo.
 * Acá la federación puede agregar equipos extra de un club ("Club B")
 * o quitar equipos que todavía no jugaron.
 */

export interface EquipoInscripto {
  teamId: string;
  nombre: string;
  clubNombre: string;
}

interface OpcionClub {
  id: string;
  nombre: string;
}

export function GestionEquiposTorneo({
  competitionId,
  equipos,
  clubesDisponibles,
}: {
  competitionId: string;
  equipos: EquipoInscripto[];
  clubesDisponibles: OpcionClub[];
}) {
  const [clubSeleccionado, setClubSeleccionado] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function agregar() {
    if (!clubSeleccionado) return;
    setError(null);
    startTransition(async () => {
      const res = await agregarEquipo(competitionId, clubSeleccionado);
      if (res.error) setError(res.error);
      else setClubSeleccionado("");
    });
  }

  function quitar(teamId: string, nombre: string) {
    if (!window.confirm(`¿Quitar a ${nombre} del torneo? Se borran sus partidos sin confirmar.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await quitarEquipo(competitionId, teamId);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {equipos.map((e) => (
          <span
            key={e.teamId}
            className="inline-flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold text-[#1A2A44]"
          >
            <Users className="w-3.5 h-3.5 text-[#F97316]" />
            {e.nombre}
            <button
              type="button"
              disabled={pendiente}
              onClick={() => quitar(e.teamId, e.nombre)}
              className="text-slate-400 hover:text-red-500 transition disabled:opacity-40"
              aria-label={`Quitar a ${e.nombre}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}
        {equipos.length === 0 && (
          <p className="text-xs text-slate-400">No hay equipos inscriptos todavía.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={clubSeleccionado}
          onChange={(e) => setClubSeleccionado(e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
        >
          <option value="">Agregar equipo de un club…</option>
          {clubesDisponibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={agregar}
          disabled={pendiente || !clubSeleccionado}
          className="px-3 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-40 flex items-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Agregar
        </button>
      </div>

      <p className="text-[10px] text-slate-400">
        Si el club ya tiene un equipo en el torneo, el nuevo se crea como “Club B”, “Club C”, etc.
      </p>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  );
}
