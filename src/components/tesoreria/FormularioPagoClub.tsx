"use client";

import { useRef, useState, useTransition } from "react";
import { FileUp, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { subirComprobantePago } from "@/lib/actions/tesoreria.actions";
import { formatoPesos } from "@/lib/core/tesoreria/money";

/**
 * El club informa un pago: elige método, monto (parcial permitido) y
 * sube la foto del comprobante. Queda PENDIENTE hasta que la
 * tesorería lo apruebe y emita el recibo.
 */
export function FormularioPagoClub({
  chargeId,
  saldo,
}: {
  chargeId: string;
  saldo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const CLASE_INPUT =
    "rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60";

  if (ok) {
    return (
      <p className="text-[11px] font-bold text-green-700 flex items-center gap-1">
        <CheckCircle className="w-3.5 h-3.5" /> Comprobante enviado — esperando aprobación
      </p>
    );
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#F97316] text-white hover:bg-[#F97316]/90 transition flex items-center gap-1"
      >
        <FileUp className="w-3.5 h-3.5" /> Informar pago
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await subirComprobantePago(formData);
          if (res.error) setError(res.error);
          else setOk(true);
        });
      }}
      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5"
    >
      <input type="hidden" name="charge_id" value={chargeId} />

      <label className="flex flex-col gap-1 text-[11px] font-bold text-[#1A2A44]">
        Monto a pagar (hasta {formatoPesos(saldo)})
        <input
          name="monto"
          type="number"
          min={1}
          step="0.01"
          max={saldo}
          defaultValue={saldo}
          required
          className={CLASE_INPUT}
        />
      </label>

      <label className="flex flex-col gap-1 text-[11px] font-bold text-[#1A2A44]">
        Método de pago
        <select name="metodo" required className={CLASE_INPUT}>
          <option value="transferencia">Transferencia</option>
          <option value="deposito">Depósito bancario</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] font-bold text-[#1A2A44] sm:col-span-2">
        Foto o PDF del comprobante (máx. 5 MB)
        <input
          name="comprobante"
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          required
          className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#1A2A44] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
        />
      </label>

      {error && (
        <p className="sm:col-span-2 text-[11px] font-semibold text-red-600 flex items-center gap-1">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      <div className="sm:col-span-2 flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="px-4 py-2 rounded-xl bg-[#F97316] text-white text-[11px] font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5"
        >
          {pendiente && <Loader2 className="w-3 h-3 animate-spin" />}
          Enviar comprobante
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="px-3 py-2 rounded-xl border border-slate-300 text-[11px] font-bold text-slate-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
