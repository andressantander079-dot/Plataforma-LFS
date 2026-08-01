"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Eye, Crop, Edit3, ChevronDown, ChevronUp } from "lucide-react";

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

  // Estados de Colapsables
  const [showClubs, setShowClubs] = useState(true);
  const [showRefs, setShowRefs] = useState(true);

  // Estados de Imagen y Recorte
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [cropAspect, setCropAspect] = useState<"libre" | "fijo">("libre");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleRemoveFile = () => {
    setCroppedImage(null);
    setImageSrc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const clubs = RECIPIENTS.filter(r => r.type === "club" && r.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const refs = RECIPIENTS.filter(r => r.type === "arbitro" && r.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleToggleRecipient = (id: string) => {
    setSelectedRecipients(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleSelectAllClubs = (checked: boolean) => {
    const clubIds = clubs.map(c => c.id);
    setSelectedRecipients(prev =>
      checked ? Array.from(new Set([...prev, ...clubIds])) : prev.filter(id => !clubIds.includes(id))
    );
  };

  const handleSelectAllRefs = (checked: boolean) => {
    const refIds = refs.map(r => r.id);
    setSelectedRecipients(prev =>
      checked ? Array.from(new Set([...prev, ...refIds])) : prev.filter(id => !refIds.includes(id))
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return alert("El archivo supera el límite de 5 MB.");

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => { setImageSrc(reader.result as string); setCroppedImage(null); };
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
    alert("¡Mensaje enviado con éxito!");
    router.push("/admin/mensajeria/bandeja");
  };

  // Estilos de Importancia
  const importanceStyles: Record<string, string> = {
    "Común": "bg-white text-slate-700 border-slate-200",
    "Importante": "bg-yellow-100 text-yellow-800 border-yellow-300 font-bold",
    "Urgente": "bg-red-100 text-red-800 border-red-300 font-bold",
  };

  if (isPreview) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl mx-auto p-4">
        <div className="border-b pb-4 flex justify-between items-center">
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Vista Previa</h2>
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${importanceStyles[importance]}`}>{importance}</span>
        </div>
        <div className="bg-white border p-6 rounded-2xl flex flex-col gap-4 shadow-sm text-sm">
          <p><strong>Destinatarios:</strong> {selectedRecipients.map(id => RECIPIENTS.find(r => r.id === id)?.name).join(", ") || "Ninguno"}</p>
          <p><strong>Asunto:</strong> {subject}</p>
          <div className="border-t pt-4 min-h-[150px] whitespace-pre-line text-slate-600 leading-relaxed">{body}</div>
          {croppedImage && (
            <div className="mt-4 border-t pt-3">
              {croppedImage.startsWith("data:") ? <img src={croppedImage} alt="Recortada" className="h-24 rounded border shadow-sm" /> : <span className="font-mono text-xs font-semibold">{croppedImage}</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsPreview(false)} className="flex-1 py-3 border rounded-xl font-bold text-xs hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5"><Edit3 className="w-4 h-4" /> Editar</button>
          <button onClick={handleSend} className="flex-1 py-3 bg-[#F97316] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#F97316]/10 flex items-center justify-center gap-1.5"><Send className="w-4 h-4" /> Enviar</button>
        </div>
      </div>
    );
  }

  const allClubsChecked = clubs.length > 0 && clubs.every(c => selectedRecipients.includes(c.id));
  const allRefsChecked = refs.length > 0 && refs.every(r => selectedRecipients.includes(r.id));

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto p-4">
      <section className="flex items-center gap-4 border-b border-slate-200 pb-5">
        <button type="button" onClick={() => router.push("/admin/mensajeria/bandeja")} className="p-2 hover:bg-slate-200 rounded-xl transition text-[#1A2A44]">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44]">Redactar Mensaje</h2>
          <p className="text-slate-500 text-xs mt-0.5">Componer correspondencia oficial interna.</p>
        </div>
      </section>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
        {/* Destinatarios Colapsables */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-750">Seleccionar Destinatarios</label>
          <input type="text" placeholder="Buscar destinatario..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none mb-2" />
          
          <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col gap-1 bg-slate-50/50">
            {/* Grupo Clubes */}
            <div>
              <button type="button" onClick={() => setShowClubs(!showClubs)} className="w-full flex justify-between items-center p-3 border-b bg-slate-100 hover:bg-slate-200/60 transition text-xs font-bold text-slate-700">
                <span>Clubes Afiliados ({clubs.length})</span>
                {showClubs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showClubs && (
                <div className="p-3 flex flex-col gap-2 border-b max-h-36 overflow-y-auto">
                  <label className="flex items-center gap-3 text-xs font-bold text-[#F97316] cursor-pointer">
                    <input type="checkbox" checked={allClubsChecked} onChange={e => handleSelectAllClubs(e.target.checked)} className="w-4 h-4 accent-[#F97316]" />
                    [ Seleccionar Todos los Clubes ]
                  </label>
                  {clubs.map(c => (
                    <label key={c.id} className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer pl-2">
                      <input type="checkbox" checked={selectedRecipients.includes(c.id)} onChange={() => handleToggleRecipient(c.id)} className="w-4 h-4 accent-[#F97316]" />
                      {c.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Grupo Árbitros */}
            <div>
              <button type="button" onClick={() => setShowRefs(!showRefs)} className="w-full flex justify-between items-center p-3 bg-slate-100 hover:bg-slate-200/60 transition text-xs font-bold text-slate-700">
                <span>Árbitros Oficiales ({refs.length})</span>
                {showRefs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRefs && (
                <div className="p-3 flex flex-col gap-2 max-h-36 overflow-y-auto">
                  <label className="flex items-center gap-3 text-xs font-bold text-[#F97316] cursor-pointer">
                    <input type="checkbox" checked={allRefsChecked} onChange={e => handleSelectAllRefs(e.target.checked)} className="w-4 h-4 accent-[#F97316]" />
                    [ Seleccionar Todos los Árbitros ]
                  </label>
                  {refs.map(r => (
                    <label key={r.id} className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer pl-2">
                      <input type="checkbox" checked={selectedRecipients.includes(r.id)} onChange={() => handleToggleRecipient(r.id)} className="w-4 h-4 accent-[#F97316]" />
                      {r.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
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
            <select value={importance} onChange={e => setImportance(e.target.value)} className={`border rounded-xl px-3 py-2 text-xs focus:outline-none transition ${importanceStyles[importance]}`}>
              <option value="Común">Común (Estándar)</option>
              <option value="Importante">Importante (Amarillo)</option>
              <option value="Urgente">Urgente (Rojo)</option>
            </select>
          </div>
        </div>

        {/* Mensaje */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-755 font-semibold">Cuerpo del Mensaje</label>
          <textarea rows={5} placeholder="Escriba aquí..." value={body} onChange={e => setBody(e.target.value)} className="bg-slate-55/40 border border-slate-200 rounded-xl p-4 text-xs font-semibold focus:outline-none" />
        </div>

        {/* Adjuntos y Recorte */}
        <div className="border-t pt-4">
          <label className="text-xs font-bold text-slate-750 block mb-2">Archivo Adjunto (max 5 MB)</label>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition cursor-pointer text-center"
          >
            <span className="text-xs text-slate-650 font-bold flex items-center gap-1.5 justify-center">
              📁 Seleccionar archivo (PDF o JPG)
            </span>
            <span className="text-[10px] text-slate-400">Tamaño máximo: 5 MB</span>
          </div>

          {imageSrc && (
            <div className="mt-4 bg-slate-50 border p-4 rounded-xl flex flex-col gap-3">
              <div className="flex gap-4">
                <button onClick={() => setCropAspect("libre")} className={`px-3 py-1 border rounded text-[10px] font-bold ${cropAspect === "libre" ? "bg-[#1A2A44] text-white" : ""}`}>Proporción Libre</button>
                <button onClick={() => setCropAspect("fijo")} className={`px-3 py-1 border rounded text-[10px] font-bold ${cropAspect === "fijo" ? "bg-[#1A2A44] text-white" : ""}`}>Fija (Carnet)</button>
              </div>
              <img src={imageSrc} alt="Pre-recorte" className="max-h-48 rounded border shadow-sm mx-auto" />
              <button onClick={handleCropAction} className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"><Crop className="w-4 h-4" /> Recortar</button>
            </div>
          )}
          {croppedImage && (
            <div className="mt-4 p-3 bg-slate-50 border rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                  {croppedImage.startsWith("data:") ? "Imagen_Recortada.jpg" : croppedImage}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="px-2 py-1 bg-red-50 text-red-650 hover:bg-red-100 rounded-lg text-[10px] font-bold transition"
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        <button onClick={() => setIsPreview(true)} className="w-full mt-2 py-3 bg-[#1A2A44] text-white font-bold text-xs rounded-xl shadow-md hover:bg-[#1A2A44]/95 transition flex items-center justify-center gap-2"><Eye className="w-4 h-4" /> Previsualizar Mensaje</button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
