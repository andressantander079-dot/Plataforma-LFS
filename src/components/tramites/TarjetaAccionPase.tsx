"use client";

import { useState, useTransition } from "react";
import {
  Zap,
  Loader2,
  CircleAlert,
  CheckCircle2,
  BellRing,
  CheckCheck,
} from "lucide-react";
import { aprobarRevisionPase, completarPase } from "@/lib/actions/pases.actions";
import { recordarPase } from "@/lib/actions/tramites.actions";
import type { AccionPrincipal } from "@/lib/core/rules/tramitesRules";

/**
 * TARJETA "QUÉ TENÉS QUE HACER AHORA" — la acción principal del pase,
 * en criollo y con el botón directo. En móvil también se muestra como
 * barra fija inferior (BarraAccionFija).
 */

export function BotonAccionPrincipal({
  transferId,
  accion,
  grande = false,
}: {
  transferId: string;
  accion: AccionPrincipal["accion"];
  grande?: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  if (accion === "ninguna") return null;

  const ejecutar = () => {
    setAviso(null);
    const confirmaciones: Record<string, string> = {
      aprobar_revision: "¿Aprobar la revisión? El club de origen recibirá el aviso para dictaminar.",
      completar: "¿Completar el pase? El jugador se mueve al club destino y se genera el derecho de pase en tesorería.",
      recordar: "¿Enviar el recordatorio por mensajería interna al responsable?",
    };
    if (!window.confirm(confirmaciones[accion])) return;
    startTransition(async () => {
      let res: { ok?: boolean; error?: string } = {};
      if (accion === "aprobar_revision") res = await aprobarRevisionPase(transferId);
      if (accion === "completar") res = await completarPase(transferId);
      if (accion === "recordar") res = await recordarPase(transferId);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else setAviso({ tipo: "ok", texto: "Listo, el pase avanzó." });
    });
  };

  const estilos: Record<string, string> = {
    aprobar_revision: "bg-emerald-600 hover:bg-emerald-700",
    completar: "bg-emerald-600 hover:bg-emerald-700",
    recordar: "bg-[#1A2A44] hover:bg-[#25375a]",
  };
  const iconos: Record<string, React.ReactNode> = {
    aprobar_revision: <CheckCircle2 className={grande ? "w-5 h-5" : "w-4 h-4"} />,
    completar: <CheckCheck className={grande ? "w-5 h-5" : "w-4 h-4"} />,
    recordar: <BellRing className={grande ? "w-5 h-5" : "w-4 h-4"} />,
  };
  const textos: Record<string, string> = {
    aprobar_revision: "Aprobar revisión",
    completar: "Completar pase",
    recordar: "Enviar recordatorio",
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={ejecutar}
        disabled={pendiente}
        className={`${estilos[accion]} text-white rounded-xl font-black flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg ${
          grande ? "w-full py-3.5 text-sm" : "px-5 py-2.5 text-xs"
        }`}
      >
        {pendiente ? <Loader2 className={grande ? "w-5 h-5 animate-spin" : "w-4 h-4 animate-spin"} /> : iconos[accion]}
        {textos[accion]}
      </button>
      {aviso && (
        <p
          className={`text-[11px] font-bold flex items-center gap-1 ${
            aviso.tipo === "error" ? "text-red-600" : "text-emerald-700"
          }`}
        >
          <CircleAlert className="w-3.5 h-3.5" /> {aviso.texto}
        </p>
      )}
    </div>
  );
}

export function TarjetaAccionPase({
  transferId,
  accion,
  trabado,
}: {
  transferId: string;
  accion: AccionPrincipal;
  trabado: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${
        trabado ? "bg-red-50/60 border-red-300" : "bg-gradient-to-r from-orange-50 to-amber-50 border-[#F97316]/40"
      }`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            trabado ? "bg-red-600" : "bg-[#F97316]"
          }`}
        >
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Qué tenés que hacer ahora
          </p>
          <h3 className="font-serif text-base font-black text-[#1A2A44]">{accion.titulo}</h3>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{accion.detalle}</p>
        </div>
      </div>
      <div className="shrink-0 sm:w-52">
        <BotonAccionPrincipal transferId={transferId} accion={accion.accion} />
      </div>
    </div>
  );
}

/** Barra fija inferior (solo móvil) con la acción principal — estilo app. */
export function BarraAccionFija({
  transferId,
  accion,
}: {
  transferId: string;
  accion: AccionPrincipal;
}) {
  if (accion.accion === "ninguna") return null;
  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 shadow-[0_-6px_24px_rgba(0,0,0,0.08)] px-4 pt-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5 text-center">
        {accion.titulo}
      </p>
      <BotonAccionPrincipal transferId={transferId} accion={accion.accion} grande />
    </div>
  );
}
