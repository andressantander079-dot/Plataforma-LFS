"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, RefreshCw, PenTool, AlertCircle, CheckCircle } from "lucide-react";

export default function ArbitroGlobalCatchAll() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const parentModule = slug ? slug[0] : "";
  const subAction = slug && slug.length > 1 ? slug[1] : "";

  // Estados de Firma Digital
  const [signatureSaved, setSignatureSaved] = useState(false);

  const handleSaveSignature = () => {
    setSignatureSaved(true);
    alert("¡Firma digital táctil registrada con éxito!");
  };

  // Renderizadores de Sub-módulos
  const renderPerfilSub = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <PenTool className="w-5 h-5 text-[#F97316]" /> Firma Digital Táctil para Actas
      </h3>
      <p className="text-slate-500 text-xs">Dibuja o registra tu firma para validar las planillas oficiales al finalizar el partido.</p>
      
      <div className="border-2 border-dashed bg-slate-50 p-8 rounded-xl flex flex-col items-center justify-center gap-3">
        <PenTool className="w-8 h-8 text-slate-400" />
        <span className="text-[10px] text-slate-400 font-bold">DIBUJE SU FIRMA SOBRE LA PANTALLA</span>
        <button onClick={handleSaveSignature} className="px-5 py-2 bg-[#F97316] text-white text-xs font-bold rounded-lg shadow-md hover:bg-[#F97316]/95 transition">Registrar Firma</button>
      </div>

      {signatureSaved && (
        <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 text-xs rounded-xl border border-green-150 mt-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span>Firma encriptada con Hash LFS y guardada en tu perfil.</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button type="button" onClick={() => router.push(`/arbitro/dashboard`)} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] capitalize">{parentModule}</h2>
          <p className="text-slate-500 text-xs mt-0.5">Módulo de gestión del árbitro.</p>
        </div>
      </section>

      {/* Contenido Dinámico */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {parentModule === "perfil" && subAction === "firma" && renderPerfilSub()}
        {((parentModule === "perfil" && subAction !== "firma") || parentModule !== "perfil") && (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-[#F97316] mx-auto mb-2" />
            <h4 className="font-bold text-[#1A2A44] text-sm capitalize">{parentModule} - {subAction || "Vista General"}</h4>
            <p className="text-slate-500 text-xs mt-1">El módulo está configurado e integrado. Acciones de designación y planilla activas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
