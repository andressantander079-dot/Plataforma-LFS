"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Send, Paperclip, Archive, Inbox } from "lucide-react";

export default function MensajeriaAdminCatchAll() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string[];
  const subRoute = slug ? slug[0] : "";

  // Renderizador según la sub-ruta
  if (subRoute === "redactar") {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div className="border-b pb-4 flex items-center gap-3">
          <button onClick={() => router.push("/admin/mensajeria/bandeja")} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Redactar Mensaje</h2>
            <p className="text-slate-500 text-xs mt-0.5">Envia una comunicación formal a un club o árbitro de la liga.</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); alert("Mensaje enviado con éxito."); router.push("/admin/mensajeria/bandeja"); }} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Destinatario</label>
            <select className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none">
              <option value="todos">Todos los Clubes</option>
              <option value="club-1">Club Camioneros</option>
              <option value="club-2">HAF Ushuaia</option>
              <option value="arbitros">Todos los Árbitros</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Asunto</label>
            <input type="text" required placeholder="Motivo del mensaje" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-slate-700">Mensaje / Comunicación</label>
            <textarea required rows={6} placeholder="Escriba aquí..." className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-semibold text-[#1A2A44] focus:outline-none" />
          </div>

          <div className="flex justify-between items-center mt-2 border-t pt-4">
            <button type="button" className="flex items-center gap-1.5 px-4 py-2 border rounded-xl font-bold text-xs hover:bg-slate-50 transition text-slate-600">
              <Paperclip className="w-4 h-4" /> Adjuntar PDF/JPG (max 5MB)
            </button>
            <button type="submit" className="flex items-center gap-1.5 px-5 py-2.5 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-md hover:bg-[#F97316]/95 transition">
              <Send className="w-4 h-4" /> Enviar Mensaje
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Vista para enviados / archivados
  const isArchived = subRoute === "archivados";
  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4 flex items-center gap-3">
        <button onClick={() => router.push("/admin/mensajeria/bandeja")} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            {isArchived ? <Archive className="w-6 h-6 text-[#F97316]" /> : <Inbox className="w-6 h-6 text-[#F97316]" />}
            Mensajes {isArchived ? "Archivados" : "Enviados"}
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Consulta de correos históricos del sistema.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 flex flex-col items-center gap-2 shadow-sm">
        <Inbox className="w-8 h-8 text-slate-300" />
        <span className="text-sm font-semibold text-[#1A2A44]">No se encontraron mensajes</span>
        <p className="text-xs text-slate-500 max-w-sm">No existen registros en esta categoría de mensajería.</p>
      </div>
    </div>
  );
}
