"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Inbox, Eye } from "lucide-react";

const MOCK_SENT = [
  { id: "s1", recipient: "Todos los Clubes", subject: "Cierre de inscripciones Torneo Apertura 2026", date: "2026-07-28", body: "Recordamos que las planillas de inscripción cierran de forma definitiva el día lunes..." },
  { id: "s2", recipient: "Árbitro Ortiz", subject: "Designación Fecha 5", date: "2026-07-30", body: "Ha sido asignado como árbitro principal para el partido Camioneros vs HAF." }
];

export default function EnviadosMessages() {
  const [sentList] = useState(MOCK_SENT);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentMsg = sentList.find((m) => m.id === selectedId);

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <Link href="/admin/mensajeria/bandeja" className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Mensajes Enviados</h2>
          <p className="text-slate-500 text-xs mt-0.5">Historial de comunicaciones salientes de la liga.</p>
        </div>
      </section>

      {/* Grid: Lista + Detalle */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Lista */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-y-auto shadow-sm divide-y divide-slate-100">
          {sentList.map((m) => (
            <div key={m.id} onClick={() => setSelectedId(m.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition flex flex-col gap-1 ${selectedId === m.id ? "bg-[#1A2A44]/5 border-l-4 border-[#F97316]" : ""}`}>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>Para: {m.recipient}</span>
                <span>{m.date}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-700 truncate">{m.subject}</h4>
            </div>
          ))}
        </div>

        {/* Detalle */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-y-auto flex flex-col justify-between">
          {currentMsg ? (
            <div className="flex flex-col gap-6">
              <div className="border-b pb-4">
                <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                  <span>Destinatario: {currentMsg.recipient}</span>
                  <span>{currentMsg.date}</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#1A2A44] mt-2 leading-snug">{currentMsg.subject}</h3>
              </div>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{currentMsg.body}</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Inbox className="w-8 h-8 text-slate-350" />
              <span>Selecciona un mensaje enviado para ver el detalle.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
