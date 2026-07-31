"use client";

import { Scale, AlertCircle } from "lucide-react";

const MOCK_SANCIONES = [
  { id: "s1", player: "Bautista Roldán", club: "Club Camioneros", offense: "Doble tarjeta amarilla", sanction: "1 Partido de suspensión", status: "Activa" },
  { id: "s2", player: "Marcos Pérez (DT)", club: "HAF Ushuaia", offense: "Insultos a la terna arbitral", sanction: "3 Partidos de suspensión y multa $15.000", status: "Activa" },
];

export default function TribunalAdmin() {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Scale className="w-7 h-7 text-[#F97316]" />
          Tribunal Disciplinario
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">Control de suspensiones, multas institucionales y fallos reglamentarios.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">Sancionado</th>
              <th className="py-2 px-2">Club</th>
              <th className="py-2 px-2">Infracción</th>
              <th className="py-2 px-2">Fallo / Sanción</th>
              <th className="py-2 px-2 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {MOCK_SANCIONES.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-bold text-[#1A2A44]">{s.player}</td>
                <td className="py-3 px-2 text-slate-550 font-semibold">{s.club}</td>
                <td className="py-3 px-2 text-slate-500 font-medium">{s.offense}</td>
                <td className="py-3 px-2 font-semibold text-[#F97316]">{s.sanction}</td>
                <td className="py-3 px-2 text-center">
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-red-50 text-red-750 rounded border border-red-150 inline-flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {s.status}
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
