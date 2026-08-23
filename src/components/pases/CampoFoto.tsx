"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";

/**
 * Campo para sacarse una foto con la cámara delantera del celular
 * (capture="user") o elegir una imagen. Llama a onCambio con el File.
 */
export function CampoFoto({
  nombre,
  onCambio,
  etiqueta = "Sacar foto (se abre la cámara)",
}: {
  nombre: string;
  onCambio: (archivo: File | null) => void;
  etiqueta?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);

  function tomarArchivo(archivo: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    if (!archivo) {
      setPreview(null);
      setNombreArchivo(null);
      onCambio(null);
      return;
    }
    setPreview(URL.createObjectURL(archivo));
    setNombreArchivo(archivo.name);
    onCambio(archivo);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        type="file"
        name={nombre}
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(e) => tomarArchivo(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Foto tomada"
            className="w-14 h-14 rounded-lg object-cover border border-green-300"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-green-800">✅ Foto lista</p>
            <p className="text-[10px] text-green-700 truncate">{nombreArchivo}</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-[10px] font-bold text-slate-500 hover:text-[#F97316] transition"
          >
            Sacar otra
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-500 hover:border-[#F97316]/60 hover:text-[#F97316] transition flex items-center justify-center gap-2"
        >
          <Camera className="w-4 h-4" /> {etiqueta}
        </button>
      )}
    </div>
  );
}
