"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileText,
  Search,
  FolderOpen,
  Pin,
  History,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileSpreadsheet,
  Image as ImageIcon,
  File as FileGenerico,
} from "lucide-react";
import type { DocumentoDescargaUI, VersionDescargaUI } from "@/lib/actions/descargas.actions";
import { obtenerUrlDescarga } from "@/lib/actions/descargas.actions";
import { CARPETAS_DESCARGAS, textoTamano } from "@/lib/core/rules/descargasRules";

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IconoFormato({ formato }: { formato: string }) {
  if (formato === "XLSX") return <FileSpreadsheet className="w-5 h-5" />;
  if (formato === "Imagen") return <ImageIcon className="w-5 h-5" />;
  if (formato === "PDF" || formato === "DOCX") return <FileText className="w-5 h-5" />;
  return <FileGenerico className="w-5 h-5" />;
}

function BotonDescargar({ version, principal = false }: { version: VersionDescargaUI; principal?: boolean }) {
  const [bajando, setBajando] = useState(false);

  async function descargar() {
    if (bajando) return;
    setBajando(true);
    const r = await obtenerUrlDescarga(version.id);
    setBajando(false);
    if (!r.ok || !r.url) {
      alert(r.error ?? "No pude generar el link de descarga. Probá de nuevo.");
      return;
    }
    window.open(r.url, "_blank", "noopener");
  }

  if (principal) {
    return (
      <button
        type="button"
        id={`btn-descargar-${version.id}`}
        onClick={descargar}
        disabled={bajando}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-md shadow-orange-500/20 text-sm disabled:opacity-50 shrink-0"
      >
        {bajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Descargar
      </button>
    );
  }

  return (
    <button
      type="button"
      id={`btn-descargar-${version.id}`}
      onClick={descargar}
      disabled={bajando}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-[#F97316] hover:text-white text-slate-600 transition text-xs disabled:opacity-50 shrink-0"
    >
      {bajando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      v{version.version}
    </button>
  );
}

function TarjetaDocumento({ doc }: { doc: DocumentoDescargaUI }) {
  const [historial, setHistorial] = useState(false);
  const vigente = doc.versiones.find((v) => v.version === doc.versionVigente) ?? doc.versiones[0];

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-50 border flex items-center justify-center text-[#1A2A44] shrink-0">
          <IconoFormato formato={vigente?.formato ?? ""} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-[#1A2A44] text-sm leading-tight">{doc.nombre}</h4>
            {doc.fijado && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 text-[#F97316]">
                <Pin className="w-3 h-3" /> Importante
              </span>
            )}
          </div>
          {doc.descripcion && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{doc.descripcion}</p>}
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
            {vigente && (
              <span>
                {vigente.formato} · {textoTamano(vigente.tamanoBytes)} · actualizado {formatearFecha(vigente.createdAt)}
              </span>
            )}
            <span>{doc.descargasTotal.toLocaleString("es-AR")} descargas</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {doc.versiones.length > 1 && (
            <button
              type="button"
              id={`btn-ver-versiones-${doc.id}`}
              onClick={() => setHistorial(!historial)}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-[#1A2A44] transition"
              title="Versiones anteriores"
            >
              {historial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
          {vigente && <BotonDescargar version={vigente} principal />}
        </div>
      </div>

      {/* Historial de versiones: PÚBLICO, cualquiera baja la versión que necesite */}
      {historial && doc.versiones.length > 1 && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3">
          <h5 className="text-[10px] font-black tracking-widest text-slate-400 uppercase mb-2 flex items-center gap-1">
            <History className="w-3 h-3" /> Versiones anteriores
          </h5>
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
                <span className="text-slate-400 shrink-0 hidden sm:inline">{formatearFecha(v.createdAt)}</span>
                <span className="text-slate-500 truncate flex-1">{v.notasVersion ?? "—"}</span>
                <span className="text-slate-400 shrink-0 hidden md:inline">{v.descargas} desc.</span>
                <BotonDescargar version={v} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Listado completo con buscador y carpetas (ámbito público o clubes). */
export function ListaDescargas({
  documentos,
  conBuscador = true,
}: {
  documentos: DocumentoDescargaUI[];
  conBuscador?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return documentos;
    return documentos.filter(
      (d) =>
        d.nombre.toLowerCase().includes(q) ||
        (d.descripcion ?? "").toLowerCase().includes(q)
    );
  }, [documentos, busqueda]);

  const porCarpeta = CARPETAS_DESCARGAS.map((carpeta) => ({
    carpeta,
    docs: filtrados.filter((d) => d.carpeta === carpeta),
  })).filter((g) => g.docs.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {conBuscador && (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            id="input-buscar-descarga"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar reglamento, boletín, formulario…"
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 focus:border-[#F97316]"
          />
        </div>
      )}

      {porCarpeta.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {busqueda ? "No encontramos documentos con esa búsqueda." : "Todavía no hay documentos disponibles."}
          </p>
        </div>
      ) : (
        porCarpeta.map(({ carpeta, docs }) => (
          <section key={carpeta}>
            <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase mb-3 flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-[#F97316]" />
              {carpeta}
            </h3>
            <div className="flex flex-col gap-3">
              {docs.map((doc) => (
                <TarjetaDocumento key={doc.id} doc={doc} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
