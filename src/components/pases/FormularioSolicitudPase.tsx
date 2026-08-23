"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Loader2, AlertCircle, Search, UserCheck } from "lucide-react";
import { buscarJugadorParaPase, iniciarPase } from "@/lib/actions/pases.actions";

interface JugadorEncontrado {
  player_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  club_actual: string | null;
  club_actual_id: string | null;
}

/** El club pide un pase: busca al jugador por DNI y confirma la solicitud. */
export function FormularioSolicitudPase({ ventanaAbierta }: { ventanaAbierta: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [dni, setDni] = useState("");
  const [jugador, setJugador] = useState<JugadorEncontrado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";

  function reset() {
    setJugador(null);
    setDni("");
    setError(null);
  }

  if (!ventanaAbierta) {
    return (
      <p className="text-xs font-semibold text-slate-400 border border-slate-200 rounded-xl px-4 py-2.5 bg-slate-50">
        🔒 El mercado de pases está cerrado. Cuando la liga abra una ventana vas a poder pedir
        pases desde acá.
      </p>
    );
  }

  if (!abierto) {
    return (
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onClick={() => {
            setAbierto(true);
            setOk(false);
          }}
          className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5"
        >
          <PlusCircle className="w-4 h-4" /> Solicitar pase
        </button>
        {ok && (
          <p className="text-xs font-semibold text-green-700">
            ✅ Solicitud enviada. Ahora la revisa la liga.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex gap-2">
        <input
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          placeholder="DNI del jugador (sin puntos)"
          inputMode="numeric"
          className={`${CLASE_INPUT} flex-1`}
        />
        <button
          type="button"
          disabled={pendiente || dni.length < 6}
          onClick={() => {
            setError(null);
            setJugador(null);
            startTransition(async () => {
              const res = await buscarJugadorParaPase(dni);
              if (res.error) setError(res.error);
              else if (res.jugador) setJugador(res.jugador);
            });
          }}
          className="px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            reset();
          }}
          className="px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:border-slate-400 transition"
        >
          Cancelar
        </button>
      </div>

      {jugador && (
        <div className="bg-white border border-orange-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <UserCheck className="w-5 h-5 text-[#F97316] shrink-0" />
          <div className="flex-1 min-w-[180px]">
            <p className="font-bold text-sm text-[#1A2A44]">
              {jugador.apellido}, {jugador.nombre}
            </p>
            <p className="text-[11px] text-slate-500">
              DNI {jugador.dni} · Club actual:{" "}
              <span className="font-bold">{jugador.club_actual ?? "Libre"}</span>
            </p>
          </div>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (
                !window.confirm(
                  `¿Pedir el pase de ${jugador.apellido}, ${jugador.nombre} desde ${jugador.club_actual ?? "—"} hacia tu club?`
                )
              )
                return;
              setError(null);
              startTransition(async () => {
                const res = await iniciarPase(jugador.dni);
                if (res.error) setError(res.error);
                else {
                  setOk(true);
                  setAbierto(false);
                  reset();
                }
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar solicitud
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
