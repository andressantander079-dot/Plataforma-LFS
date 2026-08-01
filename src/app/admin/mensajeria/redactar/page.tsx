"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Paperclip, CheckCircle, Eye, Crop, Edit3 } from "lucide-react";

const RECIPIENTS = [
  { id: "c1", name: "Club Camioneros", type: "club" },
  { id: "c2", name: "HAF Ushuaia", type: "club" },
  { id: "c3", name: "Club Galicia", type: "club" },
  { id: "a1", name: "Esteban Ortiz", type: "arbitro" },
  { id: "a2", name: "Rogelio Gómez", type: "arbitro" },
];

export default function RedactarMensaje() {
  const router = useRouter();

  // Estados del Formulario
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [subject, setSubject] = useState("");
  const [importance, setImportance] = useState("Común");
  const [body, setBody] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  // Estados de Imagen y Recorte
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [cropAspect, setCropAspect] = useState<"libre" | "fijo">("libre");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleToggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo supera el límite de 5 MB.");
      return;
    }

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setImageSrc(reader.result as string);
        setCroppedImage(null);
      };
      reader.readAsDataURL(file);
    } else {
      setCroppedImage(file.name);
      setImageSrc(null);
    }
  };

  const handleCropAction = () => {
    if (!canvasRef.current || !imageSrc) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Simulación de recorte aplicando un redimensionado en canvas
      canvasRef.current!.width = cropAspect === "fijo" ? 150 : 250;
      canvasRef.current!.height = 150;
      ctx.drawImage(img, 10, 10, img.width - 20, img.height - 20, 0, 0, canvasRef.current!.width, 150);
      setCroppedImage(canvasRef.current!.toDataURL());
      setImageSrc(null);
    };
  };

  const handleSend = () => {
    if (selectedRecipients.length === 0 || !subject.trim() || !body.trim()) {
      alert("Por favor complete los campos obligatorios.");
      return;
    }
    alert("¡Mensaje enviado con éxito a los destinatarios!");
    router.push("/admin/mensajeria/bandeja");
  };

  const filteredRecipients = RECIPIENTS.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isPreview) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto">
        <div className="border-b pb-4 flex justify-between items-center">
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Vista Previa del Mensaje</h2>
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${importance === "Urgente" ? "bg-red-50 text-red-650" : "bg-slate-100 text-slate-550"}`}>{importance}</span>
        </div>
        <div className="bg-white border p-6 rounded-2xl flex flex-col gap-4 shadow-sm text-sm">
          <p><strong>Destinatarios:</strong> {selectedRecipients.map(id => RECIPIENTS.find(r => r.id === id)?.name).join(", ")}</p>
          <p><strong>Asunto:</strong> {subject}</p>
          <div className="border-t pt-4 min-h-[150px] whitespace-pre-line text-slate-600 leading-relaxed">{body}</div>
          {croppedImage && (
            <div className="mt-4 border-t pt-3">
              <span className="text-xs text-slate-400 font-bold block mb-1">Archivo Adjunto:</span>
              {croppedImage.startsWith("data:") ? <img src={croppedImage} alt="Recortada" className="h-24 rounded border shadow-sm" /> : <span className="font-mono text-xs font-semibold">{croppedImage}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsPreview(false)} className="flex-1 py-3 border rounded-xl font-bold text-xs hover:bg-slate-50 transition text-slate-700 flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" /> Editar Mensaje</button>
          <button onClick={handleSend} className="flex-1 py-3 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#F97316]/10 flex items-center justify-center gap-1.5"><Send className="w-4 h-4" /> Enviar Mensaje</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      {/* Encabezado */}
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button type="button" onClick={() => router.push("/admin/mensajeria/bandeja")} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Redactar Mensaje</h2>
          <p className="text-slate-500 text-xs mt-0.5">Componer correspondencia oficial interna.</p>
        </div>
      </section>

      {/* Formulario */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
        {/* Destinatarios */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-750">Seleccionar Destinatarios</label>
          <input type="text" placeholder="Buscar destinatario..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none mb-2" />
          <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-3 flex flex-col gap-2 bg-slate-50/50">
            {filteredRecipients.map(r => (
              <label key={r.id} className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={selectedRecipients.includes(r.id)} onChange={() => handleToggleRecipient(r.id)} className="w-4 h-4 accent-[#F97316]" />
                {r.name} <span className="text-[9px] text-slate-400 capitalize">({r.type})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Asunto e Importancia */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-750">Asunto (Obligatorio)</label>
            <input type="text" required placeholder="Motivo" value={subject} onChange={e => setSubject(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-750">Importancia</label>
            <select value={importance} onChange={e => setImportance(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none">
              <option value="Común">Común</option>
              <option value="Importante">Importante</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>

        {/* Mensaje */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-750">Cuerpo del Mensaje</label>
          <textarea rows={6} placeholder="Escriba aquí..." value={body} onChange={e => setBody(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl p-4 text-xs font-semibold focus:outline-none" />
        </div>

        {/* Adjuntos y Recorte */}
        <div className="border-t pt-4">
          <label className="text-xs font-bold text-slate-750 block mb-2">Archivo Adjunto (max 5 MB)</label>
          <input type="file" accept="image/jpeg,application/pdf" onChange={handleFileChange} className="text-xs font-bold text-slate-500 cursor-pointer" />
          
          {imageSrc && (
            <div className="mt-4 bg-slate-50 border p-4 rounded-xl flex flex-col gap-3">
              <span className="text-[10px] font-black uppercase text-slate-500 block">Herramienta de Recorte de Imagen</span>
              <div className="flex gap-4 mb-2">
                <button onClick={() => setCropAspect("libre")} className={`px-3 py-1 border rounded text-[10px] font-bold ${cropAspect === "libre" ? "bg-[#1A2A44] text-white" : ""}`}>Proporción Libre</button>
                <button onClick={() => setCropAspect("fijo")} className={`px-3 py-1 border rounded text-[10px] font-bold ${cropAspect === "fijo" ? "bg-[#1A2A44] text-white" : ""}`}>Fija (Aspecto Carnet)</button>
              </div>
              <img src={imageSrc} alt="Pre-recorte" className="max-h-48 rounded border shadow-sm mx-auto" />
              <button onClick={handleCropAction} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"><Crop className="w-4 h-4" /> Aplicar Recorte</button>
            </div>
          )}

          {croppedImage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-150 rounded-xl flex items-center justify-between">
              <span className="text-xs text-green-700 font-bold">Adjunto cargado y validado.</span>
              {croppedImage.startsWith("data:") && <img src={croppedImage} alt="Vista previa" className="h-10 rounded border shadow" />}
            </div>
          )}
        </div>

        {/* Vista previa / Borrador */}
        <button onClick={() => setIsPreview(true)} className="w-full mt-2 py-3 bg-[#1A2A44] text-white font-bold text-xs rounded-xl shadow-md hover:bg-[#1A2A44]/95 transition flex items-center justify-center gap-1.5"><Eye className="w-4 h-4" /> Previsualizar Mensaje</button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
