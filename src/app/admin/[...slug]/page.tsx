"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react";

export default function AdminGlobalCatchAll() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  
  const parentModule = slug ? slug[0] : "";
  const subAction = slug && slug.length > 1 ? slug[1] : "";

  // Acción de redirección al módulo padre
  const handleGoBack = () => {
    if (parentModule) {
      router.push(`/admin/${parentModule}`);
    } else {
      router.push("/admin/dashboard");
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto mt-12 text-center items-center">
      <div className="w-16 h-16 bg-[#F97316]/10 text-[#F97316] rounded-full flex items-center justify-center shadow-inner">
        <AlertCircle className="w-8 h-8" />
      </div>

      <div>
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Módulo en Desarrollo / Redirección</span>
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] mt-2 capitalize">
          {parentModule} {subAction && ` - ${subAction}`}
        </h2>
        <p className="text-slate-500 text-xs mt-2 max-w-md mx-auto">
          Esta sección se encuentra enlazada y configurada en el panel de control. Serás redirigido al módulo principal correspondiente para continuar con las operaciones.
        </p>
      </div>

      <div className="flex gap-3 mt-4 w-full justify-center">
        <button
          onClick={handleGoBack}
          className="px-5 py-2.5 bg-[#1A2A44] hover:bg-[#1A2A44]/95 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a {parentModule || "Dashboard"}
        </button>
        <button
          onClick={() => router.push("/admin/dashboard")}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Volver al Inicio
        </button>
      </div>
    </div>
  );
}
