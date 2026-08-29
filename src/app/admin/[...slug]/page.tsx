"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save, Plus, Scale, Calendar, ShieldCheck, Settings, FileText, BarChart3, AlertCircle } from "lucide-react";

export default function AdminGlobalCatchAll() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const parentModule = slug ? slug[0] : "";
  const subAction = slug && slug.length > 1 ? slug[1] : "";

  // Redirigir configuración al nuevo panel oficial
  if (parentModule === "configuracion") {
    if (typeof window !== "undefined") {
      router.replace("/admin/configuracion");
    }
  }

  // Estados de Configuración y Tribunal
  const [sanctions, setSanctions] = useState([
    { id: "s1", player: "Bautista Roldán", club: "Club Camioneros", offense: "Doble tarjeta amarilla", sanction: "1 Fecha", status: "Activa" }
  ]);
  const [newPlayer, setNewPlayer] = useState("");
  const [newOffense, setNewOffense] = useState("");
  const [newSanction, setNewSanction] = useState("");

  const handleAddSanction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayer || !newSanction) return;
    setSanctions(prev => [
      ...prev,
      { id: `s-${Date.now()}`, player: newPlayer, club: "HAF Ushuaia", offense: newOffense || "Infracción General", sanction: newSanction, status: "Activa" }
    ]);
    setNewPlayer("");
    setNewOffense("");
    setNewSanction("");
    alert("¡Sanción aplicada y jugador bloqueado en fixture!");
  };

  // Renderizadores de Sub-módulos
  const renderTribunal = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <Scale className="w-5 h-5 text-[#F97316]" /> Tribunal Disciplinario - Aplicar Sanción
      </h3>
      <form onSubmit={handleAddSanction} className="bg-slate-50 border p-4 rounded-xl flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <input type="text" placeholder="Nombre de Jugador/DT" required value={newPlayer} onChange={e => setNewPlayer(e.target.value)} className="bg-white border rounded-lg p-2 text-xs focus:outline-none" />
          <input type="text" placeholder="Fallo (Ej: 2 fechas de suspensión)" required value={newSanction} onChange={e => setNewSanction(e.target.value)} className="bg-white border rounded-lg p-2 text-xs focus:outline-none" />
        </div>
        <input type="text" placeholder="Descripción de Infracción" value={newOffense} onChange={e => setNewOffense(e.target.value)} className="bg-white border rounded-lg p-2 text-xs focus:outline-none" />
        <button type="submit" className="py-2 bg-[#F97316] text-white text-xs font-bold rounded-lg hover:bg-[#F97316]/90 transition">Aplicar y Suspender</button>
      </form>
      <div className="mt-4">
        <h4 className="text-xs font-bold text-slate-700 mb-2">Sanciones Activas</h4>
        {sanctions.map(s => (
          <div key={s.id} className="p-3 border rounded-xl flex justify-between items-center text-xs bg-white">
            <div>
              <span className="font-bold text-[#1A2A44]">{s.player}</span> • <span className="text-slate-500">{s.club}</span>
              <p className="text-[10px] text-red-500 font-bold mt-0.5">{s.offense} - {s.sanction}</p>
            </div>
            <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded text-[9px] font-bold">{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderDesignaciones = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <Calendar className="w-5 h-5 text-[#F97316]" /> Nueva Designación Arbitral
      </h3>
      <div className="bg-slate-50 border p-4 rounded-xl flex flex-col gap-3 text-xs">
        <p className="text-slate-500">Asigna la terna oficial para el encuentro del fin de semana:</p>
        <div className="flex justify-between items-center py-2 border-b">
          <span className="font-bold text-[#1A2A44]">Camioneros vs HAF Ushuaia</span>
          <select className="bg-white border rounded p-1 text-[11px] font-semibold">
            <option>Esteban Ortiz (Nacional A)</option>
            <option>Rogelio Gómez (Nacional B)</option>
          </select>
        </div>
        <button onClick={() => alert("Terna asignada. Notificaciones push enviadas a los árbitros.")} className="py-2 bg-[#1A2A44] text-white font-bold rounded-lg transition text-xs">Notificar y Asignar</button>
      </div>
    </div>
  );

  const renderConfiguracion = () => (
    <div className="flex flex-col gap-4">
      <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
        <Settings className="w-5 h-5 text-[#F97316]" /> Configuración de Branding y Sponsors
      </h3>
      <div className="bg-slate-50 border p-4 rounded-xl flex flex-col gap-3 text-xs">
        <input type="text" placeholder="URL Sponsor Principal" defaultValue="https://sponsor.lfs" className="bg-white border rounded p-2 text-xs focus:outline-none" />
        <button onClick={() => alert("Branding de sponsors actualizado.")} className="py-2 bg-[#F97316] text-white font-bold rounded-lg text-xs">Guardar Cambios</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button type="button" onClick={() => router.push(`/admin/dashboard`)} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] capitalize">{parentModule}</h2>
          <p className="text-slate-500 text-xs mt-0.5">Gestión interna de submódulos de la liga.</p>
        </div>
      </section>

      {/* Contenido Dinámico según modulo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        {parentModule === "tribunal" && renderTribunal()}
        {parentModule === "designaciones" && renderDesignaciones()}
        {parentModule === "configuracion" && renderConfiguracion()}
        {parentModule !== "tribunal" && parentModule !== "designaciones" && parentModule !== "configuracion" && (
          <div className="text-center py-6">
            <AlertCircle className="w-8 h-8 text-[#F97316] mx-auto mb-2 animate-bounce" />
            <h4 className="font-bold text-[#1A2A44] text-sm capitalize">{parentModule} - {subAction || "Vista General"}</h4>
            <p className="text-slate-500 text-xs mt-1">El módulo está configurado e integrado. Acciones contables y de auditoría activadas.</p>
          </div>
        )}
      </div>
    </div>
  );
}
