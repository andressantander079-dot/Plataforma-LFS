"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, CheckCircle, Clock, AlertTriangle } from "lucide-react";

const MOCK_TICKETS = [
  { id: "TK-100", club: "Club Camioneros", type: "Reclamo", title: "Cancha fecha 5 resbaladiza", status: "Abierto", date: "2026-07-31" },
  { id: "TK-101", club: "HAF Ushuaia", type: "Consulta", title: "Duda sobre arancel de pases de menor", status: "Cerrado", date: "2026-07-30" }
];

export default function TicketsList() {
  const [ticketsList, setTicketsList] = useState(MOCK_TICKETS);

  const handleResolveTicket = (id: string) => {
    setTicketsList(prev =>
      prev.map(tk => tk.id === id ? { ...tk, status: "Cerrado" } : tk)
    );
    alert("¡Ticket cerrado y notificado al club!");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <Link href="/admin/mensajeria/bandeja" className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Tickets de Incidencias</h2>
          <p className="text-slate-500 text-xs mt-0.5">Control de reclamos y consultas ingresados por delegados de clubes.</p>
        </div>
      </section>

      {/* Tabla de Incidencias */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="text-slate-400 font-bold uppercase border-b pb-2 text-left">
              <th className="py-2 px-2">Código</th>
              <th className="py-2 px-2">Club</th>
              <th className="py-2 px-2">Tipo</th>
              <th className="py-2 px-2">Detalle / Asunto</th>
              <th className="py-2 px-2">Fecha</th>
              <th className="py-2 px-2 text-center">Estado</th>
              <th className="py-2 px-2 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {ticketsList.map((tk) => (
              <tr key={tk.id} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-2 font-mono text-[#F97316] font-bold">{tk.id}</td>
                <td className="py-3 px-2 font-bold text-[#1A2A44]">{tk.club}</td>
                <td className="py-3 px-2">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                    tk.type === "Reclamo" ? "bg-red-50 text-red-650" : "bg-blue-50 text-blue-700"
                  }`}>{tk.type}</span>
                </td>
                <td className="py-3 px-2 text-slate-550 font-semibold">{tk.title}</td>
                <td className="py-3 px-2 text-slate-400 font-mono">{tk.date}</td>
                <td className="py-3 px-2 text-center">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 justify-center w-fit mx-auto ${
                    tk.status === "Abierto" ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"
                  }`}>
                    {tk.status === "Abierto" ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                    {tk.status}
                  </span>
                </td>
                <td className="py-3 px-2 text-right">
                  {tk.status === "Abierto" && (
                    <button onClick={() => handleResolveTicket(tk.id)} className="px-3 py-1 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg text-[10px] font-bold transition">
                      Resolver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
