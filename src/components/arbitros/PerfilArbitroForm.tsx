"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import {
  Award,
  Camera,
  CircleAlert,
  Eraser,
  Loader2,
  PenLine,
  Phone,
  Save,
} from "lucide-react";
import { guardarMiPerfil, type MiPerfilUI } from "@/lib/actions/arbitros.actions";
import { ESTADO_ARBITRO_UI } from "@/lib/core/rules/arbitrosRules";

/**
 * PERFIL DEL ÁRBITRO — edita SOLO lo suyo: foto, teléfono y firma digital
 * (dibujada con el dedo en el celu o el mouse). El nivel y el estado los
 * fija la liga desde el Colegio de Árbitros (se muestran read-only).
 */
export function PerfilArbitroForm({ perfil }: { perfil: MiPerfilUI }) {
  const [telefono, setTelefono] = useState(perfil.telefono ?? "");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(perfil.fotoUrl);
  const [firmaNueva, setFirmaNueva] = useState<File | null>(null);
  const [firmaPreview, setFirmaPreview] = useState<string | null>(perfil.firmaUrl);
  const [firmaTocada, setFirmaTocada] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);

  // Firma digital: canvas táctil + mouse
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1A2A44";

    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    };
    const empezar = (e: PointerEvent) => {
      dibujando.current = true;
      const { x, y } = pos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      canvas.setPointerCapture(e.pointerId);
    };
    const mover = (e: PointerEvent) => {
      if (!dibujando.current) return;
      const { x, y } = pos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      setFirmaTocada(true);
    };
    const terminar = () => {
      dibujando.current = false;
    };
    canvas.addEventListener("pointerdown", empezar);
    canvas.addEventListener("pointermove", mover);
    canvas.addEventListener("pointerup", terminar);
    canvas.addEventListener("pointerleave", terminar);
    return () => {
      canvas.removeEventListener("pointerdown", empezar);
      canvas.removeEventListener("pointermove", mover);
      canvas.removeEventListener("pointerup", terminar);
      canvas.removeEventListener("pointerleave", terminar);
    };
  }, []);

  const limpiarFirma = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFirmaTocada(false);
    setFirmaNueva(null);
  };

  const elegirFoto = (file: File | null) => {
    setFotoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setFotoPreview(String(reader.result));
      reader.readAsDataURL(file);
    }
  };

  const guardar = () => {
    setAviso(null);
    startTransition(async () => {
      // La firma del canvas se convierte a PNG solo si fue dibujada
      let firma = firmaNueva;
      if (firmaTocada && canvasRef.current) {
        const blob = await new Promise<Blob | null>((res) =>
          canvasRef.current!.toBlob(res, "image/png")
        );
        if (blob) firma = new File([blob], "firma.png", { type: "image/png" });
      }
      const fd = new FormData();
      fd.set("telefono", telefono);
      if (fotoFile) fd.set("foto", fotoFile);
      if (firma) fd.set("firma", firma);
      const res = await guardarMiPerfil(fd);
      if (res?.error) setAviso({ tipo: "error", texto: res.error });
      else {
        setAviso({ tipo: "ok", texto: "Perfil guardado." });
        if (firma) {
          const reader = new FileReader();
          reader.onload = () => setFirmaPreview(String(reader.result));
          reader.readAsDataURL(firma);
        }
        setFirmaTocada(false);
      }
    });
  };

  const estadoUi = ESTADO_ARBITRO_UI[perfil.estado] ?? ESTADO_ARBITRO_UI.activo;

  return (
    <div className="flex flex-col gap-5">
      {/* Datos que fija la liga (read-only) */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
        <Award className="w-5 h-5 text-[#F97316]" />
        <div className="flex-1 min-w-[140px]">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nivel asignado por la liga
          </p>
          <p className="font-bold text-sm text-[#1A2A44]">{perfil.nivelNombre ?? "Sin nivel todavía"}</p>
        </div>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${estadoUi.className}`}>
          {estadoUi.label}
        </span>
      </div>

      {/* Foto */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Camera className="w-4 h-4 text-[#F97316]" /> Tu foto
        </h3>
        <div className="flex items-center gap-4">
          {fotoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoPreview}
              alt="Tu foto"
              className="w-20 h-20 rounded-full object-cover border-2 border-slate-100"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#1A2A44] text-white flex items-center justify-center font-black text-2xl">
              {perfil.nombre.slice(0, 1).toUpperCase()}
            </div>
          )}
          <label className="px-4 py-2.5 rounded-xl border border-slate-300 hover:border-[#F97316] text-xs font-bold text-slate-600 cursor-pointer transition">
            {fotoPreview ? "Cambiar foto" : "Subir foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => elegirFoto(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
      </div>

      {/* Teléfono */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#F97316]" /> Teléfono de contacto
        </h3>
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="Ej: 2901 45-6789"
          className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
        />
        <p className="text-[10px] text-slate-400">
          Lo ve la liga en el Colegio de Árbitros para coordinar designaciones.
        </p>
      </div>

      {/* Firma digital */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h3 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <PenLine className="w-4 h-4 text-[#F97316]" /> Tu firma digital
        </h3>
        {firmaPreview && !firmaTocada && (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold text-emerald-700">✓ Tenés una firma guardada:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={firmaPreview}
              alt="Tu firma"
              className="h-24 w-auto max-w-full object-contain border border-slate-200 rounded-xl bg-white p-2 self-start"
            />
          </div>
        )}
        <p className="text-[10px] text-slate-400">
          Dibujá tu firma con el dedo (celu) o el mouse. Se usa en las planillas de partido.
        </p>
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-36 border-2 border-dashed border-slate-300 rounded-xl bg-white touch-none cursor-crosshair"
        />
        <button
          onClick={limpiarFirma}
          type="button"
          className="self-start px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500 hover:border-red-300 hover:text-red-600 transition flex items-center gap-1"
        >
          <Eraser className="w-3 h-3" /> Borrar firma
        </button>
      </div>

      {aviso && (
        <p
          className={`text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 ${
            aviso.tipo === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <CircleAlert className="w-4 h-4 shrink-0" /> {aviso.texto}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={pendiente}
        className="w-full sm:w-64 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-black text-sm shadow-lg shadow-orange-500/20 transition flex items-center justify-center gap-2"
      >
        {pendiente ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-4 h-4" />}
        Guardar mi perfil
      </button>
    </div>
  );
}
