"use client";

import { useState, useTransition } from "react";
import { UserMinus, Loader2, AlertCircle } from "lucide-react";
import { bajaJugador } from "@/lib/actions/pases.actions";

/** El club da de baja a un jugador de su plantel (queda libre, con registro). */
export function FormularioBajaJugador({
  jugadores,
}: {
  jugadores: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";
  const CLASE_LABEL = "flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]";

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            setOk(false);
          }}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:border-red-300 hover:text-red-600 transition flex items-center gap-1.5"
        >
          <UserMinus className="w-4 h-4" /> Dar de baja un jugador
        </button>
        {ok && (
          <p className="text-xs font-semibold text-green-700">
            ✅ Jugador dado de baja. Quedó libre para otro club.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={(formData) => {
        setError(null);
        setOk(false);
        startTransition(async () => {
          const res = await bajaJugador(
            String(formData.get("player_id") ?? ""),
            String(formData.get("motivo") ?? "")
          );
          if (res.error) setError(res.error);
          else {
            setOk(true);
            setAbierto(false);
          }
        });
      }}
      className="bg-slate-50 border border-slate-200 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      <label className={CLASE_LABEL}>
        Jugador (de tu plantel)
        <select name="player_id" required className={CLASE_INPUT}>
          <option value="">Elegí el jugador…</option>
          {jugadores.map((j) => (
            <option key={j.id} value={j.id}>
              {j.nombre}
            </option>
          ))}
        </select>
      </label>
      <label className={CLASE_LABEL}>
        Motivo (opcional)
        <input name="motivo" placeholder="Ej: dejó de venir a entrenar" className={CLASE_INPUT} />
      </label>

      {error && (
        <p className="sm:col-span-2 text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="px-5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Confirmar baja
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:border-slate-400 transition"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
