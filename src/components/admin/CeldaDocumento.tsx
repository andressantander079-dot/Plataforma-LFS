"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, AlertCircle, LoaderCircle } from "lucide-react";
import { subirDocumento, obtenerUrlDocumento } from "@/lib/actions/documentos.actions";

/**
 * CELDA DE DOCUMENTO DEL PLANTEL
 * - Rojo (sin documento): clic → abre el selector de archivos y sube.
 * - Verde (con documento): clic → abre el documento en una pestaña nueva.
 */

interface Props {
  clubId: string;
  playerId: string;
  tipo: "medical" | "ddjj" | "photo";
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
        <button
          type="button"
          onClick={handleVer}
          title={`Ver ${titulo}`}
          className="hover:scale-110 transition-transform"
        >
          <CheckCircle className="w-5 h-5 text-green-600" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title={`Subir ${titulo} (PDF/JPG/PNG, máx 5MB)`}
          className="hover:scale-110 transition-transform"
        >
          <AlertCircle className="w-5 h-5 text-red-500" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleArchivo}
        className="hidden"
      />
      {error && <span className="text-[9px] text-red-500 font-bold">{error}</span>}
    </span>
  );
}
