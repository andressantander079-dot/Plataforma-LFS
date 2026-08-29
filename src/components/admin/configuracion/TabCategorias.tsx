"use client";

import { useState } from "react";
import {
  Layers,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
  ShieldAlert,
} from "lucide-react";
import type { CategoryItem } from "@/lib/core/rules/configuracionRules";
import { ModalCategoria } from "./ModalCategoria";

interface TabCategoriasProps {
  categories: CategoryItem[];
  onCreateCategory: (data: unknown) => Promise<{ success: boolean; error?: string }>;
  onUpdateCategory: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
  onToggleStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  onDeleteCategory: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function TabCategorias({
  categories,
  onCreateCategory,
  onUpdateCategory,
  onToggleStatus,
  onDeleteCategory,
}: TabCategoriasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("todos");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGender = selectedGender === "todos" || cat.gender === selectedGender;
    return matchesSearch && matchesGender;
  });

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleSave = async (data: unknown) => {
    let res: { success: boolean; error?: string };
    if (editingCategory) {
      res = await onUpdateCategory(editingCategory.id, data);
    } else {
      res = await onCreateCategory(data);
    }

    if (res.success) {
      setFeedbackMsg({
        text: editingCategory ? "Categoría actualizada correctamente." : "Categoría creada con éxito.",
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al procesar la categoría.", type: "error" });
    }
    return res;
  };

  const handleToggle = async (cat: CategoryItem) => {
    const newStatus = !cat.is_active;
    const res = await onToggleStatus(cat.id, newStatus);
    if (res.success) {
      setFeedbackMsg({
        text: `Categoría "${cat.name}" ${newStatus ? "habilitada" : "deshabilitada (Soft-Deactivate)"}.`,
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al cambiar estado.", type: "error" });
    }
  };

  const handleDelete = async (cat: CategoryItem) => {
    const confirm = window.confirm(
      `¿Estás seguro de eliminar la categoría "${cat.name}"?\n\nSi posee equipos o torneos asociados no se podrá eliminar (en su lugar podés deshabilitarla).`
    );
    if (!confirm) return;

    const res = await onDeleteCategory(cat.id);
    if (res.success) {
      setFeedbackMsg({ text: `Categoría "${cat.name}" eliminada.`, type: "success" });
    } else {
      setFeedbackMsg({ text: res.error || "No se pudo eliminar la categoría.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Banner Informativo Soft-Deactivate */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F97316]/20 text-[#F97316] flex items-center justify-center font-bold shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold">Gestión y Habilitación de Categorías</h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Controlá qué divisiones están activas para nuevos torneos e inscripciones de clubes. Las categorías desactivadas conservan íntegramente todo el historial deportivo y planillas pasadas.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nueva Categoría
        </button>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs hover:underline font-bold">
            Cerrar
          </button>
        </div>
      )}

      {/* Barra de Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">Género:</span>
          <select
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          >
            <option value="todos">Todos los Géneros</option>
            <option value="masculino">Masculino</option>
            <option value="femenino">Femenino</option>
            <option value="mixto">Mixto</option>
          </select>
        </div>
      </div>

      {/* Tabla de Categorías */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Categoría</th>
                <th className="px-4 py-3.5">Jerarquía</th>
                <th className="px-4 py-3.5">Género</th>
                <th className="px-4 py-3.5">Rango Año Nacimiento</th>
                <th className="px-4 py-3.5 text-center">Estado (Soft-Deactivate)</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#1A2A44]">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No se encontraron categorías con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => (
                  <tr
                    key={cat.id}
                    className={`hover:bg-slate-50/70 transition ${
                      !cat.is_active ? "opacity-60 bg-slate-50/30" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-bold">
                      <div className="flex items-center gap-2">
                        <span>{cat.name}</span>
                        {!cat.is_active && (
                          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[9px] font-bold">
                            Inactiva
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-[#1A2A44] text-white font-bold text-[11px]">
                        {cat.level_hierarchy}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          cat.gender === "femenino"
                            ? "bg-pink-100 text-pink-700"
                            : cat.gender === "masculino"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {cat.gender}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {cat.anio_desde || cat.anio_hasta ? (
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {cat.anio_desde ?? "—"} a {cat.anio_hasta ?? "—"}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Sin límite (Libre)</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(cat)}
                        title={cat.is_active ? "Click para desactivar categoría" : "Click para habilitar categoría"}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition shadow-sm ${
                          cat.is_active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        {cat.is_active ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Habilitada
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-500" /> Deshabilitada
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(cat)}
                          title="Editar parámetros"
                          className="p-1.5 text-slate-500 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat)}
                          title="Eliminar de forma permanente"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ModalCategoria
        isOpen={isModalOpen}
        categoriaAEditar={editingCategory}
        onGuardar={handleSave}
        onCerrar={() => setIsModalOpen(false)}
      />
    </div>
  );
}
