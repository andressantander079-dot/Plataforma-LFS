"use client";

import { useState } from "react";
import { MessageSquare, Archive, Mail, MailOpen, Trash2, ShieldAlert } from "lucide-react";
import { validateAdminOperation } from "../../../../lib/security/adminGuard";

// Mock de Mensajes
const INITIAL_MESSAGES = [
  { id: "m1", sender: "Club Camioneros", role: "club", subject: "Reclamo por reprogramación Fecha 5", body: "Solicitamos el cambio de horario debido a superposición de gimnasio.", importance: "Urgente", date: "Hoy, 10:15" },
  { id: "m2", sender: "HAF Ushuaia", role: "club", subject: "Comprobante de pago pase Lucas Aravena", body: "Adjuntamos el comprobante de transferencia bancaria de la FVF.", importance: "Común", date: "Ayer, 18:30" },
  { id: "m3", sender: "Árbitro Ortiz", role: "arbitro", subject: "Informe de Incidentes Fecha 4", body: "Hubo reclamos del DT visitante al finalizar el partido. Adjunto planilla.", importance: "Importante", date: "Ayer, 12:00" },
];

export default function MensajeriaAdmin() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [activeTab, setActiveTab] = useState<"club" | "arbitro">("club");
  const [selectedMessage, setSelectedMessage] = useState<string | null>("m1");

  // Estados de borrado seguro con clave "9090"
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const filteredMessages = messages.filter((m) => m.role === activeTab);
  const currentMsg = messages.find((m) => m.id === selectedMessage);

  const initiateDelete = (id: string) => {
    setDeleteTargetId(id);
    setDeleteCode("");
    setDeleteError("");
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");
    try {
      // Validar eliminación segura con clave "9090"
      await validateAdminOperation(
        deleteCode,
        "9090",
        "admin",
        { userId: "admin-1", action: "SOFT_DELETE_MSG", module: "MENSAJERIA", details: { messageId: deleteTargetId } },
        async (log) => console.log("[AUDIT_LOG]: Mensaje archivado de forma segura:", log.details.messageId)
      );

      // Borrado lógico (Soft Delete)
      setMessages((prev) => prev.filter((m) => m.id !== deleteTargetId));
      if (selectedMessage === deleteTargetId) {
        setSelectedMessage(null);
      }
      setDeleteTargetId(null);
      alert("¡Mensaje archivado con éxito en el log de auditoría!");
    } catch (err: any) {
      setDeleteError(err.message || "Código de confirmación inválido.");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)]">
      {/* Encabezado */}
      <section className="flex justify-between items-center border-b border-slate-200 pb-4">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-[#F97316]" />
            Bandeja de Entrada
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Revisa la mensajería interna recibida de clubes y árbitros afiliados.
          </p>
        </div>
      </section>

      {/* Grid del Correo */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
        {/* Columna Izquierda: Bandeja */}
        <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
          {/* Tabs */}
          <div className="flex border-b border-slate-100 p-2 bg-slate-50 gap-2">
            <button
              onClick={() => setActiveTab("club")}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                activeTab === "club" ? "bg-white text-[#1A2A44] shadow" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Mensajes de Clubes
            </button>
            <button
              onClick={() => setActiveTab("arbitro")}
              className={`flex-1 py-2 rounded-lg font-bold text-xs transition ${
                activeTab === "arbitro" ? "bg-white text-[#1A2A44] shadow" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Mensajes de Árbitros
            </button>
          </div>

          {/* Lista de Mensajes */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => setSelectedMessage(msg.id)}
                className={`p-4 cursor-pointer hover:bg-slate-50 transition flex flex-col gap-1.5 ${
                  selectedMessage === msg.id ? "bg-[#1A2A44]/5 border-l-4 border-[#F97316]" : ""
                }`}
              >
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>{msg.sender}</span>
                  <span>{msg.date}</span>
                </div>
                <h4 className="font-semibold text-slate-800 text-xs truncate">{msg.subject}</h4>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                    msg.importance === "Urgente" ? "bg-red-50 text-red-650" : "bg-slate-100 text-slate-550"
                  }`}>
                    {msg.importance}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      initiateDelete(msg.id);
                    }}
                    className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-slate-450 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna Derecha: Detalle de Mensaje */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm overflow-y-auto">
          {currentMsg ? (
            <div className="flex flex-col gap-6">
              {/* Header Mensaje */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-slate-400">{currentMsg.sender}</span>
                  <span className="text-[10px] text-slate-400 font-bold">{currentMsg.date}</span>
                </div>
                <h3 className="font-serif text-xl font-bold text-[#1A2A44] leading-snug">{currentMsg.subject}</h3>
              </div>

              {/* Cuerpo del Mensaje */}
              <p className="text-slate-600 text-sm leading-relaxed">{currentMsg.body}</p>

              {/* Botón de Borrado/Archivado */}
              <div className="border-t border-slate-100 pt-4 mt-6">
                <button
                  onClick={() => initiateDelete(currentMsg.id)}
                  className="px-4 py-2 bg-red-50 hover:bg-red-650 text-red-600 hover:text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Archivar Mensaje
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm gap-2">
              <Mail className="w-8 h-8 text-slate-300" />
              Selecciona un mensaje para ver el detalle.
            </div>
          )}
        </div>
      </div>

      {/* Modal Seguro de Confirmación con PIN "9090" */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-[#1A2A44]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-650 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#1A2A44]">Archivado de Mensajes</h3>
              <p className="text-slate-500 text-xs mt-1">Ingrese clave institucional de archivado <strong>"9090"</strong>:</p>
            </div>
            <form onSubmit={confirmDelete} className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="PIN Administrativo"
                value={deleteCode}
                onChange={(e) => setDeleteCode(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-center text-base tracking-widest font-black focus:outline-none focus:ring-1 focus:ring-[#F97316]"
              />
              {deleteError && <span className="text-xs text-red-500 font-bold">{deleteError}</span>}
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#F97316] text-white hover:bg-[#F97316]/95 rounded-xl font-bold text-xs transition shadow-md shadow-[#F97316]/10"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
