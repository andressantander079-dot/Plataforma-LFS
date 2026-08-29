"use client";

import { useState } from "react";
import {
  MapPin,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";
import type { VenueItem } from "@/lib/core/rules/configuracionRules";
import { ModalCancha } from "./ModalCancha";

interface TabCanchasProps {
  venues: VenueItem[];
  onCreateVenue: (data: unknown) => Promise<{ success: boolean; error?: string }>;
  onUpdateVenue: (id: string, data: unknown) => Promise<{ success: boolean; error?: string }>;
  onToggleStatus: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  onDeleteVenue: (id: string) => Promise<{ success: boolean; error?: string }>;
}

export function TabCanchas({
  venues,
  onCreateVenue,
  onUpdateVenue,
  onToggleStatus,
  onDeleteVenue,
}: TabCanchasProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<VenueItem | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const surfaceLabels: Record<string, string> = {
    parquet: "Parquet Flotante",
    sintetico: "Piso Sintético",
    cemento: "Cemento Pulido",
    baldosa: "Mosaico / Baldosa",
  };

  const filteredVenues = venues.filter((v) =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.address && v.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenCreate = () => {
    setEditingVenue(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (v: VenueItem) => {
    setEditingVenue(v);
    setIsModalOpen(true);
  };

  const handleSave = async (data: unknown) => {
    let res: { success: boolean; error?: string };
    if (editingVenue) {
      res = await onUpdateVenue(editingVenue.id, data);
    } else {
      res = await onCreateVenue(data);
    }

    if (res.success) {
      setFeedbackMsg({
        text: editingVenue ? "Escenario actualizado exitosamente." : "Escenario registrado correctamente.",
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al procesar escenario.", type: "error" });
    }
    return res;
  };

  const handleToggle = async (v: VenueItem) => {
    const newStatus = !v.is_active;
    const res = await onToggleStatus(v.id, newStatus);
    if (res.success) {
      setFeedbackMsg({
        text: `Escenario "${v.name}" ${newStatus ? "habilitado" : "deshabilitado"}.`,
        type: "success",
      });
    } else {
      setFeedbackMsg({ text: res.error || "Error al cambiar estado.", type: "error" });
    }
  };

  const handleDelete = async (v: VenueItem) => {
    const confirm = window.confirm(`¿Deseás eliminar el escenario "${v.name}"?`);
    if (!confirm) return;

    const res = await onDeleteVenue(v.id);
    if (res.success) {
      setFeedbackMsg({ text: `Escenario "${v.name}" eliminado.`, type: "success" });
    } else {
      setFeedbackMsg({ text: res.error || "No se pudo eliminar el escenario.", type: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-base font-bold">Sedes y Escenarios Deportivos</h3>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed max-w-2xl">
              Gimnasios y polideportivos habilitados para la programación de fixtures y designación de árbitros (Hugo Ítalo Favale, Augusto Lasserre, Petrina, etc.).
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" /> Nuevo Escenario
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

      {/* Búsqueda */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por nombre o dirección..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
          />
        </div>
      </div>

      {/* Listado de Canchas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">Escenario Deportivo</th>
                <th className="px-4 py-3.5">Ubicación / Dirección</th>
                <th className="px-4 py-3.5">Superficie</th>
                <th className="px-4 py-3.5">Capacidad</th>
                <th className="px-4 py-3.5 text-center">Estado</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-[#1A2A44]">
              {filteredVenues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No hay escenarios registrados con ese criterio.
                  </td>
                </tr>
              ) : (
                filteredVenues.map((v) => (
                  <tr
                    key={v.id}
                    className={`hover:bg-slate-50/70 transition ${
                      !v.is_active ? "opacity-60 bg-slate-50/30" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5 font-bold">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{v.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{v.address || "Sin dirección especificada"}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px] border border-slate-200">
                        {surfaceLabels[v.surface || "parquet"] || v.surface}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-600 font-bold text-[11px]">
                        <Users className="w-3.5 h-3.5 text-slate-400" /> {v.capacity || 500} pers.
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggle(v)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition shadow-sm ${
                          v.is_active
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                        }`}
                      >
                        {v.is_active ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Habilitado
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-slate-500" /> Inactivo
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(v)}
                          title="Editar escenario"
                          className="p-1.5 text-slate-500 hover:text-[#F97316] hover:bg-orange-50 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(v)}
                          title="Eliminar escenario"
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

      <ModalCancha
        isOpen={isModalOpen}
        canchaAEditar={editingVenue}
        onGuardar={handleSave}
        onCerrar={() => setIsModalOpen(false)}
      />
    </div>
  );
}
