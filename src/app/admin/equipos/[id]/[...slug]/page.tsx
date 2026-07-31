"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Wallet, TrendingUp, TrendingDown } from "lucide-react";

export default function EquiposSubPagesCatchAll() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.id as string;
  const slug = params.slug as string[];
  const subRoute = slug ? slug[0] : "";

  const clubName = "Club Camioneros Ushuaia";

  if (subRoute === "finanzas") {
    return (
      <div className="flex flex-col gap-6 max-w-4xl mx-auto">
        {/* Encabezado */}
        <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
          <button
            type="button"
            onClick={() => router.push("/admin/equipos")}
            className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-serif text-2xl font-black text-[#1A2A44]">
              Finanzas - {clubName}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Control de saldos, deudas y comprobantes de aranceles del club.</p>
          </div>
        </section>

        {/* Libro Financiero del Club */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border rounded-2xl p-5 shadow-sm">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Estado de Deuda</span>
            <span className="text-2xl font-serif font-black text-green-600 mt-2 block">AL DÍA</span>
            <p className="text-slate-400 text-[9px] font-medium mt-1">El club no registra deudas en la LFS.</p>
          </div>

          <div className="bg-white border rounded-2xl p-5 shadow-sm">
            <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Historial de Pagos</span>
            <div className="flex flex-col gap-2 mt-3 text-xs font-semibold text-slate-700">
              <div className="flex justify-between py-1.5 border-b">
                <span>Inscripción Torneo Apertura 2026</span>
                <span className="text-green-600 font-bold">+$15.000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div className="p-6">Sub-módulo de clubes no encontrado.</div>;
}
