"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Undo2 } from "lucide-react";
import { rescindirPrestamo } from "@/lib/actions/pases.actions";

/**
 * Botón del club DESTINO para rescindir (terminar antes) un préstamo.
 * La rescisión puede tener un recargo configurado por la liga.
 */
export function BotonRescindirPrestamo({
  transferId,
  recargo,
}: {
  transferId: string;
  recargo: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const fmt = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          const textoRecargo =
            recargo > 0
              ? `\n\n⚠️ La rescisión anticipada tiene un RECARGO de ${fmt.format(recargo)} que se le cargará a tu club.`
              : "";
          if (
            !window.confirm(
              `¿Rescindir el préstamo? El jugador vuelve AHORA a su club de origen.${textoRecargo}`
            )
          )
            return;
          setError(null);
          startTransition(async () => {
            const res = await rescindirPrestamo(transferId);
            if (res.error) setError(res.error);
          });
        }}
        className="px-4 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        {pendiente ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Undo2 className="w-4 h-4" />
        )}
        Rescindir préstamo (vuelve antes)
      </button>
      {recargo > 0 && (
        <p className="text-[10px] text-amber-700 font-semibold">
          ⚠️ Rescindir antes de la fecha de retorno cuesta {fmt.format(recargo)} (recargo de la
          liga).
        </p>
      )}
      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
