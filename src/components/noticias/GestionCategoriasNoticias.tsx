"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Tags, Newspaper } from "lucide-react";
import type { CategoriaNoticiaUI } from "@/lib/actions/noticias.actions";
import {
  guardarCategoriaNoticia,
  eliminarCategoriaNoticia,
} from "@/lib/actions/noticias.actions";
import { COLORES_CATEGORIA } from "@/lib/core/rules/noticiasRules";

interface FormularioCategoria {
  id?: string;
  nombre: string;
  color: string;
  orden: number;
}

const FORM_VACIO: FormularioCategoria = { nombre: "", color: COLORES_CATEGORIA[0], orden: 10 };

export function GestionCategoriasNoticias({ categorias }: { categorias: CategoriaNoticiaUI[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormularioCategoria>(FORM_VACIO);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setGuardando(true);
    setError(null);
    const r = await guardarCategoriaNoticia(form);
    setGuardando(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo guardar.");
      return;
    }
    setForm(FORM_VACIO);
    router.refresh();
  }

  async function borrar(c: CategoriaNoticiaUI) {
    if (!confirm(`¿Borrar la categoría "${c.nombre}"?`)) return;
    const r = await eliminarCategoriaNoticia(c.id);
    if (!r.ok) alert(r.error ?? "No se pudo borrar.");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulario alta/edición */}
      <form
        onSubmit={guardar}
        className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col gap-4 h-fit"
      >
        <h3 className="font-serif font-bold text-[#1A2A44] flex items-center gap-2">
          <Tags className="w-4 h-4 text-[#F97316]" />
          {form.id ? "Editar categoría" : "Nueva categoría"}
        </h3>

        <div>
          <label htmlFor="input-cat-nombre" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Nombre
          </label>
          <input
            id="input-cat-nombre"
            type="text"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej.: Competencias"
            maxLength={40}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
          />
        </div>

        <div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">Color</span>
          <div className="flex gap-2 flex-wrap">
            {COLORES_CATEGORIA.map((hex) => (
              <button
                key={hex}
                type="button"
                id={`btn-cat-color-${hex.replace("#", "")}`}
                onClick={() => setForm((f) => ({ ...f, color: hex }))}
                className={`w-8 h-8 rounded-full transition-transform ${
                  form.color === hex ? "ring-2 ring-offset-2 ring-[#1A2A44] scale-110" : "hover:scale-105"
                }`}
                style={{ backgroundColor: hex }}
                title={hex}
              />
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="input-cat-orden" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
            Orden (menor = primero)
          </label>
          <input
            id="input-cat-orden"
            type="number"
            value={form.orden}
            onChange={(e) => setForm((f) => ({ ...f, orden: Number(e.target.value) }))}
            min={0}
            max={999}
            className="w-24 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
          />
        </div>

        {error && <p className="text-xs text-rose-600 font-semibold">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            id="btn-guardar-categoria"
            disabled={guardando}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition text-sm disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {form.id ? "Guardar cambios" : "Crear categoría"}
          </button>
          {form.id && (
            <button
              type="button"
              id="btn-cancelar-categoria"
              onClick={() => { setForm(FORM_VACIO); setError(null); }}
              className="px-4 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Listado */}
      <div className="lg:col-span-2 flex flex-col gap-3">
        {categorias.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-slate-500 text-sm">
            No hay categorías todavía.
          </div>
        ) : (
          categorias.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-4"
            >
              <span
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                style={{ backgroundColor: c.color }}
              >
                <Newspaper className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-[#1A2A44] text-sm truncate">{c.nombre}</h4>
                <span className="text-[11px] text-slate-400">
                  {c.noticias} noticia{c.noticias === 1 ? "" : "s"} · orden {c.orden}
                </span>
              </div>
              <button
                id={`btn-editar-cat-${c.id}`}
                onClick={() => setForm({ id: c.id, nombre: c.nombre, color: c.color, orden: c.orden })}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1A2A44] transition"
                title="Editar"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                id={`btn-borrar-cat-${c.id}`}
                onClick={() => borrar(c)}
                className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                title="Borrar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
