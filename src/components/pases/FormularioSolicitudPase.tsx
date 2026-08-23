"use client";

import { useState, useTransition } from "react";
import { PlusCircle, Loader2, AlertCircle, Search, UserCheck } from "lucide-react";
import { buscarJugadorParaPase, iniciarPase } from "@/lib/actions/pases.actions";
import type { TipoPase } from "@/lib/core/rules/pasesRules";

interface JugadorEncontrado {
  player_id: string;
  nombre: string;
  apellido: string;
  dni: string;
  club_actual: string | null;
  club_actual_id: string | null;
}

interface TorneoOpcion {
  id: string;
  name: string;
}

/**
 * El club pide un pase: busca al jugador por DNI, elige el TIPO
 * (definitivo o préstamo con fecha de retorno y torneo) y confirma.
 */
export function FormularioSolicitudPase({
  ventanaAbierta,
  torneos = [],
}: {
  ventanaAbierta: boolean;
  torneos?: TorneoOpcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [dni, setDni] = useState("");
  const [jugador, setJugador] = useState<JugadorEncontrado | null>(null);
  const [tipo, setTipo] = useState<TipoPase>("definitivo");
  const [fechaRetorno, setFechaRetorno] = useState("");
  const [torneoId, setTorneoId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";

  function reset() {
    setJugador(null);
    setDni("");
    setTipo("definitivo");
    setFechaRetorno("");
    setTorneoId("");
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
        <div className="bg-white border border-orange-200 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
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
          </div>

          {/* Tipo de pase */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
              Tipo de pase
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer select-none transition ${
                  tipo === "definitivo"
                    ? "border-green-500 bg-green-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tipo_pase"
                    checked={tipo === "definitivo"}
                    onChange={() => setTipo("definitivo")}
                    className="accent-green-600"
                  />
                  <span className="text-xs font-black text-green-800">🟢 Definitivo</span>
                </span>
                <span className="text-[10px] text-slate-500 pl-6">
                  El jugador pasa a tu club para siempre.
                </span>
              </label>
              <label
                className={`flex flex-col gap-0.5 p-3 rounded-xl border-2 cursor-pointer select-none transition ${
                  tipo === "prestamo"
                    ? "border-amber-500 bg-amber-50"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tipo_pase"
                    checked={tipo === "prestamo"}
                    onChange={() => setTipo("prestamo")}
                    className="accent-amber-500"
                  />
                  <span className="text-xs font-black text-amber-800">🟡 Préstamo</span>
                </span>
                <span className="text-[10px] text-slate-500 pl-6">
                  Vuelve solo al club de origen en la fecha de retorno.
                </span>
              </label>
            </div>
          </div>

          {/* Datos del préstamo */}
          {tipo === "prestamo" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50/60 border border-amber-200 rounded-xl p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-amber-900">
                  Fecha de retorno (obligatoria)
                </label>
                <input
                  type="date"
                  value={fechaRetorno}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={(e) => setFechaRetorno(e.target.value)}
                  className={CLASE_INPUT}
                />
                <p className="text-[10px] text-amber-700">
                  Ese día el jugador vuelve SOLO a su club de origen.
                </p>
              </div>
              {torneos.length > 0 && (
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-amber-900">
                    Torneo del préstamo (opcional)
                  </label>
                  <select
                    value={torneoId}
                    onChange={(e) => setTorneoId(e.target.value)}
                    className={CLASE_INPUT}
                  >
                    <option value="">Préstamo general</option>
                    {torneos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-amber-700">
                    Si es por torneo, la liga puede tener un derecho de pase especial.
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={pendiente || (tipo === "prestamo" && !fechaRetorno)}
            onClick={() => {
              const textoTipo =
                tipo === "prestamo"
                  ? `PRÉSTAMO hasta el ${new Date(`${fechaRetorno}T00:00:00`).toLocaleDateString("es-AR")}`
                  : "PASE DEFINITIVO";
              if (
                !window.confirm(
                  `¿Pedir el ${textoTipo} de ${jugador.apellido}, ${jugador.nombre} desde ${jugador.club_actual ?? "—"} hacia tu club?`
                )
              )
                return;
              setError(null);
              startTransition(async () => {
                const res = await iniciarPase(
                  jugador.dni,
                  undefined,
                  tipo,
                  tipo === "prestamo" ? fechaRetorno : undefined,
                  tipo === "prestamo" && torneoId ? torneoId : undefined
                );
                if (res.error) setError(res.error);
                else {
                  setOk(true);
                  setAbierto(false);
                  reset();
                }
              });
            }}
            className="px-4 py-2.5 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
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
