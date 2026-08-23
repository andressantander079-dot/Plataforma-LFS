"use client";

import { useState, useTransition } from "react";
import { Save, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { guardarConfiguracionTesoreria } from "@/lib/actions/tesoreria.actions";

export interface SettingsUI {
  fine_red: number;
  fine_wo: number;
  fine_yellow_accum: number;
  late_fee_percent: number;
  transfer_fee: number;
  league_legal_name: string | null;
  league_cuit: string | null;
  league_address: string | null;
}

const CLASE_INPUT =
  "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 disabled:bg-slate-100 disabled:text-slate-400";
const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

/** Configuración de tesorería: montos de multas, mora y datos fiscales. */
export function FormularioConfiguracion({
  settings,
  soloLectura,
}: {
  settings: SettingsUI;
  soloLectura: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await guardarConfiguracionTesoreria(formData);
          if (res.error) setError(res.error);
          else setOk(true);
        });
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">
          Multas automáticas ($) — 0 = no multa
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className={CLASE_LABEL}>
            Tarjeta roja
            <input
              name="fine_red"
              type="number"
              min={0}
              step="0.01"
              defaultValue={settings.fine_red}
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
          <label className={CLASE_LABEL}>
            W.O. (no se presenta)
            <input
              name="fine_wo"
              type="number"
              min={0}
              step="0.01"
              defaultValue={settings.fine_wo}
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
          <label className={CLASE_LABEL}>
            Acumulación de amarillas
            <input
              name="fine_yellow_accum"
              type="number"
              min={0}
              step="0.01"
              defaultValue={settings.fine_yellow_accum}
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">
          Derecho de pase ($) — 0 = no cobra
        </legend>
        <label className={`${CLASE_LABEL} max-w-xs`}>
          Monto por pase efectivo
          <input
            name="transfer_fee"
            type="number"
            min={0}
            step="0.01"
            defaultValue={settings.transfer_fee}
            disabled={soloLectura}
            className={CLASE_INPUT}
          />
        </label>
        <p className="text-[10px] text-slate-400 mt-2">
          Cuando un pase queda efectivo, se genera solo el cargo al club destino (módulo Trámites).
        </p>
      </fieldset>

      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">Mora</legend>
        <label className={`${CLASE_LABEL} max-w-xs`}>
          Recargo por vencimiento (%)
          <input
            name="late_fee_percent"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={settings.late_fee_percent}
            disabled={soloLectura}
            className={CLASE_INPUT}
          />
        </label>
        <p className="text-[10px] text-slate-400 mt-2">
          Se aplica sobre el monto del cargo una vez pasada la fecha de vencimiento.
        </p>
      </fieldset>

      <fieldset className="border border-slate-200 rounded-xl p-4">
        <legend className="text-xs font-bold text-[#1A2A44] px-1">
          Datos fiscales de la liga (salen en los recibos)
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className={CLASE_LABEL}>
            Nombre legal
            <input
              name="league_legal_name"
              defaultValue={settings.league_legal_name ?? ""}
              placeholder="Liga de Fútsal de Ushuaia"
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
          <label className={CLASE_LABEL}>
            CUIT
            <input
              name="league_cuit"
              defaultValue={settings.league_cuit ?? ""}
              placeholder="30-XXXXXXXX-X"
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
          <label className={CLASE_LABEL}>
            Domicilio
            <input
              name="league_address"
              defaultValue={settings.league_address ?? ""}
              placeholder="Ushuaia, Tierra del Fuego"
              disabled={soloLectura}
              className={CLASE_INPUT}
            />
          </label>
        </div>
      </fieldset>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && (
        <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4" /> Configuración guardada.
        </p>
      )}

      {!soloLectura && (
        <button
          type="submit"
          disabled={pendiente}
          className="self-start px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 shadow-md flex items-center gap-2"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuración
        </button>
      )}
      {soloLectura && (
        <p className="text-[11px] text-slate-400">
          Solo el administrador puede modificar estos valores.
        </p>
      )}
    </form>
  );
}
