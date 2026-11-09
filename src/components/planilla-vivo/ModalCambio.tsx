"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, X, Loader2 } from "lucide-react";
import type { PlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import { registrarEventoEnVivo } from "@/lib/actions/planilla-en-vivo.actions";

/**
 * CAMBIO RÁPIDO — Paso 17C
 * Un solo paso: elegí quién SALE y quién ENTRA del mismo equipo.
 */
export function ModalCambio({
  planilla,
  onCerrar,
}: {
  planilla: PlanillaEnVivo;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [teamId, setTeamId] = useState<string>(planilla.homeTeamId);
  const [saleId, setSaleId] = useState<string | null>(null);
  const [entraId, setEntraId] = useState<string | null>(null);

  const delEquipo = planilla.convocados.filter((c) => c.teamId === teamId);
  const enCancha = delEquipo.filter((c) => c.esTitular);
  const afuera = delEquipo.filter((c) => !c.esTitular);

  const confirmar = () => {
    if (!saleId || !entraId) return;
    startTransition(async () => {
      const res = await registrarEventoEnVivo(planilla.matchId, {
        tipo: "cambio",
        teamId,
        playerId: entraId, // el que ENTRA
        relacionadoId: saleId, // el que SALE
      });
      if (res.error) {
        alert(res.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  };

  const nombreEquipo = teamId === planilla.homeTeamId ? planilla.local : planilla.visitante;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl p-5 flex flex-col gap-4 max-h-[88vh]">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg font-black text-[#1A2A44]">🔁 Cambio rápido</h3>
          <button
            type="button"
            onClick={onCerrar}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[planilla.homeTeamId, planilla.awayTeamId].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTeamId(id);
                setSaleId(null);
                setEntraId(null);
              }}
              className={`rounded-xl border-2 py-2.5 text-sm font-bold transition-colors ${
                teamId === id
                  ? "border-[#F97316] bg-orange-50 text-[#1A2A44]"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {id === planilla.homeTeamId ? planilla.local : planilla.visitante}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 overflow-hidden">
          <div className="flex flex-col gap-1.5 min-h-0">
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Sale
            </p>
            <div className="overflow-y-auto flex flex-col gap-1 max-h-52 pr-1">
              {enCancha.map((c) => (
                <button
                  key={c.sheetPlayerId}
                  type="button"
                  onClick={() => setSaleId(c.playerId)}
                  className={`rounded-lg border-2 px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                    saleId === c.playerId
                      ? "border-red-400 bg-red-50 text-red-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span className="font-black mr-1">{c.numero ?? "—"}</span> {c.nombre}
                </button>
              ))}
              {enCancha.length === 0 && (
                <p className="text-xs text-slate-400 italic">Sin titulares cargados.</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-h-0">
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1">
              <ArrowRight className="w-3 h-3" /> Entra
            </p>
            <div className="overflow-y-auto flex flex-col gap-1 max-h-52 pr-1">
              {afuera
                .filter((c) => c.playerId !== saleId)
                .map((c) => (
                  <button
                    key={c.sheetPlayerId}
                    type="button"
                    onClick={() => setEntraId(c.playerId)}
                    className={`rounded-lg border-2 px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                      entraId === c.playerId
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-black mr-1">{c.numero ?? "—"}</span> {c.nombre}
                  </button>
                ))}
              {afuera.length === 0 && (
                <p className="text-xs text-slate-400 italic">Sin suplentes en la planilla.</p>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!saleId || !entraId || pending}
          onClick={confirmar}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#ea6a0a] disabled:bg-slate-300 text-white font-black text-base rounded-xl py-3.5 transition-colors"
        >
          {pending && <Loader2 className="w-5 h-5 animate-spin" />}
          Confirmar cambio en {nombreEquipo}
        </button>
      </div>
    </div>
  );
}
