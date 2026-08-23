"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, FileImage, PenLine, IdCard } from "lucide-react";
import { obtenerUrlDocumentoPase } from "@/lib/actions/pases.actions";

export interface EvidenciaTutorUI {
  parentesco: string;
  nombre: string;
  apellido: string;
  dni: string;
  firma_path: string;
  dni_path: string;
}

/**
 * Evidencia de la firma del jugador (solo la liga): botones que abren la firma
 * dibujada y las fotos de DNI en una pestaña nueva, con links firmados de 5 minutos.
 */
export function EvidenciaFirma({
  transferId,
  firmaJugadorPath,
  dniJugadorPath,
  tutor,
}: {
  transferId: string;
  firmaJugadorPath: string | null;
  dniJugadorPath: string | null;
  tutor: EvidenciaTutorUI | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function abrir(path: string) {
    setError(null);
    startTransition(async () => {
      const res = await obtenerUrlDocumentoPase(path);
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else setError(res.error ?? "No se pudo abrir el documento.");
    });
  }

  function BotonDoc({ path, texto, icono }: { path: string; texto: string; icono: React.ReactNode }) {
    return (
      <button
        type="button"
        disabled={pendiente}
        onClick={() => abrir(path)}
        className="px-3 py-2 rounded-xl border border-slate-300 text-[11px] font-bold text-slate-600 hover:border-slate-400 hover:bg-slate-50 transition disabled:opacity-50 flex items-center gap-1.5"
      >
        {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icono}
        {texto}
      </button>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col gap-2.5">
      <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
        <FileImage className="w-3.5 h-3.5" /> Evidencia de la firma
      </p>
      <div className="flex flex-wrap gap-2">
        {firmaJugadorPath && (
          <BotonDoc
            path={firmaJugadorPath}
            texto="Firma del jugador"
            icono={<PenLine className="w-3.5 h-3.5" />}
          />
        )}
        {dniJugadorPath && (
          <BotonDoc
            path={dniJugadorPath}
            texto="Foto DNI del jugador"
            icono={<IdCard className="w-3.5 h-3.5" />}
          />
        )}
      </div>

      {tutor && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex flex-col gap-2">
          <p className="text-[11px] font-black text-purple-900 uppercase tracking-wider">
            Autorización del tutor ({tutor.parentesco})
          </p>
          <p className="text-[11px] text-purple-800">
            {tutor.apellido}, {tutor.nombre} — DNI {tutor.dni}
          </p>
          <div className="flex flex-wrap gap-2">
            <BotonDoc
              path={tutor.firma_path}
              texto="Firma del tutor"
              icono={<PenLine className="w-3.5 h-3.5" />}
            />
            <BotonDoc
              path={tutor.dni_path}
              texto="Foto DNI del tutor"
              icono={<IdCard className="w-3.5 h-3.5" />}
            />
          </div>
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
