"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, UserX, OctagonX, Loader2, AlertTriangle } from "lucide-react";
import {
  registrarAusencia,
  suspenderPartido,
  type PlanillaEnVivo,
} from "@/lib/actions/planilla-en-vivo.actions";

/**
 * AUSENCIA Y SUSPENSIÓN — Paso 17C
 * "Ausencia (gana el rival)": un equipo no se presentó; el marcador
 * sale de la configuración del torneo y se multa al club ausente.
 * "Suspensión": el partido no se pudo jugar/terminar, con motivo.
 */
export function ModalAusenciaSuspension({
  planilla,
  onCerrar,
}: {
  planilla: PlanillaEnVivo;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [modo, setModo] = useState<"ausencia" | "suspension">("ausencia");
  const [equipoAusente, setEquipoAusente] = useState<string>(planilla.awayTeamId);
  const [motivo, setMotivo] = useState("");

  const confirmar = () => {
    startTransition(async () => {
      const res =
        modo === "ausencia"
          ? await registrarAusencia(planilla.matchId, equipoAusente, motivo)
          : await suspenderPartido(planilla.matchId, motivo);
      if (res.error) {
        alert(res.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl shadow-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-black text-[#1A2A44]">
            El partido no se juega
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModo("ausencia")}
            className={`rounded-xl border-2 py-3 text-sm font-bold flex flex-col items-center gap-1 transition-colors ${
              modo === "ausencia"
                ? "border-[#F97316] bg-orange-50 text-[#1A2A44]"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <UserX className="w-5 h-5" />
            Ausencia
            <span className="text-[10px] font-medium text-slate-400">gana el rival</span>
          </button>
          <button
            type="button"
            onClick={() => setModo("suspension")}
            className={`rounded-xl border-2 py-3 text-sm font-bold flex flex-col items-center gap-1 transition-colors ${
              modo === "suspension"
                ? "border-[#F97316] bg-orange-50 text-[#1A2A44]"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            <OctagonX className="w-5 h-5" />
            Suspensión
            <span className="text-[10px] font-medium text-slate-400">se reprograma</span>
          </button>
        </div>

        {modo === "ausencia" && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-slate-500">¿Qué equipo no se presentó?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEquipoAusente(planilla.homeTeamId)}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                  equipoAusente === planilla.homeTeamId
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {planilla.local}
              </button>
              <button
                type="button"
                onClick={() => setEquipoAusente(planilla.awayTeamId)}
                className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                  equipoAusente === planilla.awayTeamId
                    ? "border-red-400 bg-red-50 text-red-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {planilla.visitante}
              </button>
            </div>
          </div>
        )}

        <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1.5">
          Motivo (queda asentado en el partido)
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder={
              modo === "ausencia"
                ? "Ej.: el equipo no llegó a la cancha a los 15 minutos reglamentarios"
                : "Ej.: se suspendió por corte de luz en el gimnasio"
            }
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60 outline-none resize-none"
          />
        </label>

        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-3.5 py-2.5">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {modo === "ausencia"
            ? "El resultado sale de la configuración del torneo y el club ausente recibe la multa automática."
            : "El partido queda suspendido y la federación decide cuándo se reprograma."}
        </div>

        <button
          type="button"
          disabled={pending || motivo.trim().length < 5}
          onClick={confirmar}
          className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white font-black text-sm rounded-xl py-3.5 transition-colors"
        >
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          {modo === "ausencia" ? "Registrar ausencia" : "Suspender el partido"}
        </button>
      </div>
    </div>
  );
}
