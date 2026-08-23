"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { guardarPaseSettings } from "@/lib/actions/pases.actions";

export interface PaseSettingsUI {
  tenencia_anios: number;
  recargo_rescision: number;
  alerta_trabado_horas: number;
  cancelacion_trabado_horas: number;
  aviso_retorno_horas: number;
}

/**
 * Configuración general del mercado de pases (solo la liga):
 * tenencia, recargo por rescisión y los tiempos de los trámites automáticos.
 */
export function ConfigPasesForm({ settings }: { settings: PaseSettingsUI }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 w-full";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await guardarPaseSettings(formData);
          if (res.error) setError(res.error);
          else setOk(true);
        });
      }}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div>
        <h3 className="font-black text-sm text-[#1A2A44]">⚙️ Reglas del mercado</h3>
        <p className="text-[11px] text-slate-500">
          Estos valores aplican a todos los pases de la liga.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Tenencia mínima (años)
          </label>
          <input
            type="number"
            name="tenencia_anios"
            min={0}
            max={5}
            step={1}
            defaultValue={settings.tenencia_anios}
            className={CLASE_INPUT}
          />
          <p className="text-[10px] text-slate-400">
            Años que un jugador debe permanecer en su club antes de poder darse de baja (se cuenta
            desde el 1° de enero del año del alta). 0 = sin tenencia.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Recargo por rescisión de préstamo ($)
          </label>
          <input
            type="number"
            name="recargo_rescision"
            min={0}
            step={100}
            defaultValue={settings.recargo_rescision}
            className={CLASE_INPUT}
          />
          <p className="text-[10px] text-slate-400">
            Lo que paga el club destino si termina un préstamo antes de la fecha de retorno. 0 = sin
            recargo.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Alerta de pase trabado (horas)
          </label>
          <input
            type="number"
            name="alerta_trabado_horas"
            min={1}
            max={720}
            step={1}
            defaultValue={settings.alerta_trabado_horas}
            className={CLASE_INPUT}
          />
          <p className="text-[10px] text-slate-400">
            Si un pase espera la decisión del club de origen más de estas horas, se marca como
            &quot;trabado&quot; para que la liga intervenga.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">
            Cancelación automática (horas)
          </label>
          <input
            type="number"
            name="cancelacion_trabado_horas"
            min={1}
            max={720}
            step={1}
            defaultValue={settings.cancelacion_trabado_horas}
            className={CLASE_INPUT}
          />
          <p className="text-[10px] text-slate-400">
            Pasado este tiempo sin respuesta del club de origen, el pase se cancela solo y el
            jugador queda disponible. Debe ser mayor que la alerta.
          </p>
        </div>

        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-[11px] font-bold text-slate-600">
            Aviso de retorno de préstamo (horas antes)
          </label>
          <input
            type="number"
            name="aviso_retorno_horas"
            min={1}
            max={720}
            step={1}
            defaultValue={settings.aviso_retorno_horas}
            className={CLASE_INPUT}
          />
          <p className="text-[10px] text-slate-400">
            Cuántas horas antes del vencimiento se avisa al club que el préstamo está por terminar
            (por defecto 72 = 3 días).
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && <p className="text-xs font-semibold text-green-700">✅ Configuración guardada.</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start px-5 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
      >
        {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar configuración
      </button>
    </form>
  );
}
