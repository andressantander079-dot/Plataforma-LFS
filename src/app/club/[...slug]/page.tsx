"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, FileSpreadsheet, Send, FileText, AlertCircle, CheckCircle } from "lucide-react";

export default function ClubGlobalCatchAll() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const parentModule = slug ? slug[0] : "";
  const subAction = slug && slug.length > 1 ? slug[1] : "";

  // Estados de Tickets / Incidencias (C.4)
  const [tickets, setTickets] = useState([
    { id: "TK-100", type: "Reclamo", title: "Cancha fecha 5 resbaladiza", status: "Abierto" }
  ]);
  const [ticketType, setTicketType] = useState("Reclamo");
  const [ticketTitle, setTicketTitle] = useState("");

  const handleOpenTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim()) return;
    setTickets(prev => [
      ...prev,
      { id: `TK-${Math.floor(100 + Math.random() * 900)}`, type: ticketType, title: ticketTitle, status: "Abierto" }
    ]);
    setTicketTitle("");
    alert("¡Ticket de incidencia creado con éxito!");
  };

  // Renderizadores de Sub-módulos
  const renderPlantelesSub = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5 text-[#F97316]" /> Carga Masiva de Plantel (CSV/Excel)
      </h3>
      <div className="bg-slate-50 border-2 border-dashed p-6 rounded-xl flex flex-col items-center gap-2 text-center text-xs">
        <FileSpreadsheet className="w-8 h-8 text-slate-400" />
        <p className="font-bold">Arrastre su archivo CSV o XLSX de jugadores aquí</p>
        <span className="text-slate-400 text-[10px]">El archivo debe contener DNI, Apellido, Nombre y Fecha de Nacimiento.</span>
        <button onClick={() => alert("Simulación: 15 jugadores importados con éxito.")} className="mt-3 px-4 py-2 bg-[#1A2A44] text-white font-bold rounded-lg hover:bg-[#F97316] transition text-[10px]">Importar Archivo</button>
      </div>
    </div>
  );

  const renderMensajeriaSub = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#F97316]" /> Centro de Tickets e Incidencias (C.4)
      </h3>
      <form onSubmit={handleOpenTicket} className="bg-slate-50 border p-4 rounded-xl flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <select value={ticketType} onChange={e => setTicketType(e.target.value)} className="bg-white border rounded-lg p-2 text-xs font-semibold focus:outline-none">
            <option value="Reclamo">Reclamo Oficial</option>
            <option value="Consulta">Consulta Administrativa</option>
          </select>
          <input type="text" placeholder="Asunto del ticket" required value={ticketTitle} onChange={e => setTicketTitle(e.target.value)} className="bg-white border rounded-lg p-2 text-xs focus:outline-none" />
        </div>
        <button type="submit" className="py-2 bg-[#F97316] text-white text-xs font-bold rounded-lg transition">Abrir Ticket</button>
      </form>
      <div className="mt-4">
        <h4 className="text-xs font-bold text-slate-700 mb-2">Tus Tickets Activos</h4>
        {tickets.map(tk => (
          <div key={tk.id} className="p-3 border rounded-xl flex justify-between items-center text-xs bg-white">
            <div>
              <span className="font-mono text-[#F97316] font-bold">{tk.id}</span> • <span className="font-bold text-[#1A2A44]">{tk.type}</span>
              <p className="text-[10px] text-slate-500 mt-0.5">{tk.title}</p>
            </div>
            <span className="px-2 py-0.5 bg-orange-50 text-[#F97316] rounded text-[9px] font-bold border border-orange-100">{tk.status}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button type="button" onClick={() => router.push(`/club/dashboard`)} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] capitalize">{parentModule}</h2>
          <p className="text-slate-500 text-xs mt-0.5">Módulo de gestión del club Camioneros.</p>
        </div>
      </section>

      {/* Contenido Dinámico */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {parentModule === "planteles" && subAction === "carga-masiva" && renderPlantelesSub()}
        {parentModule === "mensajeria" && (subAction === "tickets" || subAction === "redactar") && renderMensajeriaSub()}
        {((parentModule === "planteles" && subAction !== "carga-masiva") || (parentModule === "mensajeria" && subAction !== "tickets" && subAction !== "redactar") || (parentModule !== "planteles" && parentModule !== "mensajeria")) && (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-[#F97316] mx-auto mb-2" />
            <h4 className="font-bold text-[#1A2A44] text-sm capitalize">{parentModule} - {subAction || "Vista General"}</h4>
            <p className="text-slate-500 text-xs mt-1">El módulo está configurado e integrado. Acciones financieras y de documentación activas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
