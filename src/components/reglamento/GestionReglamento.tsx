"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileText,
  FileUp,
  History,
  Loader2,
  Scale,
  Trash2,
} from "lucide-react";
import {
  eliminarVersionReglamento,
  subirVersionReglamento,
  type ReglamentoPanel,
  type VersionReglamentoUI,
} from "@/lib/actions/reglamento.actions";

const NOTAS_MIN = 10;
const NOTAS_MAX = 1000;

function fechaLinda(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * GESTIÓN DEL REGLAMENTO OFICIAL (Paso 17B): versión vigente destacada,
 * subida de nuevas versiones (PDF + notas de cambios OBLIGATORIAS) e
 * historial completo con descarga y eliminación. Al subir, la versión se
 * publica sola en /descargas (espejo automático).
 */
export function GestionReglamento({ panel }: { panel: ReglamentoPanel }) {
  const router = useRouter();
  const inputArchivo = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [notas, setNotas] = useState("");
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [procesando, startTransition] = useTransition();

  const mostrarAviso = (ok: boolean, texto: string) => {
    setAviso({ ok, texto });
    window.setTimeout(() => setAviso(null), 6000);
  };

  const notasListas = notas.trim().length >= NOTAS_MIN && notas.trim().length <= NOTAS_MAX;

  const subir = (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivo) {
      mostrarAviso(false, "Elegí el PDF del reglamento primero.");
      return;
    }
    if (!notasListas) {
      mostrarAviso(false, `Las notas de cambios son obligatorias (mínimo ${NOTAS_MIN} caracteres).`);
      return;
    }
    const formData = new FormData();
    formData.set("archivo", archivo);
    formData.set("notas", notas.trim());
    startTransition(async () => {
      const res = await subirVersionReglamento(formData);
      if (res.ok) {
        mostrarAviso(true, `Versión ${res.version} publicada. Ya está disponible en Descargas.`);
        setArchivo(null);
        setNotas("");
        if (inputArchivo.current) inputArchivo.current.value = "";
        router.refresh();
      } else {
        mostrarAviso(false, res.error ?? "No se pudo subir la versión.");
      }
    });
  };

  const eliminar = (v: VersionReglamentoUI) => {
    const advertencia = v.vigente
      ? `¿Eliminar la versión ${v.version}? Es la VIGENTE: va a quedar vigente la más reciente que quede.`
      : `¿Eliminar la versión ${v.version}? Esta acción no se puede deshacer.`;
    if (!window.confirm(advertencia)) return;
    startTransition(async () => {
      const res = await eliminarVersionReglamento(v.id);
      if (res.ok) {
        mostrarAviso(
          true,
          res.versionPromovida
            ? `Versión eliminada. Ahora está vigente la versión ${res.versionPromovida}.`
            : "Versión eliminada."
        );
        router.refresh();
      } else {
        mostrarAviso(false, res.error ?? "No se pudo eliminar.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Aviso flotante */}
      {aviso && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white ${
            aviso.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {aviso.ok ? <CheckCircle2 className="w-4 h-4" /> : <CircleAlert className="w-4 h-4" />}
          {aviso.texto}
        </div>
      )}

      {/* Versión vigente */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#1A2A44] rounded-2xl flex items-center justify-center shrink-0">
              <Scale className="w-7 h-7 text-[#F97316]" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-black text-[#1A2A44]">
                {panel.vigente
                  ? `Reglamento vigente — Versión ${panel.vigente.version}`
                  : "Todavía no hay reglamento cargado"}
              </h3>
              {panel.vigente && (
                <p className="text-[11px] text-slate-400 font-bold">
                  Publicado el {fechaLinda(panel.vigente.subidoEn)} · Visible en /descargas
                </p>
              )}
            </div>
          </div>
          {panel.vigente && (
            <a
              href={panel.vigente.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-[#1A2A44] hover:bg-[#0F1A2E] text-white rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Descargar PDF
            </a>
          )}
        </div>
        {panel.vigente && (
          <div className="mt-4 bg-slate-50 border border-slate-100 rounded-xl p-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
              Notas de esta versión
            </span>
            <p className="text-xs text-slate-600 whitespace-pre-line">
              {panel.vigente.notasCambios}
            </p>
          </div>
        )}
      </div>

      {/* Subir nueva versión */}
      <form
        onSubmit={subir}
        className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4"
      >
        <h3 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <FileUp className="w-5 h-5 text-[#F97316]" /> Subir nueva versión
        </h3>

        <button
          type="button"
          onClick={() => inputArchivo.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 transition text-center ${
            archivo
              ? "border-emerald-300 bg-emerald-50/40 text-emerald-700"
              : "border-slate-200 hover:bg-slate-50 text-slate-500"
          }`}
        >
          <FileText className="w-7 h-7" />
          <span className="font-bold text-xs">
            {archivo ? archivo.name : "Seleccionar archivo PDF (máximo 10 MB)"}
          </span>
          {archivo && (
            <span className="text-[10px] font-bold text-emerald-600">
              {(archivo.size / 1024 / 1024).toFixed(2)} MB — listo para subir
            </span>
          )}
        </button>
        <input
          ref={inputArchivo}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex justify-between mb-1.5">
            <span>Notas de cambios * (obligatorias)</span>
            <span
              className={
                notas.trim().length > NOTAS_MAX || (notas.length > 0 && !notasListas)
                  ? "text-rose-500"
                  : "text-slate-300"
              }
            >
              {notas.trim().length}/{NOTAS_MAX}
            </span>
          </label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Contá qué cambió: artículos modificados, fechas afectadas, decisiones del consejo…"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-[#1A2A44] placeholder:text-slate-300 focus:outline-none focus:border-[#F97316] focus:ring-2 focus:ring-orange-100 transition min-h-[96px] resize-y"
            maxLength={NOTAS_MAX}
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Las notas quedan publicadas en el historial y en Descargas: son la memoria de cada
            cambio del reglamento.
          </p>
        </div>

        <button
          type="submit"
          disabled={procesando || !archivo || !notasListas}
          className="px-4 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-black uppercase tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {procesando && <Loader2 className="w-4 h-4 animate-spin" />}
          Publicar nueva versión
        </button>
      </form>

      {/* Historial */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <h3 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-[#F97316]" /> Historial de versiones
        </h3>
        {panel.versiones.length === 0 ? (
          <p className="text-xs text-slate-400 font-semibold">
            Cuando subas la primera versión va a aparecer acá.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {panel.versiones.map((v) => (
              <div
                key={v.id}
                className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                  v.vigente
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-[#1A2A44] text-sm">Versión {v.version}</span>
                    {v.vigente && (
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Vigente
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-400">
                      {fechaLinda(v.subidoEn)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 whitespace-pre-line line-clamp-3">
                    {v.notasCambios}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1A2A44] transition"
                    title="Descargar PDF"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => eliminar(v)}
                    disabled={procesando}
                    className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition disabled:opacity-50"
                    title="Eliminar versión"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
