"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  BellRing,
  FastForward,
  Ban,
  Loader2,
  CircleAlert,
} from "lucide-react";
import { recordarPase, destrabarPase, cancelarPaseAdmin } from "@/lib/actions/tramites.actions";

/**
 * HERRAMIENTAS DE PASE TRABADO — la federación puede:
 *  · Recordar: mensajería interna al responsable.
 *  · Destrabar: fuerza el avance según el paso en que está (auditado).
 *  · Cancelar: cierra el trámite con motivo y avisa a ambos clubes.
 */
export function HerramientasTrabado({ transferId }: { transferId: string }) {
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const avisar = (tipo: "ok" | "error", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 5000);
  };

  const recordar = () => {
    startTransition(async () => {
      const res = await recordarPase(transferId);
      if (res?.error) avisar("error", res.error);
      else avisar("ok", "Recordatorio enviado por mensajería interna.");
    });
  };

  const destrabar = () => {
    if (!window.confirm("¿Destrabar el pase? La federación fuerza el avance del paso en el que está (queda en auditoría).")) return;
    startTransition(async () => {
      const res = await destrabarPase(transferId);
      if (res?.error) avisar("error", res.error);
      else avisar("ok", "Pase destrabado: avanzó al siguiente paso.");
    });
  };

  const cancelar = () => {
    if (motivo.trim().length < 5) {
      avisar("error", "Contá el motivo de la cancelación (mínimo 5 caracteres).");
      return;
    }
    startTransition(async () => {
      const res = await cancelarPaseAdmin(transferId, motivo);
      if (res?.error) avisar("error", res.error);
      else {
        avisar("ok", "Trámite cancelado. Se avisó a ambos clubes.");
        setCancelando(false);
      }
    });
  };

  const botonCls =
    "flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50";

  return (
    <div className="bg-red-50/60 border-2 border-red-300 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <div>
          <h3 className="font-serif text-base font-black text-red-700">Pase trabado</h3>
          <p className="text-[11px] text-red-600">
            Superó el tiempo de espera configurado. Elegí cómo seguir:
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={recordar} disabled={pendiente} className={`${botonCls} bg-[#1A2A44] text-white hover:bg-[#25375a]`}>
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
          Recordar
        </button>
        <button onClick={destrabar} disabled={pendiente} className={`${botonCls} bg-amber-500 text-white hover:bg-amber-600`}>
          {pendiente ? <Loader2 className="w-4 h-4 animate-spin" /> : <FastForward className="w-4 h-4" />}
          Destrabar
        </button>
        <button
          onClick={() => setCancelando((v) => !v)}
          disabled={pendiente}
          className={`${botonCls} bg-red-600 text-white hover:bg-red-700`}
        >
          <Ban className="w-4 h-4" />
          Cancelar trámite
        </button>
      </div>

      {cancelando && (
        <div className="flex flex-col gap-2 bg-white border border-red-200 rounded-xl p-3">
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            placeholder="Motivo de la cancelación (lo ven ambos clubes)…"
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
          <button
            onClick={cancelar}
            disabled={pendiente}
            className="self-end px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black flex items-center gap-2 disabled:opacity-50"
          >
            {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Confirmar cancelación
          </button>
        </div>
      )}

      {aviso && (
        <p
          className={`text-xs font-bold flex items-center gap-1.5 ${
            aviso.tipo === "error" ? "text-red-700" : "text-emerald-700"
          }`}
        >
          <CircleAlert className="w-4 h-4" /> {aviso.texto}
        </p>
      )}
    </div>
  );
}
