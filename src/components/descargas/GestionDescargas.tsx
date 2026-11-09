"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Pin,
  ArrowUp,
  ArrowDown,
  History,
  Upload,
  FileText,
  EyeOff,
  Eye,
  Loader2,
  ChevronDown,
  FolderOpen,
} from "lucide-react";
import type {
  DocumentoDescargaUI,
  GestionDescargas as Gestion,
  VersionDescargaUI,
} from "@/lib/actions/descargas.actions";
import {
  guardarDocumento,
  eliminarDocumento,
  alternarDocumentoActivo,
  moverDocumento,
  subirNuevaVersion,
  eliminarVersion,
} from "@/lib/actions/descargas.actions";
import { CARPETAS_DESCARGAS, textoTamano, type CarpetaDescarga } from "@/lib/core/rules/descargasRules";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface FormDoc {
  id?: string;
  nombre: string;
  carpeta: CarpetaDescarga;
  descripcion: string;
  fijado: boolean;
  orden: number;
}

const FORM_VACIO: FormDoc = {
  nombre: "",
  carpeta: "Reglamentos",
  descripcion: "",
  fijado: false,
  orden: 100,
};

export function GestionDescargas({ gestion }: { gestion: Gestion }) {
  const router = useRouter();
  const [form, setForm] = useState<FormDoc | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [historialAbierto, setHistorialAbierto] = useState<string | null>(null);
  const inputVersionRef = useRef<HTMLInputElement>(null);
  const [docParaVersion, setDocParaVersion] = useState<DocumentoDescargaUI | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form || ocupado) return;
    setOcupado("form");
    setErrorForm(null);
    const r = await guardarDocumento({
      id: form.id,
      ambito: gestion.ambito,
      carpeta: form.carpeta,
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      fijado: form.fijado,
      orden: form.orden,
    });
    setOcupado(null);
    if (!r.ok) {
      setErrorForm(r.error ?? "No se pudo guardar.");
      return;
    }
    const eraNuevo = !form.id;
    setForm(null);
    router.refresh();
    if (eraNuevo) {
      alert("Documento creado. Ahora subí su primer archivo con el botón “Subir versión”.");
    }
  }

  async function borrar(doc: DocumentoDescargaUI) {
    if (
      !confirm(
        `¿Borrar "${doc.nombre}" con TODO su historial de versiones? Esta acción no se puede deshacer.`
      )
    )
      return;
    setOcupado(doc.id);
    const r = await eliminarDocumento(doc.id);
    setOcupado(null);
    if (!r.ok) alert(r.error ?? "No se pudo borrar.");
    router.refresh();
  }

  async function alternar(doc: DocumentoDescargaUI) {
    setOcupado(doc.id);
    await alternarDocumentoActivo(doc.id, !doc.activo);
    setOcupado(null);
    router.refresh();
  }

  async function mover(doc: DocumentoDescargaUI, direccion: "arriba" | "abajo") {
    setOcupado(doc.id);
    await moverDocumento(doc.id, direccion);
    setOcupado(null);
    router.refresh();
  }

  function iniciarSubida(doc: DocumentoDescargaUI) {
    setDocParaVersion(doc);
    inputVersionRef.current?.click();
  }

  async function alElegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    const doc = docParaVersion;
    if (inputVersionRef.current) inputVersionRef.current.value = "";
    if (!archivo || !doc) return;

    const notas = prompt(
      `Vas a subir la versión ${doc.versionVigente + 1} de "${doc.nombre}".\n\nNotas de la versión (opcional, ej.: "Actualización marzo 2026"):`
    );
    if (notas === null) {
      setDocParaVersion(null);
      return;
    }

    setOcupado(doc.id);
    const fd = new FormData();
    fd.append("documentoId", doc.id);
    fd.append("notas", notas);
    fd.append("archivo", archivo);
    const r = await subirNuevaVersion(fd);
    setOcupado(null);
    setDocParaVersion(null);
    if (!r.ok) {
      alert(r.error ?? "No se pudo subir la versión.");
      return;
    }
    router.refresh();
  }

  async function borrarVersion(doc: DocumentoDescargaUI, v: VersionDescargaUI) {
    if (!confirm(`¿Borrar la versión ${v.version} de "${doc.nombre}"?`)) return;
    setOcupado(doc.id);
    const r = await eliminarVersion(v.id);
    setOcupado(null);
    if (!r.ok) alert(r.error ?? "No se pudo borrar la versión.");
    router.refresh();
  }

  const porCarpeta = CARPETAS_DESCARGAS.map((carpeta) => ({
    carpeta,
    docs: gestion.documentos.filter((d) => d.carpeta === carpeta),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Barra superior */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">
          {gestion.documentos.length} documento{gestion.documentos.length === 1 ? "" : "s"} ·{" "}
          {gestion.totalDescargas.toLocaleString("es-AR")} descargas acumuladas
        </p>
        <button
          id={`btn-nuevo-documento-${gestion.ambito}`}
          onClick={() => { setForm(FORM_VACIO); setErrorForm(null); }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-orange-500/25 text-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo documento
        </button>
      </div>

      {/* Formulario alta/edición */}
      {form && (
        <form
          onSubmit={guardar}
          className="bg-white border-2 border-[#F97316]/30 rounded-2xl p-5 shadow-md flex flex-col gap-4"
        >
          <h3 className="font-serif font-bold text-[#1A2A44]">
            {form.id ? "Editar documento" : "Nuevo documento"}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="input-doc-nombre" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Nombre <span className="text-rose-500">*</span>
              </label>
              <input
                id="input-doc-nombre"
                type="text"
                value={form.nombre}
                onChange={(e) => setForm((f) => f && { ...f, nombre: e.target.value })}
                placeholder="Ej.: Reglamento General Oficial LFS 2026"
                maxLength={140}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
              />
            </div>

            <div>
              <label htmlFor="select-doc-carpeta" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Carpeta
              </label>
              <select
                id="select-doc-carpeta"
                value={form.carpeta}
                onChange={(e) => setForm((f) => f && { ...f, carpeta: e.target.value as CarpetaDescarga })}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316] bg-white"
              >
                {CARPETAS_DESCARGAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="input-doc-orden" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Orden (menor = primero)
              </label>
              <input
                id="input-doc-orden"
                type="number"
                value={form.orden}
                onChange={(e) => setForm((f) => f && { ...f, orden: Number(e.target.value) })}
                min={0}
                max={9999}
                className="w-28 px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="input-doc-descripcion" className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1">
                Descripción <span className="text-slate-400 normal-case font-medium">(opcional)</span>
              </label>
              <input
                id="input-doc-descripcion"
                type="text"
                value={form.descripcion}
                onChange={(e) => setForm((f) => f && { ...f, descripcion: e.target.value })}
                placeholder="Breve aclaración para quien lo descarga…"
                maxLength={280}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none md:col-span-2">
              <input
                id="check-doc-fijado"
                type="checkbox"
                checked={form.fijado}
                onChange={(e) => setForm((f) => f && { ...f, fijado: e.target.checked })}
                className="w-4 h-4 rounded accent-[#F97316]"
              />
              <span className="text-sm font-semibold text-[#1A2A44] flex items-center gap-1.5">
                <Pin className="w-4 h-4 text-[#F97316]" />
                Fijado arriba de su carpeta
              </span>
            </label>
          </div>

          {errorForm && <p className="text-xs text-rose-600 font-semibold">{errorForm}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              id="btn-guardar-documento"
              disabled={ocupado === "form"}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition text-sm disabled:opacity-50"
            >
              {ocupado === "form" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {form.id ? "Guardar cambios" : "Crear documento"}
            </button>
            <button
              type="button"
              id="btn-cancelar-documento"
              onClick={() => { setForm(null); setErrorForm(null); }}
              className="px-5 py-2.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 transition text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Input de archivo oculto para "subir versión" */}
      <input
        ref={inputVersionRef}
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
        onChange={alElegirArchivo}
      />

      {/* Documentos por carpeta */}
      {porCarpeta.map(({ carpeta, docs }) => (
        <section key={carpeta}>
          <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            {carpeta}
            <span className="text-slate-300">({docs.length})</span>
          </h3>

          {docs.length === 0 ? (
            <p className="text-xs text-slate-400 italic mb-4 pl-6">Sin documentos en esta carpeta.</p>
          ) : (
            <div className="flex flex-col gap-3 mb-4">
              {docs.map((doc, idx) => {
                const vigente = doc.versiones.find((v) => v.version === doc.versionVigente);
                return (
                  <div
                    key={doc.id}
                    className={`bg-white border rounded-2xl shadow-sm transition ${
                      doc.activo ? "border-slate-200/80" : "border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-[#1A2A44] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-[#1A2A44] text-sm">{doc.nombre}</h4>
                          {doc.fijado && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 text-[#F97316]">
                              <Pin className="w-3 h-3" /> Fijado
                            </span>
                          )}
                          {!doc.activo && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">
                              Oculto
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                          {doc.descripcion && <span className="truncate max-w-md">{doc.descripcion}</span>}
                          <span>
                            {doc.versiones.length === 0
                              ? "Sin archivos todavía"
                              : `v${doc.versionVigente} vigente · ${doc.versiones.length} versión${doc.versiones.length === 1 ? "" : "es"}`}
                          </span>
                          <span>{doc.descargasTotal.toLocaleString("es-AR")} descargas</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 flex-wrap">
                        <button
                          id={`btn-subir-version-${doc.id}`}
                          onClick={() => iniciarSubida(doc)}
                          disabled={ocupado === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-orange-50 hover:text-[#F97316] transition disabled:opacity-40"
                          title={`Subir versión ${doc.versionVigente + 1}`}
                        >
                          {ocupado === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </button>
                        <button
                          id={`btn-historial-${doc.id}`}
                          onClick={() => setHistorialAbierto(historialAbierto === doc.id ? null : doc.id)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1A2A44] transition"
                          title="Historial de versiones"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-mover-arriba-${doc.id}`}
                          onClick={() => mover(doc, "arriba")}
                          disabled={idx === 0 || ocupado === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition disabled:opacity-30"
                          title="Subir en la lista"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-mover-abajo-${doc.id}`}
                          onClick={() => mover(doc, "abajo")}
                          disabled={idx === docs.length - 1 || ocupado === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition disabled:opacity-30"
                          title="Bajar en la lista"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-editar-doc-${doc.id}`}
                          onClick={() =>
                            setForm({
                              id: doc.id,
                              nombre: doc.nombre,
                              carpeta: doc.carpeta,
                              descripcion: doc.descripcion ?? "",
                              fijado: doc.fijado,
                              orden: doc.orden,
                            })
                          }
                          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#1A2A44] transition"
                          title="Editar datos"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          id={`btn-alternar-doc-${doc.id}`}
                          onClick={() => alternar(doc)}
                          disabled={ocupado === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-amber-50 hover:text-amber-600 transition disabled:opacity-40"
                          title={doc.activo ? "Ocultar del público" : "Mostrar de nuevo"}
                        >
                          {doc.activo ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button
                          id={`btn-borrar-doc-${doc.id}`}
                          onClick={() => borrar(doc)}
                          disabled={ocupado === doc.id}
                          className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition disabled:opacity-40"
                          title="Borrar documento e historial"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Historial de versiones desplegable */}
                    {historialAbierto === doc.id && (
                      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/60 rounded-b-2xl">
                        <h5 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-1">
                          <History className="w-3 h-3" /> Historial completo de versiones
                        </h5>
                        {doc.versiones.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">
                            Todavía no subiste ningún archivo. Usá el botón <Upload className="w-3 h-3 inline" /> para cargar la versión 1.
                          </p>
                        ) : (
                          <ul className="flex flex-col gap-1.5">
                            {doc.versiones.map((v) => (
                              <li
                                key={v.id}
                                className={`flex items-center gap-3 text-xs rounded-lg px-3 py-2 ${
                                  v.version === doc.versionVigente
                                    ? "bg-orange-50 border border-[#F97316]/30"
                                    : "bg-white border border-slate-200/60"
                                }`}
                              >
                                <span className="font-black text-[#1A2A44] w-10 shrink-0">v{v.version}</span>
                                <span className="text-slate-500 shrink-0">{v.formato}</span>
                                <span className="text-slate-400 shrink-0">{textoTamano(v.tamanoBytes)}</span>
                                <span className="text-slate-400 shrink-0 hidden sm:inline">{formatearFecha(v.createdAt)}</span>
                                <span className="text-slate-500 truncate flex-1">{v.notasVersion ?? ""}</span>
                                <span className="text-slate-400 shrink-0">{v.descargas} desc.</span>
                                {v.version === doc.versionVigente && (
                                  <span className="text-[9px] font-black uppercase text-[#F97316] shrink-0">Vigente</span>
                                )}
                                {doc.versiones.length > 1 && (
                                  <button
                                    id={`btn-borrar-version-${v.id}`}
                                    onClick={() => borrarVersion(doc, v)}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 transition shrink-0"
                                    title="Borrar esta versión"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}

      {gestion.documentos.length === 0 && !form && (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            No hay documentos en este ámbito. Creá el primero con <b>“Nuevo documento”</b>.
          </p>
        </div>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <ChevronDown className="w-3 h-3" />
        Tip: el <b>historial completo de versiones es visible para todos</b> — los clubes y el público pueden descargar cualquier versión anterior.
      </p>
    </div>
  );
}
