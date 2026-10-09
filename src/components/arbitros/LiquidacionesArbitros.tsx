"use client";

import { useState, useTransition } from "react";
import { Banknote, CircleAlert, Loader2, ReceiptText } from "lucide-react";
import {
  generarLiquidacion,
  obtenerLiquidaciones,
  type LiquidacionUI,
} from "@/lib/actions/arbitros.actions";
import { nombrePeriodo, periodoActual } from "@/lib/core/rules/arbitrosRules";

/**
 * LIQUIDACIONES DE HONORARIOS (admin) — por mes: partidos confirmados ×
 * tarifa (nivel o personalizada). Se puede solo guardar la liquidación o
 * registrarla EN TESORERÍA como gasto (categoría "arbitros") y paga.
 */
export function LiquidacionesArbitros({
  periodoInicial,
  filasIniciales,
}: {
  periodoInicial: string;
  filasIniciales: LiquidacionUI[];
}) {
  const [periodo, setPeriodo] = useState(periodoInicial || periodoActual());
  const [filas, setFilas] = useState<LiquidacionUI[]>(filasIniciales);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const cargarMes = (nuevo: string) => {
    setPeriodo(nuevo);
    setAviso(null);
    startTransition(async () => {
      const res = await obtenerLiquidaciones(nuevo);
      setFilas(res.filas);
    });
  };

  const liquidar = (fila: LiquidacionUI, enTesoreria: boolean) => {
    setAviso(null);
    const texto = enTesoreria
      ? `¿Registrar el PAGO de ${fila.nombre} ($${fila.monto.toLocaleString("es-AR")}) en tesorería como gasto? Queda vinculado y marcado como pagado.`
      : `¿Guardar la liquidación de ${fila.nombre} ($${fila.monto.toLocaleString("es-AR")}) como pendiente?`;
    if (!window.confirm(texto)) return;
    startTransition(async () => {
      const res = await generarLiquidacion(fila.referee_id, periodo, enTesoreria);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({
          tipo: "ok",
          texto: enTesoreria ? "Liquidación registrada y paga en tesorería." : "Liquidación guardada como pendiente.",
        });
        const actualizado = await obtenerLiquidaciones(periodo);
        setFilas(actualizado.filas);
      }
    });
  };

  const fmtPesos = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

  const totalMes = filas.reduce((acc, f) => acc + f.monto, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Mes a liquidar
        </label>
        <input
          type="month"
          value={periodo}
          onChange={(e) => e.target.value && cargarMes(e.target.value)}
          className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#F97316]/60"
        />
        <span className="text-xs font-bold text-[#1A2A44] capitalize">{nombrePeriodo(periodo)}</span>
        {pendiente && <Loader2 className="w-4 h-4 animate-spin text-[#F97316]" />}
        <span className="ml-auto text-xs font-black text-[#F97316]">
          Total del mes: {fmtPesos(totalMes)}
        </span>
      </div>

      {aviso && (
        <p
          className={`text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 ${
            aviso.tipo === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <CircleAlert className="w-4 h-4 shrink-0" /> {aviso.texto}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">Árbitro</th>
              <th className="px-4 py-3 text-center">Partidos</th>
              <th className="px-4 py-3 text-right">Tarifa</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.referee_id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-bold text-xs text-[#1A2A44]">{f.nombre}</p>
                  <p className="text-[10px] text-slate-400">{f.nivelNombre ?? "Sin nivel"}</p>
                </td>
                <td className="px-4 py-3 text-center font-black text-xs">{f.partidos}</td>
                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-500">
                  {fmtPesos(f.tarifa)}
                </td>
                <td className="px-4 py-3 text-right font-black text-xs text-[#1A2A44]">
                  {fmtPesos(f.monto)}
                </td>
                <td className="px-4 py-3 text-center">
                  {f.status === "pagado" ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Pagado
                    </span>
                  ) : f.status === "pendiente" ? (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Pendiente
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                      Sin liquidar
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {!f.yaEnTesoreria && f.monto > 0 ? (
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => liquidar(f, false)}
                        disabled={pendiente}
                        title="Guardar como pendiente"
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 transition flex items-center gap-1"
                      >
                        <ReceiptText className="w-3 h-3" /> Pendiente
                      </button>
                      <button
                        onClick={() => liquidar(f, true)}
                        disabled={pendiente}
                        title="Registrar el gasto en tesorería y marcar como pagado"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <Banknote className="w-3 h-3" /> Pagar en tesorería
                      </button>
                    </div>
                  ) : f.yaEnTesoreria ? (
                    <span className="text-[10px] font-bold text-emerald-600">✓ En tesorería</span>
                  ) : (
                    <span className="text-[10px] text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                  Ningún árbitro dirigió partidos confirmados en {nombrePeriodo(periodo)}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400 px-1">
        Cuentan los partidos <strong>jugados o WO con resultado confirmado</strong> del mes.
        "Pagar en tesorería" crea el gasto (categoría <em>árbitros</em>) y le avisa al árbitro por mensajería.
      </p>
    </div>
  );
}
