"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Archive, Trash2, ShieldAlert } from "lucide-react";
import { validateAdminOperation } from "../../../../lib/security/adminGuard";

const MOCK_ARCHIVED = [
  { id: "a1", sender: "Club Galicia", subject: "Prórroga entrega de fichas médicas", date: "2026-07-20", body: "Solicitamos una prórroga para la presentación de fichas médicas debido a demora en turnos de hospitales." }
];

export default function ArchivadosMessages() {
  const [archivedList, setArchivedList] = useState(MOCK_ARCHIVED);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Estados de Borrado con PIN 9090
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const currentMsg = archivedList.find((m) => m.id === selectedId);

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
        { userId: "admin-1", action: "DELETE_ARCHIVED_MESSAGE", module: "MENSAJERIA", details: { messageId: deleteTargetId } },
        async (log) => console.log("[AUDIT]: Mensaje archivado eliminado permanentemente:", log.details.messageId)
      );

      setArchivedList((prev) => prev.filter((m) => m.id !== deleteTargetId));
      if (selectedId === deleteTargetId) setSelectedId(null);
      setDeleteTargetId(null);
      alert("¡Mensaje eliminado permanentemente y auditado!");
    } catch (err: any) {
      setDeleteError(err.message || "Código incorrecto.");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <Link href="/admin/mensajeria/bandeja" className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Mensajes Archivados</h2>
          <p className="text-slate-500 text-xs mt-0.5">Historial indefinido de correspondencia archivada.</p>
        </div>
      </section>

      {/* Grid: Lista + Detalle */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Lista */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-y-auto shadow-sm divide-y divide-slate-100">
          {archivedList.map((m) => (
            <div key={m.id} onClick={() => setSelectedId(m.id)} className={`p-4 cursor-pointer hover:bg-slate-50 transition flex flex-col gap-1 ${selectedId === m.id ? "bg-[#1A2A44]/5 border-l-4 border-[#F97316]" : ""}`}>
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span>De: {m.sender}</span>
                <span>{m.date}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-700 truncate">{m.subject}</h4>
            </div>
          ))}
        </div>

        {/* Detalle */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-y-auto flex flex-col justify-between">
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
              <div className="border-t pt-4">
                <button onClick={() => initiateDelete(currentMsg.id)} className="w-full py-2.5 bg-red-50 hover:bg-red-600 text-red-650 hover:text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"><Trash2 className="w-4 h-4" /> Eliminar Permanente</button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Archive className="w-8 h-8 text-slate-350" />
              <span>Selecciona un mensaje archivado para ver el detalle.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal 9090 */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto shadow-inner"><ShieldAlert className="w-6 h-6" /></div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Confirmación de Borrado</h3>
              <p className="text-slate-500 text-xs mt-1">Ingrese clave de seguridad administrativa **"9090"**:</p>
            </div>
            <form onSubmit={confirmDelete} className="flex flex-col gap-3">
              <input type="password" placeholder="Clave LFS (9090)" value={deleteCode} onChange={e => setDeleteCode(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-base tracking-widest font-black focus:outline-none" />
              {deleteError && <span className="text-xs text-red-500 font-bold">{deleteError}</span>}
              <div className="flex gap-2 mt-2">
                <button type="button" onClick={() => setDeleteTargetId(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition">Cancelar</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#F97316] text-white hover:bg-[#F97316]/95 rounded-xl font-bold text-xs transition">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
