"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Save, Plus, Trash2 } from "lucide-react";
import {
  guardarRangosCategorias,
  guardarFeePase,
  eliminarFeePase,
} from "@/lib/actions/pases.actions";

export interface CategoriaRangoUI {
  id: string;
  name: string;
  level_hierarchy: number;
  anio_desde: number | null;
  anio_hasta: number | null;
}

export interface FeePaseUI {
  id: string;
  category_id: string;
  competition_id: string | null;
  tipo: string;
  monto: number;
  categoria: string;
  torneo: string | null;
}

const CLASE_INPUT =
  "rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";

/**
 * Tabla editable de rangos de año de nacimiento por categoría.
 * La liga la ajusta una vez por año y las inscripciones se validan solas.
 */
export function RangosCategoriasForm({ categorias }: { categorias: CategoriaRangoUI[] }) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const anioActual = new Date().getFullYear();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const rangos = categorias.map((c) => {
          const desde = String(fd.get(`desde-${c.id}`) ?? "").trim();
          const hasta = String(fd.get(`hasta-${c.id}`) ?? "").trim();
          return {
            id: c.id,
            anio_desde: desde ? Number(desde) : null,
            anio_hasta: hasta ? Number(hasta) : null,
          };
        });
        startTransition(async () => {
          const res = await guardarRangosCategorias(rangos);
          if (res.error) setError(res.error);
          else setOk(true);
        });
      }}
      className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4"
    >
      <div>
        <h3 className="font-black text-sm text-[#1A2A44]">📅 Años de nacimiento por categoría</h3>
        <p className="text-[11px] text-slate-500">
          Definen en qué categoría juega cada jugador según su año de nacimiento. Actualizalos a
          comienzo de cada temporada. Dejá vacío si la categoría no tiene límite de edad.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
              <th className="py-2 pr-3">Categoría</th>
              <th className="py-2 pr-3">Nacidos desde</th>
              <th className="py-2 pr-3">Nacidos hasta</th>
              <th className="py-2">Ejemplo</th>
            </tr>
          </thead>
          <tbody>
            {categorias.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 pr-3 font-bold text-[#1A2A44]">{c.name}</td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    name={`desde-${c.id}`}
                    min={1950}
                    max={anioActual}
                    defaultValue={c.anio_desde ?? ""}
                    placeholder="ej. 2009"
                    className={`${CLASE_INPUT} w-28 py-1.5`}
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    type="number"
                    name={`hasta-${c.id}`}
                    min={1950}
                    max={anioActual}
                    defaultValue={c.anio_hasta ?? ""}
                    placeholder="ej. 2010"
                    className={`${CLASE_INPUT} w-28 py-1.5`}
                  />
                </td>
                <td className="py-2 text-slate-400">
                  {c.anio_desde && c.anio_hasta
                    ? `nacidos ${c.anio_desde}–${c.anio_hasta}`
                    : "sin límite"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && <p className="text-xs font-semibold text-green-700">✅ Rangos guardados.</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="self-start px-5 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
      >
        {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar rangos
      </button>
    </form>
  );
}

/**
 * Derecho de pase que cobra la FEDERACIÓN por cada transferencia:
 * un monto por categoría y tipo de pase (y opcionalmente por torneo en préstamos).
 */
export function FeesPasesForm({
  fees,
  categorias,
  torneos,
}: {
  fees: FeePaseUI[];
  categorias: CategoriaRangoUI[];
  torneos: { id: string; name: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const fmt = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-4">
      <div>
        <h3 className="font-black text-sm text-[#1A2A44]">💰 Derecho de pase (lo cobra la liga)</h3>
        <p className="text-[11px] text-slate-500">
          Monto que paga el club destino a la federación al completar un pase, según la categoría
          base del jugador y el tipo de pase. En préstamos podés definir un valor especial por
          torneo (si no, se usa el general de la categoría).
        </p>
      </div>

      {fees.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-200">
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Torneo</th>
                <th className="py-2 pr-3 text-right">Monto</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-bold text-[#1A2A44]">{f.categoria}</td>
                  <td className="py-2 pr-3">
                    {f.tipo === "prestamo" ? "🟡 Préstamo" : "🟢 Definitivo"}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{f.torneo ?? "Todos (general)"}</td>
                  <td className="py-2 pr-3 text-right font-black">{fmt.format(f.monto)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() => {
                        if (!window.confirm("¿Eliminar este derecho de pase?")) return;
                        setError(null);
                        startTransition(async () => {
                          const res = await eliminarFeePase(f.id);
                          if (res.error) setError(res.error);
                        });
                      }}
                      className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {fees.length === 0 && (
        <p className="text-xs text-slate-400 italic">
          Todavía no hay derechos de pase configurados. Agregá el primero abajo.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setOk(false);
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await guardarFeePase(formData);
            if (res.error) setError(res.error);
            else {
              setOk(true);
              (e.target as HTMLFormElement).reset();
            }
          });
        }}
        className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-2 items-end"
      >
        <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
          <label className="text-[10px] font-bold text-slate-500">Categoría</label>
          <select name="category_id" required className={CLASE_INPUT}>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500">Tipo</label>
          <select name="tipo" required className={CLASE_INPUT}>
            <option value="definitivo">🟢 Definitivo</option>
            <option value="prestamo">🟡 Préstamo</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500">Torneo (opcional)</label>
          <select name="competition_id" className={CLASE_INPUT}>
            <option value="">Todos (general)</option>
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold text-slate-500">Monto ($)</label>
          <input
            type="number"
            name="monto"
            min={0}
            step={100}
            required
            placeholder="0"
            className={CLASE_INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={pendiente}
          className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Agregar
        </button>
      </form>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
      {ok && <p className="text-xs font-semibold text-green-700">✅ Derecho de pase guardado.</p>}
    </div>
  );
}
