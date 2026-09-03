"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Camera, Cake, Save, FileText, CheckCircle2, XCircle } from "lucide-react";
import { subirFotoJugador, guardarNacimientoJugador } from "@/lib/actions/pases.actions";
import { DOCUMENTOS_INSCRIPCION } from "@/lib/core/rules/jugadoresRules";
import type { JugadorFila } from "./PlantelClubInteractivo";

/**
 * FICHA DEL JUGADOR (vista del club, Paso 10B)
 * El club completa y revisa los datos obligatorios de su jugador:
 *  · Foto (se ve en la planilla, en los pases y en la web pública)
 *  · Fecha de nacimiento (define su categoría y si es menor de edad)
 *  · Documentación de inscripción: DNI, CEMAD médico, CEMAD de autorización
 *    y comprobante de pago de federación (checklist)
 */
export function FichaJugadorClub({ jugador }: { jugador: JugadorFila }) {
  const router = useRouter();
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const [fecha, setFecha] = useState(jugador.fechaNacimiento ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function subirFoto(archivo: File | null) {
    if (!archivo) return;
    setError(null);
    setOk(null);
    const formData = new FormData();
    formData.set("foto", archivo);
    startTransition(async () => {
      const res = await subirFotoJugador(jugador.id, formData);
      if (res.error) setError(res.error);
      else {
        setOk("✅ Foto actualizada.");
        router.refresh();
      }
    });
  }

  function guardarFecha() {
    setError(null);
    setOk(null);
    startTransition(async () => {
      const res = await guardarNacimientoJugador(jugador.id, fecha);
      if (res.error) setError(res.error);
      else {
        setOk("✅ Fecha de nacimiento guardada.");
        router.refresh();
      }
    });
  }

  const cargados = new Set(jugador.documentosCargados ?? []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Foto del jugador */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Foto del jugador
        </p>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={jugador.fotoUrl ?? "/jugador-default.png"}
            alt={`Foto de ${jugador.fullName}`}
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100"
          />
          <div className="flex-1">
            <input
              ref={inputFotoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => subirFoto(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              disabled={pendiente}
              onClick={() => inputFotoRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-[#1A2A44] text-white text-[11px] font-bold hover:bg-[#1A2A44]/90 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {pendiente ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
              {jugador.fotoUrl ? "Cambiar foto" : "Subir foto"}
            </button>
            <p className="text-[10px] text-slate-400 mt-1.5">
              JPG, PNG o WebP · máx. 5 MB. Es pública: se muestra en planillas y transferencias.
            </p>
          </div>
        </div>
      </div>

      {/* Fecha de nacimiento */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Cake className="w-3.5 h-3.5" /> Fecha de nacimiento
        </p>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fecha}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setFecha(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
          />
          <button
            type="button"
            disabled={pendiente || !fecha}
            onClick={guardarFecha}
            className="px-3.5 py-2 rounded-xl bg-[#F97316] text-white text-[11px] font-bold hover:bg-[#F97316]/90 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {pendiente ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Guardar
          </button>
        </div>
        <p className="text-[10px] text-slate-400">
          Obligatoria: define su categoría (solo puede inscribirse en la de su año de nacimiento) y,
          si es menor de 18, sus pases necesitan la firma de un tutor.
        </p>
      </div>

      {/* Checklist de documentación de inscripción */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 sm:col-span-2">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" /> Documentación de inscripción
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DOCUMENTOS_INSCRIPCION.map((doc) => {
            const cargado = cargados.has(doc.clave);
            return (
              <li
                key={doc.clave}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                  cargado
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {cargado ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                {doc.nombre}
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-slate-400">
          Los 4 documentos se exigen al inscribir al jugador. Si falta alguno, hablá con la liga
          para regularizar su situación.
        </p>
      </div>

      {(error || ok) && (
        <div className="sm:col-span-2">
          {error && (
            <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" /> {error}
            </p>
          )}
          {ok && <p className="text-xs font-semibold text-green-700">{ok}</p>}
        </div>
      )}
    </div>
  );
}
