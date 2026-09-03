"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Users, Save, AlertTriangle, LoaderCircle, Info, Camera, Paperclip } from "lucide-react";
import { inscribirJugador } from "@/lib/actions/equipos.actions";
import { DOCUMENTOS_INSCRIPCION } from "@/lib/core/rules/jugadoresRules";

/**
 * PANEL LATERAL DE INSCRIPCIÓN DE JUGADOR
 * Se desliza desde la derecha sin cambiar de página.
 * Requisitos (Paso 10B): nombre, apellido, DNI (clave única LFS),
 * fecha de nacimiento, FOTO obligatoria y UNA categoría — la de su año.
 * Si se abre desde un plantel (categoriaFija), la categoría ya viene elegida.
 */

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

interface Props {
  clubId: string;
  clubName: string;
  categories: Category[];
  abierto: boolean;
  onCerrar: () => void;
  categoriaFija?: Category;
}

export function PanelInscribirJugador({
  clubId,
  clubName,
  categories,
  abierto,
  onCerrar,
  categoriaFija,
}: Props) {
  const router = useRouter();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  const [categoriaId, setCategoriaId] = useState<string>(categoriaFija?.id ?? "");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [documentos, setDocumentos] = useState<Record<string, File | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Cerrar con la tecla Escape
  useEffect(() => {
    if (!abierto) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abierto, onCerrar]);

  // Al abrir el panel con categoría fija, preseleccionarla
  useEffect(() => {
    if (abierto) {
      setCategoriaId(categoriaFija?.id ?? "");
      setFoto(null);
      setFotoPreview(null);
      setDocumentos({});
      setSubmitError(null);
    }
  }, [abierto, categoriaFija]);

  function tomarFoto(archivo: File | null) {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFoto(archivo);
    setFotoPreview(archivo ? URL.createObjectURL(archivo) : null);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const categoriaElegida = categoriaFija?.id ?? categoriaId;
    if (!categoriaElegida) {
      setSubmitError("Elegí la categoría del jugador.");
      return;
    }
    if (!foto) {
      setSubmitError("Falta la foto del jugador (obligatoria para inscribirlo).");
      return;
    }
    for (const doc of DOCUMENTOS_INSCRIPCION) {
      if (!documentos[doc.clave]) {
        setSubmitError(`Falta el documento obligatorio: ${doc.nombre}.`);
        return;
      }
    }

    setCargando(true);
    const formData = new FormData(e.currentTarget);
    formData.append("categoryIds", categoriaElegida);
    formData.set("foto", foto);
    for (const doc of DOCUMENTOS_INSCRIPCION) {
      formData.set(`doc_${doc.clave}`, documentos[doc.clave] as File);
    }

    const result = await inscribirJugador(clubId, formData);
    setCargando(false);

    if (!result.ok) {
      setSubmitError(result.error ?? "Ocurrió un error inesperado.");
      return;
    }

    // Éxito: limpiar, cerrar el panel y refrescar la tabla de fondo
    tomarFoto(null);
    setCategoriaId(categoriaFija?.id ?? "");
    (e.target as HTMLFormElement).reset();
    onCerrar();
    router.refresh();
  }

  const inputClass =
    "bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-semibold focus:outline-none focus:ring-1 focus:ring-[#F97316] w-full";

  return (
    <>
      {/* Fondo oscuro: clic afuera cierra el panel */}
      <div
        onClick={onCerrar}
        className={`fixed inset-0 z-40 bg-[#1A2A44]/40 backdrop-blur-[1px] transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel deslizante */}
      <aside
        className={`fixed top-0 right-0 h-full w-full sm:max-w-md bg-white z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
          abierto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Encabezado del panel */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-[#1A2A44]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F97316] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-white">
                Inscribir Jugador
              </h3>
              <p className="text-slate-400 text-[11px]">
                {clubName}
                {categoriaFija ? ` · Plantel ${categoriaFija.name}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition"
            aria-label="Cerrar panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 flex flex-col gap-6"
        >
          {categories.length === 0 && (
            <div className="flex items-center gap-2 p-4 bg-orange-50 text-orange-700 text-xs rounded-xl border border-orange-200">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                No hay categorías cargadas. Ejecutá el script del Paso 2 en Supabase.
              </span>
            </div>
          )}

          {/* Datos personales */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Nombre/s</label>
              <input type="text" name="first_name" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">Apellido/s</label>
              <input type="text" name="last_name" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                DNI (identidad única del jugador en toda la liga)
              </label>
              <input
                type="text"
                name="dni"
                required
                placeholder="Ej: 45222333 (sin puntos)"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Fecha de nacimiento (obligatoria)
              </label>
              <input
                type="date"
                name="fecha_nacimiento"
                required
                max={new Date().toISOString().slice(0, 10)}
                className={inputClass}
              />
              <p className="text-[10px] text-slate-400">
                Define su categoría: el sistema solo deja inscribirlo en la categoría
                de su año (ni más grande ni más chica).
              </p>
            </div>

            {/* Foto obligatoria */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700">
                Foto del jugador (obligatoria)
              </label>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => tomarFoto(e.target.files?.[0] ?? null)}
              />
              {fotoPreview ? (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoPreview}
                    alt="Foto del jugador"
                    className="w-14 h-14 rounded-lg object-cover border border-green-300"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-green-800">✅ Foto lista</p>
                    <p className="text-[10px] text-green-700 truncate">{foto?.name}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => inputFotoRef.current?.click()}
                    className="text-[10px] font-bold text-slate-500 hover:text-[#F97316] transition"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 hover:border-[#F97316]/60 hover:text-[#F97316] transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" /> Elegir foto (JPG, PNG o WebP · máx. 5 MB)
                </button>
              )}
              <p className="text-[10px] text-slate-400">
                Es pública: se muestra en la planilla, en los pases y en la web de la liga.
              </p>
            </div>

            {/* Documentos obligatorios de inscripción */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-700">
                Documentos obligatorios (PDF o imagen · máx. 5 MB c/u)
              </label>
              {DOCUMENTOS_INSCRIPCION.map((doc) => {
                const archivo = documentos[doc.clave];
                return (
                  <div key={doc.clave} className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-600">
                      {doc.nombre}
                    </span>
                    {archivo ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                        <Paperclip className="w-3.5 h-3.5 text-green-700 shrink-0" />
                        <span className="flex-1 text-[11px] font-bold text-green-800 truncate">
                          {archivo.name}
                        </span>
                        <label className="text-[10px] font-bold text-slate-500 hover:text-[#F97316] transition cursor-pointer">
                          Cambiar
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) =>
                              setDocumentos((prev) => ({
                                ...prev,
                                [doc.clave]: e.target.files?.[0] ?? null,
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <label className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500 hover:border-[#F97316]/60 hover:text-[#F97316] transition flex items-center gap-2 cursor-pointer">
                        <Paperclip className="w-3.5 h-3.5" /> Adjuntar archivo
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) =>
                            setDocumentos((prev) => ({
                              ...prev,
                              [doc.clave]: e.target.files?.[0] ?? null,
                            }))
                          }
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Categoría: fija si se abrió desde un plantel */}
            {categoriaFija ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">Categoría</label>
                <p className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-sm font-bold text-[#1A2A44]">
                  {categoriaFija.name}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Categoría (tiene que tener plantel creado)
                </label>
                <select
                  value={categoriaId}
                  onChange={(e) => {
                    setCategoriaId(e.target.value);
                    setSubmitError(null);
                  }}
                  required
                  className={inputClass}
                >
                  <option value="">Elegí…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Nota sobre documentos */}
          <div className="flex items-start gap-2 p-3 bg-[#1A2A44]/5 text-slate-500 text-[11px] rounded-xl">
            <Info className="w-4 h-4 shrink-0 text-[#F97316]" />
            <span>
              El DNI es la identidad única del jugador en toda la liga: si ya fue
              inscripto por otro club, no se puede duplicar — corresponde un pase
              desde la pantalla de Trámites.
            </span>
          </div>

          {/* Error de guardado */}
          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Botón Guardar (fijo abajo del panel) */}
          <div className="mt-auto pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={cargando || categories.length === 0}
              className="w-full px-6 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 disabled:opacity-60 disabled:cursor-not-allowed text-white transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-[#F97316]/10"
            >
              {cargando ? (
                <LoaderCircle className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {cargando ? "Guardando..." : "Registrar Jugador"}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
