"use client";

import { useState } from "react";
import {
  ArrowRightLeft,
  Save,
  Loader2,
  Calendar,
  Users,
  ShieldCheck,
  Clock,
} from "lucide-react";
import type { LeagueTransfersConfig } from "@/lib/core/rules/configuracionRules";

interface TabPasesProps {
  initialTransfers: LeagueTransfersConfig;
  onSaveTransfers: (data: LeagueTransfersConfig) => Promise<boolean>;
  setDirtySection: (section: "transfers", isDirty: boolean) => void;
}

export function TabPases({
  initialTransfers,
  onSaveTransfers,
  setDirtySection,
}: TabPasesProps) {
  const [transfers, setTransfers] = useState<LeagueTransfersConfig>(initialTransfers);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleChange = <K extends keyof LeagueTransfersConfig>(
    field: K,
    value: LeagueTransfersConfig[K]
  ) => {
    setTransfers((prev) => {
      const updated = { ...prev, [field]: value };
      setDirtySection("transfers", true);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    const success = await onSaveTransfers(transfers);
    setIsSaving(false);

    if (success) {
      setDirtySection("transfers", false);
      setStatusMsg({
        text: "Configuración de pases y transferencias guardada exitosamente.",
        type: "success",
      });
    } else {
      setStatusMsg({
        text: "Error al guardar la configuración de pases.",
        type: "error",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-fade-in ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <span>{statusMsg.text}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-xs hover:underline font-bold">
            Entendido
          </button>
        </div>
      )}

      {/* 1. Estado de la Ventana de Fichajes */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ArrowRightLeft className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Ventana de Fichajes y Libro de Pases</h3>
              <p className="text-xs text-slate-400">Control de apertura, cierre de inscripciones y cupos por lista.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Libro de Pases
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Estado del Libro de Pases</label>
            <select
              value={transfers.window_status}
              onChange={(e) => handleChange("window_status", e.target.value as "abierto" | "en_pausa" | "cerrado")}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            >
              <option value="abierto">🟢 Libro Abierto (Pases Habilitados)</option>
              <option value="en_pausa">🟡 En Pausa (Revisión de Comisión)</option>
              <option value="cerrado">🔴 Libro Cerrado (Sin Nuevos Pases)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha de Apertura
            </label>
            <input
              type="date"
              required
              value={transfers.window_start_date}
              onChange={(e) => handleChange("window_start_date", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Fecha Límite de Cierre
            </label>
            <input
              type="date"
              required
              value={transfers.window_end_date}
              onChange={(e) => handleChange("window_end_date", e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" /> Cupo Máximo por Plantel / Lista
            </label>
            <input
              type="number"
              min={10}
              max={50}
              required
              value={transfers.max_players_per_roster}
              onChange={(e) => handleChange("max_players_per_roster", parseInt(e.target.value, 10) || 25)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Jugadores habilitados en lista de buena fe</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Años de Tenencia Federativa</label>
            <input
              type="number"
              min={0}
              max={5}
              required
              value={transfers.tenencia_anios}
              onChange={(e) => handleChange("tenencia_anios", parseInt(e.target.value, 10) || 2)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Período antes de ser jugador libre</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Multiplicador Rescisión Anticipada</label>
            <input
              type="number"
              min={1}
              step={0.1}
              required
              value={transfers.recargo_rescision}
              onChange={(e) => handleChange("recargo_rescision", parseFloat(e.target.value) || 1.5)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Recargo económico si rescinde antes del plazo</span>
          </div>
        </div>
      </div>

      {/* 2. Reglas del Circuito y Plazos de Alerta */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="font-serif text-base font-bold text-[#1A2A44]">Tiempos de Alerta y Automatización</h3>
            <p className="text-xs text-slate-400">Plazos en horas para pases trabados y firma digital.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Alerta de Pase Trabado (Horas)</label>
            <input
              type="number"
              min={1}
              max={720}
              required
              value={transfers.alerta_trabado_horas}
              onChange={(e) => handleChange("alerta_trabado_horas", parseInt(e.target.value, 10) || 48)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Notificación al Tribunal tras este período sin respuesta</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Cancelación Automática por Inactividad (Horas)</label>
            <input
              type="number"
              min={1}
              max={720}
              required
              value={transfers.cancelacion_trabado_horas}
              onChange={(e) => handleChange("cancelacion_trabado_horas", parseInt(e.target.value, 10) || 120)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Caducidad del trámite si no hay avances de los clubes</span>
          </div>
        </div>

        <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition mt-2">
          <input
            type="checkbox"
            checked={transfers.require_player_signature}
            onChange={(e) => handleChange("require_player_signature", e.target.checked)}
            className="w-4 h-4 text-[#F97316] rounded border-slate-300 focus:ring-[#F97316]"
          />
          <div>
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Firma Digital Obligatoria del Jugador
            </span>
            <span className="text-[10px] text-slate-400 block">
              Exige que el jugador valide mediante token / OTP el consentimiento expreso de su transferencia interclubes.
            </span>
          </div>
        </label>
      </div>
    </form>
  );
}
