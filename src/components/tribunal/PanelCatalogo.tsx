"use client";

import { useState, useTransition } from "react";
import { BookOpen, Loader2, Pencil, Plus, Power, X, CircleAlert } from "lucide-react";
import {
  guardarInfraccionCatalogo,
  alternarInfraccionCatalogo,
  type InfraccionCatalogo,
} from "@/lib/actions/tribunal.actions";
import { formatoPesos, ETIQUETA_TIPO_SANCIONADO, type TipoSancionado } from "@/lib/core/rules/tribunalRules";

/**
 * CATÁLOGO DE INFRACCIONES — editable por la federación.
 * Cada infracción precarga fechas y multa sugeridas al crear una sanción manual.
 * Se pueden desactivar (no se borran: conservan el historial).
 */

const ETIQUETA_APLICA: Record<InfraccionCatalogo["aplicaA"], string> = {
  jugador: ETIQUETA_TIPO_SANCIONADO.jugador,
  cuerpo_tecnico: ETIQUETA_TIPO_SANCIONADO.cuerpo_tecnico,
  club: ETIQUETA_TIPO_SANCIONADO.club,
  todos: "Todos",
};

export function PanelCatalogo({ catalogo }: { catalogo: InfraccionCatalogo[] }) {
  const [pendiente, startTransition] = useTransition();
  const [editando, setEditando] = useState<InfraccionCatalogo | "nueva" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    if (editando && editando !== "nueva") fd.set("id", editando.id);
    startTransition(async () => {
      const res = await guardarInfraccionCatalogo(fd);
      if (res?.error) setError(res.error);
      else setEditando(null);
    });
  };

  const alternar = (id: string, activo: boolean) => {
    startTransition(async () => {
      await alternarInfraccionCatalogo(id, activo);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500 max-w-md">
          El catálogo precarga la sanción sugerida. El tribunal siempre puede ajustarla antes de cargar.
        </p>
        <button
          onClick={() => {
            setError(null);
            setEditando("nueva");
          }}
          className="px-4 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#25375a]"
        >
          <Plus className="w-4 h-4" /> Nueva infracción
        </button>
      </div>

      {/* Formulario (nueva / editar) */}
      {editando && (
        <form
          onSubmit={guardar}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-serif text-sm font-black text-[#1A2A44]">
              {editando === "nueva" ? "Nueva infracción" : `Editar: ${editando.nombre}`}
            </h4>
            <button type="button" onClick={() => setEditando(null)} className="p-1 rounded-full bg-white text-slate-500" aria-label="Cancelar">
              <X className="w-4 h-4" />
            </button>
          </div>
          <input
            name="nombre"
            required
            minLength={3}
            defaultValue={editando === "nueva" ? "" : editando.nombre}
            placeholder="Nombre de la infracción"
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
          />
          <input
            name="descripcion"
            defaultValue={editando === "nueva" ? "" : (editando.descripcion ?? "")}
            placeholder="Descripción (opcional, uso interno)"
            className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              name="aplicaA"
              defaultValue={editando === "nueva" ? "jugador" : editando.aplicaA}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              <option value="jugador">Jugador</option>
              <option value="cuerpo_tecnico">Cuerpo técnico</option>
              <option value="club">Club</option>
              <option value="todos">Todos</option>
            </select>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <input
                name="fechasDefault"
                type="number"
                min={0}
                max={30}
                defaultValue={editando === "nueva" ? 0 : editando.fechasDefault}
                className="w-full text-sm focus:outline-none"
              />
              <span className="text-[10px] font-bold text-slate-400 shrink-0">fechas</span>
            </div>
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5">
              <span className="text-[10px] font-bold text-slate-400 shrink-0">$</span>
              <input
                name="multaDefault"
                type="number"
                min={0}
                step={500}
                defaultValue={editando === "nueva" ? 0 : editando.multaDefault}
                className="w-full text-sm focus:outline-none"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-600 font-bold flex items-center gap-1">
              <CircleAlert className="w-3.5 h-3.5" /> {error}
            </p>
          )}
          <button
            disabled={pendiente}
            className="self-start px-5 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
          >
            {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
            Guardar infracción
          </button>
        </form>
      )}

      {/* Lista */}
      <div className="grid gap-2">
        {catalogo.map((c) => (
          <div
            key={c.id}
            className={`bg-white border rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap ${
              c.activo ? "border-slate-200" : "border-slate-100 opacity-60"
            }`}
          >
            <BookOpen className="w-4 h-4 text-[#F97316] shrink-0" />
            <div className="flex-1 min-w-[180px]">
              <p className="text-sm font-bold text-[#1A2A44]">
                {c.nombre}
                {!c.activo && <span className="ml-2 text-[9px] font-black text-slate-400 uppercase">(desactivada)</span>}
              </p>
              {c.descripcion && <p className="text-[11px] text-slate-500">{c.descripcion}</p>}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-bold flex-wrap">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{ETIQUETA_APLICA[c.aplicaA]}</span>
              {c.fechasDefault > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                  {c.fechasDefault} fecha{c.fechasDefault > 1 ? "s" : ""}
                </span>
              )}
              {c.multaDefault > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                  {formatoPesos(c.multaDefault)}
                </span>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setEditando(c);
                }}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label={`Editar ${c.nombre}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => alternar(c.id, !c.activo)}
                disabled={pendiente}
                className={`p-2 rounded-xl ${
                  c.activo ? "bg-slate-100 text-slate-600 hover:bg-red-50 hover:text-red-600" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                }`}
                aria-label={c.activo ? `Desactivar ${c.nombre}` : `Activar ${c.nombre}`}
              >
                <Power className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
        {catalogo.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">Todavía no hay infracciones en el catálogo.</p>
        )}
      </div>
    </div>
  );
}
