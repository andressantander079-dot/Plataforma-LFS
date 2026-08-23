"use client";

import { useState, useTransition } from "react";
import { Paperclip, Loader2, AlertCircle, FileImage } from "lucide-react";
import { obtenerUrlDocumentoPase, subirDocumentoPase } from "@/lib/actions/pases.actions";

export interface DocumentoPaseUI {
  id: string;
  nombre: string;
  path: string;
  created_at: string;
}

/** Documentos adjuntos del pase: subir (foto/PDF, máx 5 MB) y ver. */
export function DocumentosPase({
  transferId,
  documentos,
}: {
  transferId: string;
  documentos: DocumentoPaseUI[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {documentos.map((d) => (
        <button
          key={d.id}
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await obtenerUrlDocumentoPase(d.path);
              if (res.url) window.open(res.url, "_blank");
              else if (res.error) setError(res.error);
            });
          }}
          className="flex items-center gap-2 text-left text-xs font-bold text-[#1A2A44] border border-slate-200 rounded-xl px-3.5 py-2.5 hover:border-[#F97316] hover:text-[#F97316] transition"
        >
          <FileImage className="w-4 h-4 shrink-0" />
          <span className="flex-1 truncate">{d.nombre}</span>
          <span className="text-[10px] text-slate-400 font-semibold shrink-0">
            {new Date(d.created_at).toLocaleDateString("es-AR")}
          </span>
        </button>
      ))}
      {documentos.length === 0 && (
        <p className="text-[11px] text-slate-400">Sin documentos adjuntos todavía.</p>
      )}

      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const res = await subirDocumentoPase(formData);
            if (res.error) setError(res.error);
          });
        }}
        className="flex items-center gap-2"
      >
        <input type="hidden" name="transfer_id" value={transferId} />
        <input
          name="documento"
          type="file"
          required
          accept="image/jpeg,image/png,application/pdf"
          className="text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1A2A44] file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-[#1A2A44]/90 flex-1 min-w-0"
        />
        <button
          type="submit"
          disabled={pendiente}
          className="px-3.5 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
        >
          {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          Subir
        </button>
      </form>

      {error && (
        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}
    </div>
  );
}
