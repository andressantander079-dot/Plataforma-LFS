"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Archive } from "lucide-react";
import { cargarPaseHistorico } from "@/lib/actions/pases.actions";

interface ClubOpcion {
  id: string;
  name: string;
}

/**
 * Carga de pases HISTÓRICOS en papel (solo la liga): quedan registrados en el
 * historial del jugador sin moverlo de club ni cobrar nada. Solo del año anterior.
 */
export function FormularioPaseHistorico({ clubes }: { clubes: ClubOpcion[] }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const [tipo, setTipo] = useState<"definitivo" | "prestamo">("definitivo");

  const anioAnterior = new Date().getFullYear() - 1;
  const fechaMin = `${anioAnterior}-01-01`;
  const fechaMax = `${anioAnterior}-12-31`;

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 w-full";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(null);
        const formData = new FormData(e.currentTarget);
        if (
          !window.confirm(
            "¿Registrar este pase histórico? Solo queda en el historial del jugador: NO lo mueve de club ni genera cobros."
          )
        )
          return;
        startTransition(async () => {
          const res = await cargarPaseHistorico(formData);
          if (res.error) setError(res.error);
          else {
            setOk(res.jugador ?? null);
            (e.target as HTMLFormElement).reset();
            setTipo("definitivo");
          }
        });
      }}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div>
        <h3 className="font-black text-sm text-[#1A2A44] flex items-center gap-2">
          <Archive className="w-4 h-4 text-slate-400" /> Cargar pase histórico en papel ({anioAnterior})
        </h3>
        <p className="text-[11px] text-slate-500">
          Solo para registrar pases hechos en papel durante {anioAnterior}. Queda en el historial
          del jugador: <b>no lo mueve de club ni genera cobros</b>.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">DNI del jugador</label>
          <input
            name="dni"
            required
            inputMode="numeric"
            placeholder="Sin puntos"
            className={CLASE_INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">Fecha del pase</label>
          <input
            type="date"
            name="fecha"
            required
            min={fechaMin}
            max={fechaMax}
            className={CLASE_INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">Club de origen</label>
          <select name="from_club_id" required className={CLASE_INPUT}>
            <option value="">Elegí…</option>
            {clubes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">Club de destino</label>
          <select name="to_club_id" required className={CLASE_INPUT}>
            <option value="">Elegí…</option>
            {clubes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-bold text-slate-600">Tipo</label>
          <select
            name="tipo_pase"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as "definitivo" | "prestamo")}
            className={CLASE_INPUT}
          >
            <option value="definitivo">🟢 Definitivo</option>
            <option value="prestamo">🟡 Préstamo</option>
          </select>
        </div>
        {tipo === "prestamo" && (
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">Fecha de retorno</label>
            <input type="date" name="fecha_retorno" required className={CLASE_INPUT} />
          </div>
        )}
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-[11px] font-bold text-slate-600">
            N° o referencia del papel (opcional)
          </label>
          <input
            name="nro_papel"
            placeholder="Ej.: Ficha N° 125, carpeta 3"
            maxLength={100}
            className={CLASE_INPUT}
          />
        </div>
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && (
        <p className="text-xs font-semibold text-green-700">
          ✅ Pase histórico registrado en el historial de {ok}.
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start px-5 py-2.5 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition disabled:opacity-50 flex items-center gap-1.5"
      >
        {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
        Registrar histórico
      </button>
    </form>
  );
}
