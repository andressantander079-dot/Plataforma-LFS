"use client";

import { useState } from "react";
import { Users, Plus, FileSpreadsheet, CheckCircle } from "lucide-react";

export default function ClubPlanteles() {
  const [players, setPlayers] = useState([
    { dni: "44111222", name: "Lucas Aravena", categories: ["Primera", "Sub-18"], status: "Habilitado" },
    { dni: "45222333", name: "Bautista Roldán", categories: ["Sub-18"], status: "Habilitado" },
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Users className="w-7 h-7 text-[#F97316]" />
            Plantel y Fichas de Jugadores
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Control interno del plantel de jugadores habilitados para competir.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 hover:bg-slate-200 transition">
            <FileSpreadsheet className="w-4 h-4 text-green-600" /> Carga Masiva (CSV)
          </button>
          <button className="flex-1 sm:flex-none px-4 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 hover:bg-[#F97316]/95 transition shadow-md">
            <Plus className="w-4 h-4" /> Inscribir Jugador
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">Jugador</th>
              <th className="py-2 px-2">DNI</th>
              <th className="py-2 px-2">Categorías</th>
              <th className="py-2 px-2 text-center">Estado LFS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {players.map((p) => (
              <tr key={p.dni} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-bold text-[#1A2A44]">{p.name}</td>
                <td className="py-3 px-2 font-mono text-slate-500">{p.dni}</td>
                <td className="py-3 px-2">
                  <div className="flex flex-wrap gap-1">
                    {p.categories.map((c) => (
                      <span key={c} className="px-2 py-0.5 rounded-full bg-[#1A2A44]/5 text-[#1A2A44] text-[9px] font-bold">{c}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-2 text-center">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-150 inline-flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {p.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
