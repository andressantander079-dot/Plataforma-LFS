"use client";

import { ShieldCheck, Plus, CheckCircle } from "lucide-react";

const MOCK_ARBITROS = [
  { id: "a1", name: "Esteban Ortiz", category: "Nacional A", matches: 14, score: "9.2/10", status: "Habilitado" },
  { id: "a2", name: "Rogelio Gómez", category: "Nacional B", matches: 9, score: "8.5/10", status: "Habilitado" },
];

export default function ColegioArbitrosAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4 flex justify-between items-center">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-[#F97316]" />
            Colegio de Árbitros
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Control de registros, habilitaciones y calificaciones de árbitros.</p>
        </div>
        <button className="px-4 py-2 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1">
          <Plus className="w-4 h-4" /> Agregar Árbitro
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">Nombre</th>
              <th className="py-2 px-2">Categoría</th>
              <th className="py-2 px-2 text-center">Partidos Dirigidos</th>
              <th className="py-2 px-2 text-center">Evaluación Promedio</th>
              <th className="py-2 px-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {MOCK_ARBITROS.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-bold text-[#1A2A44]">{a.name}</td>
                <td className="py-3 px-2 text-slate-550 font-semibold">{a.category}</td>
                <td className="py-3 px-2 text-center text-slate-500 font-semibold">{a.matches}</td>
                <td className="py-3 px-2 text-center font-mono font-bold text-[#F97316]">{a.score}</td>
                <td className="py-3 px-2 text-center">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-green-50 text-green-700 rounded border border-green-150 inline-flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> {a.status}
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
