"use client";

import { useState } from "react";
import { Download, FileText, FileSpreadsheet, Image as ImageIcon, Search, FolderOpen, ArrowRight } from "lucide-react";

// Mock de Documentos Organizador por Carpetas
const MOCK_FILES = [
  // Reglamentos
  {
    id: "f1",
    name: "Reglamento General Oficial LFS 2026",
    category: "Reglamentos",
    format: "PDF",
    size: "1.4 MB",
    updatedAt: "2026-03-15",
  },
  {
    id: "f2",
    name: "Reglamento Disciplinario y Sanciones",
    category: "Reglamentos",
    format: "PDF",
    size: "820 KB",
    updatedAt: "2026-03-20",
  },
  // Boletines
  {
    id: "f3",
    name: "Boletín Oficial N° 12 - Resoluciones del Tribunal",
    category: "Boletines",
    format: "PDF",
    size: "450 KB",
    updatedAt: "2026-07-28",
  },
  {
    id: "f4",
    name: "Boletín Oficial N° 11 - Programación Fecha 5",
    category: "Boletines",
    format: "PDF",
    size: "620 KB",
    updatedAt: "2026-07-25",
  },
  // Formularios
  {
    id: "f5",
    name: "Planilla de Inscripción de Plantel Masivo (Template)",
    category: "Formularios",
    format: "XLSX",
    size: "120 KB",
    updatedAt: "2026-04-01",
  },
  {
    id: "f6",
    name: "Formulario de Alta de Jugador Individual",
    category: "Formularios",
    format: "DOCX",
    size: "85 KB",
    updatedAt: "2026-04-05",
  },
  {
    id: "f7",
    name: "Declaración Jurada de Salud y Ficha Médica LFS",
    category: "Formularios",
    format: "PDF",
    size: "340 KB",
    updatedAt: "2026-04-10",
  },
];

export default function DescargasPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = ["Todos", "Reglamentos", "Boletines", "Formularios"];

  const filteredFiles = MOCK_FILES.filter((file) => {
    const matchesCategory = selectedCategory === "Todos" || file.category === selectedCategory;
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getFormatIcon = (format: string) => {
    switch (format) {
      case "XLSX":
        return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case "DOCX":
        return <FileText className="w-5 h-5 text-blue-500" />;
      case "JPG":
      case "PNG":
        return <ImageIcon className="w-5 h-5 text-purple-500" />;
      default:
        return <FileText className="w-5 h-5 text-red-500" />;
    }
  };

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      
      {/* Encabezado */}
      <section className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-[#F97316]" />
            Centro de Descargas
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Encuentra y descarga los reglamentos oficiales, boletines del tribunal y formularios de inscripción.
          </p>
        </div>
      </section>

      {/* Barra de Búsqueda y Filtros de Carpeta */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        
        {/* Buscador */}
        <div className="relative md:col-span-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-[#1A2A44] font-medium focus:outline-none focus:ring-1 focus:ring-[#F97316]"
          />
        </div>

        {/* Categorías */}
        <div className="md:col-span-2 flex flex-wrap gap-2 justify-start md:justify-end">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl font-bold text-xs border transition ${
                selectedCategory === cat
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

      </section>

      {/* Lista de Documentos */}
      <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
        
        {filteredFiles.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No se encontraron documentos en esta categoría con el nombre indicado.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/30 transition px-2 rounded-lg"
              >
                {/* Nombre y Formato */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-inner mt-0.5">
                    {getFormatIcon(file.format)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[#1A2A44] text-base leading-snug">
                      {file.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                        {file.category}
                      </span>
                      <span>•</span>
                      <span>Formato: {file.format}</span>
                      <span>•</span>
                      <span>Peso: {file.size}</span>
                      <span>•</span>
                      <span>Actualizado: {file.updatedAt}</span>
                    </div>
                  </div>
                </div>

                {/* Botón de Descarga */}
                <button
                  type="button"
                  id={`btn-download-${file.id}`}
                  onClick={() => alert(`Simulando descarga de: ${file.name}`)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold bg-[#1A2A44] hover:bg-[#F97316] text-white hover:text-white transition flex items-center justify-center gap-2 text-xs shadow-md shadow-slate-900/5 group"
                >
                  <Download className="w-4 h-4 text-slate-300 group-hover:text-white" />
                  Descargar
                </button>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* Widget Aclaratorio para Clubes */}
      <section className="bg-slate-50 border border-slate-200/60 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h4 className="font-serif text-base font-bold text-[#1A2A44]">¿Eres Delegado de un Club?</h4>
          <p className="text-slate-500 text-xs mt-0.5">
            Recuerda que para dar de alta jugadores debes usar el template XLSX masivo y cargarlo dentro de tu panel de club.
          </p>
        </div>
        <button
          onClick={() => alert("Simulando redirección a panel de clubes")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F97316] hover:text-[#1A2A44] transition"
        >
          Ir a Planteles 
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </section>

    </div>
  );
}
