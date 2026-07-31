"use client";

import { useState } from "react";
import { MessageSquare, Heart, Share2, Award, Calendar, ChevronRight } from "lucide-react";

// Mock de Noticias
const MOCK_NEWS = [
  {
    id: "n1",
    title: "Comienza la Copa de Campeones LFS 2026 en el Cochocho Vargas",
    summary: "Este fin de semana arranca el certamen más importante de la Patagonia Sur con la participación de los 8 mejores clubes clasificados.",
    content: "Con gran expectativa, la Liga de Fútsal de Ushuaia dará inicio este sábado a la Copa de Campeones LFS 2026. Los partidos se disputarán en el Gimnasio Cochocho Vargas, bajo un estricto protocolo organizativo. Los clubes Camioneros y HAF Ushuaia abrirán la jornada en el clásico de la fecha a las 16:00 hs.",
    date: "2026-07-30",
    likes: 24,
    commentsCount: 3,
    category: "Competencias",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "n2",
    title: "Nueva Reglamentación sobre la Firma Digital de Pases",
    summary: "La FVF aprobó el nuevo sistema de credenciales temporales de 72 horas para habilitar transferencias electrónicas entre clubes.",
    content: "A partir de agosto, todas las solicitudes de pase de jugadores deberán iniciarse mediante la plataforma oficial digital. Los clubes de origen contarán con un plazo estricto de 7 días para responder, tras lo cual se activará el proceso de firma del tutor o jugador con credenciales temporales de 72 horas.",
    date: "2026-07-28",
    likes: 12,
    commentsCount: 1,
    category: "Institucional",
    image: "https://images.unsplash.com/photo-1450133064473-71024230f91b?q=80&w=600&auto=format&fit=crop",
  },
];

// Mock de Comentarios Moderados
const MOCK_COMMENTS = [
  { id: "c1", user: "Diego Santillán", text: "Excelente iniciativa la Copa de Campeones. Estaremos alentando desde la tribuna.", date: "25 min atrás" },
  { id: "c2", user: "Mariano Ortiz", text: "¡Gran noticia lo de las firmas de pases digitales! Ahorrará mucho papeleo a los delegados.", date: "2 horas atrás" },
];

export default function NoticiasPage() {
  const [newsList, setNewsList] = useState(MOCK_NEWS);
  const [activeArticle, setActiveArticle] = useState<string>("n1");
  const [commentInput, setCommentInput] = useState("");
  const [comments, setComments] = useState(MOCK_COMMENTS);

  const handleLike = (id: string) => {
    setNewsList(prev => prev.map(news => {
      if (news.id === id) {
        return { ...news, likes: news.likes + 1 };
      }
      return news;
    }));
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    
    const newComment = {
      id: `c-${Date.now()}`,
      user: "Usuario Público",
      text: commentInput.trim(),
      date: "Justo ahora (Pendiente de moderación)",
    };

    setComments(prev => [newComment, ...prev]);
    setCommentInput("");
    alert("Comentario enviado. Se mostrará públicamente una vez que sea aprobado por el administrador.");
  };

  const selectedArticle = newsList.find(n => n.id === activeArticle) || newsList[0];

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      {/* Columna Izquierda: Detalle de Noticia Seleccionada */}
      <article className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
        
        {/* Encabezado del artículo */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-450">
            <span className="px-2 py-0.5 rounded bg-orange-50 text-[#F97316] font-bold">
              {selectedArticle.category}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(selectedArticle.date).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-black text-[#1A2A44] leading-tight">
            {selectedArticle.title}
          </h2>
        </div>

        {/* Imagen del artículo */}
        <div className="w-full h-64 bg-slate-100 rounded-xl overflow-hidden shadow-inner relative border border-slate-150">
          <img
            src={selectedArticle.image}
            alt={selectedArticle.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Contenido */}
        <p className="text-slate-700 font-medium text-lg leading-relaxed border-l-4 border-[#F97316] pl-4 my-2">
          {selectedArticle.summary}
        </p>
        <div className="text-slate-600 text-base leading-relaxed space-y-4 font-normal">
          <p>{selectedArticle.content}</p>
        </div>

        {/* Acciones (Likes / Compartir) */}
        <div className="flex items-center gap-6 border-y border-slate-100 py-3 text-slate-500 font-semibold text-xs my-2">
          <button
            onClick={() => handleLike(selectedArticle.id)}
            className="flex items-center gap-2 hover:text-red-500 transition group"
          >
            <Heart className="w-4 h-4 text-slate-450 group-hover:scale-110 group-hover:text-red-500 transition-all" />
            <span>{selectedArticle.likes} Likes</span>
          </button>
          <button
            onClick={() => alert("Simulando compartir enlace...")}
            className="flex items-center gap-2 hover:text-[#1A2A44] transition"
          >
            <Share2 className="w-4 h-4 text-slate-450" />
            <span>Compartir</span>
          </button>
        </div>

        {/* Sección de Comentarios */}
        <div className="flex flex-col gap-4">
          <h3 className="font-serif text-lg font-bold text-[#1A2A44] flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#F97316]" />
            Comentarios del Público
          </h3>

          {/* Formulario */}
          <form onSubmit={handleAddComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Escribe un comentario..."
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-[#1A2A44] font-medium focus:outline-none focus:ring-1 focus:ring-[#F97316]"
            />
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1A2A44] hover:bg-[#F97316] text-white rounded-xl font-bold text-xs transition"
            >
              Comentar
            </button>
          </form>

          {/* Listado de comentarios */}
          <div className="flex flex-col gap-3.5 mt-2">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-slate-50 rounded-xl p-3 border border-slate-150">
                <div className="flex justify-between items-center gap-2 mb-1.5">
                  <span className="font-bold text-xs text-[#1A2A44]">{comment.user}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{comment.date}</span>
                </div>
                <p className="text-slate-600 text-xs font-normal leading-relaxed">{comment.text}</p>
              </div>
            ))}
          </div>
        </div>

      </article>

      {/* Columna Derecha: Lista de otras noticias */}
      <aside className="flex flex-col gap-6">
        <h3 className="font-sans text-xs font-black tracking-widest text-slate-400 uppercase">
          Más Noticias LFS
        </h3>
        
        <div className="flex flex-col gap-4">
          {newsList.map((news) => (
            <div
              key={news.id}
              onClick={() => setActiveArticle(news.id)}
              className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-md transition flex flex-col gap-2 ${
                activeArticle === news.id
                  ? "border-[#F97316] ring-1 ring-[#F97316]/50"
                  : "border-slate-200/80"
              }`}
            >
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                  {news.category}
                </span>
                <span>{new Date(news.date).toLocaleDateString()}</span>
              </div>
              <h4 className="font-serif text-sm font-bold text-[#1A2A44] leading-snug hover:text-[#F97316] transition">
                {news.title}
              </h4>
              <p className="text-xs text-slate-500 line-clamp-2">
                {news.summary}
              </p>
              <div className="flex items-center justify-end text-[10px] font-bold text-[#1A2A44] mt-2 group">
                Leer artículo 
                <ChevronRight className="w-3.5 h-3.5 transform translate-x-0 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </aside>

    </div>
  );
}
