"use client";

import { useState } from "react";
import {
  Scale,
  Save,
  Loader2,
  AlertTriangle,
  Coins,
  Clock,
  ShieldCheck,
} from "lucide-react";
import type { LeagueDisciplineConfig } from "@/lib/core/rules/configuracionRules";
import { formatMoneda } from "@/lib/core/rules/configuracionRules";

interface TabDisciplinaProps {
  initialDiscipline: LeagueDisciplineConfig;
  onSaveDiscipline: (data: LeagueDisciplineConfig) => Promise<boolean>;
  setDirtySection: (section: "discipline", isDirty: boolean) => void;
}

export function TabDisciplina({
  initialDiscipline,
  onSaveDiscipline,
  setDirtySection,
}: TabDisciplinaProps) {
  const [discipline, setDiscipline] = useState<LeagueDisciplineConfig>(initialDiscipline);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleChange = <K extends keyof LeagueDisciplineConfig>(
    field: K,
    value: LeagueDisciplineConfig[K]
  ) => {
    setDiscipline((prev) => {
      const updated = { ...prev, [field]: value };
      setDirtySection("discipline", true);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);

    const success = await onSaveDiscipline(discipline);
    setIsSaving(false);

    if (success) {
      setDirtySection("discipline", false);
      setStatusMsg({
        text: "Parámetros de juego y disciplina guardados correctamente.",
        type: "success",
      });
    } else {
      setStatusMsg({
        text: "Ocurrió un error al guardar los parámetros de disciplina.",
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

      {/* 1. Sistema de Puntos y Desempate */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Puntuación y Criterios de Tabla</h3>
              <p className="text-xs text-slate-400">Reglas predeterminadas para torneos, tablas y W.O.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar Parámetros
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Puntos por Victoria</label>
            <input
              type="number"
              min={0}
              max={10}
              required
              value={discipline.points_win}
              onChange={(e) => handleChange("points_win", parseInt(e.target.value, 10) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Puntos por Empate</label>
            <input
              type="number"
              min={0}
              max={10}
              required
              value={discipline.points_draw}
              onChange={(e) => handleChange("points_draw", parseInt(e.target.value, 10) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Puntos por Derrota</label>
            <input
              type="number"
              min={0}
              max={10}
              required
              value={discipline.points_loss}
              onChange={(e) => handleChange("points_loss", parseInt(e.target.value, 10) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Criterio Principal de Desempate en Tabla</label>
            <select
              value={discipline.tiebreaker}
              onChange={(e) => handleChange("tiebreaker", e.target.value as "diferencia_gol" | "enfrentamiento_directo" | "goles_favor")}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            >
              <option value="diferencia_gol">1. Diferencia de Gol (DG) → Goles a Favor</option>
              <option value="enfrentamiento_directo">1. Enfrentamiento Directo (Partidos entre sí) → DG</option>
              <option value="goles_favor">1. Mayor cantidad de Goles a Favor (GF)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Resultado Oficial por W.O. (Goles)</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                value={discipline.wo_home_goals}
                onChange={(e) => handleChange("wo_home_goals", parseInt(e.target.value, 10) || 5)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                placeholder="A favor (ej: 5)"
              />
              <input
                type="number"
                min={0}
                value={discipline.wo_away_goals}
                onChange={(e) => handleChange("wo_away_goals", parseInt(e.target.value, 10) || 0)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
                placeholder="En contra (ej: 0)"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tiempos de Juego y Faltas Acumulables */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center gap-2.5">
          <Clock className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="font-serif text-base font-bold text-[#1A2A44]">Tiempos Reglamentarios y Faltas</h3>
            <p className="text-xs text-slate-400">Duración de los encuentros y límites para tiro libre sin barrera.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Duración por Tiempo (Minutos)</label>
            <input
              type="number"
              min={10}
              max={45}
              required
              value={discipline.match_duration_minutes}
              onChange={(e) => handleChange("match_duration_minutes", parseInt(e.target.value, 10) || 20)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">2 tiempos reglamentarios</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Faltas Acumulables por Tiempo</label>
            <input
              type="number"
              min={3}
              max={10}
              required
              value={discipline.accumulated_fouls_limit}
              onChange={(e) => handleChange("accumulated_fouls_limit", parseInt(e.target.value, 10) || 5)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Tiro de castigo a la 6ta falta</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Tiempos Muertos por Equipo/Tiempo</label>
            <input
              type="number"
              min={0}
              max={3}
              required
              value={discipline.timeouts_per_period}
              onChange={(e) => handleChange("timeouts_per_period", parseInt(e.target.value, 10) || 1)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">Minuto solicitado por el DT</span>
          </div>
        </div>
      </div>

      {/* 3. Sanciones y Aranceles Disciplinarios */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Coins className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Sanciones y Aranceles Federativos</h3>
              <p className="text-xs text-slate-400">Límites de tarjetas y montos referenciales de multas y protestas.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Moneda:</span>
            <select
              value={discipline.currency}
              onChange={(e) => handleChange("currency", e.target.value as "ARS" | "USD")}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-[#1A2A44] focus:outline-none"
            >
              <option value="ARS">ARS (Pesos Argentinos)</option>
              <option value="USD">USD (Dólares)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Amarillas p/ Suspensión
            </label>
            <input
              type="number"
              min={1}
              max={10}
              required
              value={discipline.yellow_cards_suspension}
              onChange={(e) => handleChange("yellow_cards_suspension", parseInt(e.target.value, 10) || 5)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-slate-400">1 fecha automática al acumular</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Multa Roja Directa</label>
            <input
              type="number"
              min={0}
              step={100}
              required
              value={discipline.red_card_fine}
              onChange={(e) => handleChange("red_card_fine", parseFloat(e.target.value) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-emerald-700 font-bold">
              {formatMoneda(discipline.red_card_fine, discipline.currency)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Arancel Protesta de Partido</label>
            <input
              type="number"
              min={0}
              step={100}
              required
              value={discipline.match_protest_fee}
              onChange={(e) => handleChange("match_protest_fee", parseFloat(e.target.value) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-emerald-700 font-bold">
              {formatMoneda(discipline.match_protest_fee, discipline.currency)}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700">Arancel Pase Interclubes</label>
            <input
              type="number"
              min={0}
              step={100}
              required
              value={discipline.interclub_transfer_fee}
              onChange={(e) => handleChange("interclub_transfer_fee", parseFloat(e.target.value) || 0)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/50"
            />
            <span className="text-[10px] text-emerald-700 font-bold">
              {formatMoneda(discipline.interclub_transfer_fee, discipline.currency)}
            </span>
          </div>
        </div>
      </div>
    </form>
  );
}
