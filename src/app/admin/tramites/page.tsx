"use client";

import Link from "next/link";
import { ClipboardList, Eye, CheckCircle, ArrowRight } from "lucide-react";

const MOCK_TRAMITES = [
  { id: "t-100", player: "Lucas Aravena", type: "Pase de Club", origin: "HAF Ushuaia", dest: "Club Camioneros", status: "Revisión FVF" },
  { id: "t-101", player: "Mateo Roldán", type: "Inscripción Nueva", origin: "N/A", dest: "Club Galicia", status: "Aprobado" },
];

export default function TramitesAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <ClipboardList className="w-7 h-7 text-[#F97316]" />
          Trámites y Fichajes
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Auditoría y control de pases interclubes y altas de jugadores.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">ID</th>
              <th className="py-2 px-2">Jugador</th>
              <th className="py-2 px-2">Tipo</th>
              <th className="py-2 px-2">Origen $\rightarrow$ Destino</th>
              <th className="py-2 px-2">Estado</th>
              <th className="py-2 px-2 text-right">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {MOCK_TRAMITES.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-mono text-[#F97316] font-bold">{t.id}</td>
                <td className="py-3 px-2 font-bold text-[#1A2A44]">{t.player}</td>
                <td className="py-3 px-2 text-slate-550 font-semibold">{t.type}</td>
                <td className="py-3 px-2 font-semibold text-slate-500 flex items-center gap-1.5">
                  <span>{t.origin}</span>
                  <ArrowRight className="w-3 h-3 text-[#F97316]" />
                  <span>{t.dest}</span>
                </td>
                <td className="py-3 px-2">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${
                    t.status === "Aprobado" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"
                  }`}>{t.status}</span>
                </td>
                <td className="py-3 px-2 text-right">
                  <Link href={`/admin/tramites/pases/${t.id}`} className="px-3 py-1 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Auditoría
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
