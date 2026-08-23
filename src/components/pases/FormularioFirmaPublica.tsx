"use client";

import { useState, useTransition } from "react";
import { PenLine, Loader2, AlertCircle } from "lucide-react";

interface ResultadoFirma {
  ok?: boolean;
  error?: string;
}

/**
 * Firma online del jugador: ingresa su DNI y confirma.
 * No necesita usuario ni contraseña: el token del link es la llave.
 */
export function FormularioFirmaPublica({
  token,
  firmar,
}: {
  token: string;
  firmar: (token: string, dni: string) => Promise<ResultadoFirma>;
}) {
  const [dni, setDni] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [firmado, setFirmado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  if (firmado) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center flex flex-col gap-2">
        <p className="text-3xl">✍️</p>
        <p className="font-black text-green-800">¡Firma registrada!</p>
        <p className="text-xs text-green-700">
          Tu pase quedó firmado. La liga hace la última revisión y tu club nuevo te confirma
          cuando esté efectivo.
        </p>
      </div>
    );
  }

  return (
    <form
      action={() => {
        setError(null);
        startTransition(async () => {
          const res = await firmar(token, dni.trim());
          if (res.error) setError(res.error);
          else setFirmado(true);
        });
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
        Tu DNI (sin puntos ni letras)
        <input
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          inputMode="numeric"
          required
          minLength={6}
          maxLength={10}
          placeholder="Ej: 44111222"
          className="rounded-xl border border-slate-300 px-3.5 py-3 text-base text-center tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
        />
      </label>
      <p className="text-[10px] text-slate-400 leading-snug">
        Al confirmar declarás que sos el jugador del pase y que aceptás el pase al club nuevo.
        La firma queda registrada con fecha y hora.
      </p>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pendiente || dni.length < 6}
        className="px-6 py-3 rounded-xl bg-[#F97316] text-white text-sm font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
      >
        {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
        Firmar mi pase
      </button>
    </form>
  );
}
