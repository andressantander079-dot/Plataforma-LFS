"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle, LoaderCircle, Upload } from "lucide-react";
import {
  subirDocumento,
  obtenerUrlDocumento,
  type TipoDocumento,
} from "@/lib/actions/documentos.actions";

/**
 * CELDA DE DOCUMENTO DEL PLANTEL
 * - Sin documento: clic → abre el selector de archivos y sube.
 * - Con documento: clic en el check verde → abre el documento firmado en nueva pestaña;
 *   clic secundario en el ícono de subir → permite reemplazarlo.
 */

interface Props {
  clubId: string;
  playerId: string;
  tipo: TipoDocumento;
  ruta: string | null;
  titulo: string;
}

export function CeldaDocumento({ clubId, playerId, tipo, ruta, titulo }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCargando(true);
    setError(null);

    const fd = new FormData();
    fd.append("archivo", file);
    const result = await subirDocumento(clubId, playerId, tipo, fd);

    setCargando(false);
    // Permite volver a elegir el mismo archivo si falló
    e.target.value = "";

    if (!result.ok) {
      setError(result.error ?? "Error al subir el archivo.");
      return;
    }
    router.refresh();
  }

  async function handleVer() {
    if (!ruta) return;
    setCargando(true);
    setError(null);
    const result = await obtenerUrlDocumento(ruta);
    setCargando(false);

    if (result.ok && result.url) {
      window.open(result.url, "_blank");
    } else {
      setError(result.error ?? "No se pudo abrir el documento.");
    }
  }

  if (cargando) {
    return <LoaderCircle className="w-5 h-5 text-[#F97316] animate-spin inline-block" />;
  }

  return (
    <span className="inline-flex flex-col items-center gap-1">
      {ruta ? (
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={handleVer}
            title={`Ver ${titulo}`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition text-[10px] font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Ver</span>
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            title={`Reemplazar ${titulo}`}
            className="p-1 rounded-lg text-slate-400 hover:text-[#1A2A44] hover:bg-slate-100 transition"
          >
            <Upload className="w-3 h-3" />
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title={`Subir ${titulo} (PDF/JPG/PNG/WebP, máx 5MB)`}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition text-[10px] font-bold"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Subir</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleArchivo}
        className="hidden"
      />
      {error && <span className="text-[9px] text-red-500 font-bold max-w-[120px] leading-tight">{error}</span>}
    </span>
  );
}
