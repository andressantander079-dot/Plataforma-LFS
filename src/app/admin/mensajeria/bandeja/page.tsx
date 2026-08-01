"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageSquare, Mail, MailOpen, Archive, Trash2, ShieldAlert, Filter, Plus } from "lucide-react";
import { validateAdminOperation } from "../../../../lib/security/adminGuard";

// Mock de Mensajes Iniciales
const INITIAL_MESSAGES = [
  { id: "m1", sender: "Club Camioneros", role: "club", subject: "Reclamo por reprogramación Fecha 5", body: "Solicitamos el cambio de horario debido a superposición de gimnasio.", importance: "Urgente", date: "2026-07-31", isRead: false },
  { id: "m2", sender: "HAF Ushuaia", role: "club", subject: "Comprobante de pago pase Lucas Aravena", body: "Adjuntamos el comprobante de transferencia bancaria de la FVF.", importance: "Común", date: "2026-07-30", isRead: true },
  { id: "m3", sender: "Árbitro Ortiz", role: "arbitro", subject: "Informe de Incidentes Fecha 4", body: "Hubo reclamos del DT visitante al finalizar el partido. Adjunto planilla.", importance: "Importante", date: "2026-07-29", isRead: false },
];

export default function BandejaInbox() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [activeTab, setActiveTab] = useState<"club" | "arbitro">("club");
  const [selectedId, setSelectedId] = useState<string | null>("m1");

  // Filtros
  const [filterSender, setFilterSender] = useState("");
  const [filterYear, setFilterYear] = useState("2026");

  // Estados de Borrado con PIN 9090
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const filtered = messages.filter((m) => {
    const matchesTab = m.role === activeTab;
    const matchesSender = m.sender.toLowerCase().includes(filterSender.toLowerCase());
    const matchesYear = m.date.startsWith(filterYear);
    return matchesTab && matchesSender && matchesYear;
  });

  const currentMsg = messages.find((m) => m.id === selectedId);

  const toggleRead = (id: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: !m.isRead } : m))
    );
  };

  const handleArchive = (id: string) => {
    // Soft delete: los movemos de la bandeja (en una app real iría a archived = true)
    setMessages((prev) => prev.filter((m) => m.id !== id));
    if (selectedId === id) setSelectedId(null);
    alert("¡Mensaje archivado indefinidamente!");
  };

  const initiateDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteCode("");
    setDeleteError("");
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    try {
      await validateAdminOperation(
        deleteCode,
        "9090",
        "admin",
        { userId: "admin-1", action: "DELETE_MESSAGE_BANDEJA", module: "MENSAJERIA", details: { messageId: deleteTargetId } },
        async (log) => console.log("[AUDIT]: Mensaje eliminado", log.details.messageId)
      );

      setMessages((prev) => prev.filter((m) => m.id !== deleteTargetId));
      if (selectedId === deleteTargetId) setSelectedId(null);
      setDeleteTargetId(null);
      alert("¡Mensaje eliminado físicamente y registrado en auditoría!");
    } catch (err: any) {
      setDeleteError(err.message || "Código de acceso incorrecto.");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-[#F97316]" />
            Bandeja de Entrada
          </h2>
          <p className="text-slate-500 text-sm mt-1">Mensajería y correspondencia formal de la liga LFS.</p>
        </div>
        <Link href="/admin/mensajeria/redactar" className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] text-white hover:bg-[#F97316]/95 transition text-xs shadow-lg shadow-[#F97316]/10">
          <Plus className="w-4 h-4" /> Redactar Mensaje
        </Link>
      </section>

      {/* Grid: Filtros + Inbox */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Lista de Mensajes y Filtros */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {/* Filtros */}
          <div className="p-3 bg-slate-50 border-b flex flex-col gap-2">
            <div className="flex gap-2">
              <input type="text" placeholder="Filtrar por remitente..." value={filterSender} onChange={e => setFilterSender(e.target.value)} className="bg-white border rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none" />
              <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="bg-white border rounded-lg px-2 text-xs focus:outline-none">
                <option value="2026">2026</option>
                <option value="2025">2025</option>
              </select>
            </div>
            {/* Tabs */}
            <div className="flex gap-2">
              <button onClick={() => { setActiveTab("club"); setSelectedId(null); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "club" ? "bg-white text-[#1A2A44] shadow" : "text-slate-500 hover:text-slate-800"}`}>Clubes</button>
              <button onClick={() => { setActiveTab("arbitro"); setSelectedId(null); }} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${activeTab === "arbitro" ? "bg-white text-[#1A2A44] shadow" : "text-slate-500 hover:text-slate-800"}`}>Árbitros</button>
            </div>
          </div>

          {/* Listado */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtered.map((m) => (
              <div key={m.id} onClick={() => setSelectedId(m.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition flex flex-col gap-1.5 ${selectedId === m.id ? "bg-[#1A2A44]/5 border-l-4 border-[#F97316]" : ""} ${!m.isRead ? "bg-slate-50/70" : ""}`}>
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>{m.sender}</span>
                  <span>{m.date}</span>
                </div>
                <h4 className={`text-xs truncate ${!m.isRead ? "font-black text-[#1A2A44]" : "text-slate-700"}`}>{m.subject}</h4>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${m.importance === "Urgente" ? "bg-red-50 text-red-650" : "bg-slate-100 text-slate-550"}`}>{m.importance}</span>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); toggleRead(m.id); }} className="p-1 hover:bg-slate-200 rounded text-slate-400 transition" title={m.isRead ? "Marcar como No Leído" : "Marcar como Leído"}>
                      {m.isRead ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleArchive(m.id); }} className="p-1 hover:bg-orange-50 hover:text-[#F97316] rounded text-slate-400 transition" title="Archivar"><Archive className="w-3.5 h-3.5" /></button>
                    <button onClick={(e) => { e.stopPropagation(); initiateDelete(m.id); }} className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-400 transition" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detalle del Mensaje */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm overflow-y-auto">
          {currentMsg ? (
            <div className="flex flex-col gap-6 h-full justify-between">
              <div>
                <div className="border-b pb-4 mb-4">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-bold">
                    <span>Remitente: {currentMsg.sender}</span>
                    <span>{currentMsg.date}</span>
                  </div>
                  <h3 className="font-serif text-xl font-bold text-[#1A2A44] mt-2 leading-snug">{currentMsg.subject}</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{currentMsg.body}</p>
              </div>

              <div className="border-t pt-4 flex justify-between gap-2">
                <button onClick={() => handleArchive(currentMsg.id)} className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-slate-50 transition text-slate-650 flex items-center gap-1.5"><Archive className="w-4 h-4" /> Archivar</button>
                <button onClick={() => initiateDelete(currentMsg.id)} className="px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5"><Trash2 className="w-4 h-4" /> Eliminar Seguro</button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Mail className="w-8 h-8 text-slate-350" />
              <span>Selecciona un mensaje de la bandeja para leer el contenido.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Borrado 9090 */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-center animate-in fade-in-50">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldAlert className="w-6 h-6" /></div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Confirmación de Borrado</h3>
              <p className="text-slate-500 text-xs mt-1">Esta acción requiere clave de seguridad institucional **"9090"**:</p>
            </div>
            <form onSubmit={confirmDelete} className="flex flex-col gap-3">
              <input type="password" placeholder="Clave LFS (9090)" value={deleteCode} onChange={e => setDeleteCode(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-base tracking-widest font-black focus:outline-none" />
              {deleteError && <span className="text-xs text-red-500 font-bold">{deleteError}</span>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setDeleteTargetId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#F97316] text-white hover:bg-[#F97316]/95 rounded-xl font-bold text-xs transition">Eliminar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
