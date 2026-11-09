"use client";

import { useState } from "react";
import { Share2, Link2, Check, MessageCircle, Send } from "lucide-react";

/**
 * Compartir la noticia: WhatsApp, Facebook, X, Telegram, copiar link
 * y hoja nativa del celular (navigator.share) cuando está disponible.
 * (lucide ya no trae íconos de marca: Facebook y X usan su letra).
 */
export function BotonesCompartir({ titulo, slug }: { titulo: string; slug: string }) {
  const [copiado, setCopiado] = useState(false);

  function urlCompleta(): string {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/noticias/${slug}`;
  }

  const texto = encodeURIComponent(`${titulo} — Liga de Fútsal de Ushuaia`);

  async function compartirNativo() {
    const url = urlCompleta();
    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, text: titulo, url });
        return;
      } catch {
        /* cancelado por el usuario */
      }
    } else {
      copiarLink();
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(urlCompleta());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard no disponible */
    }
  }

  const destinos: Array<{
    id: string;
    nombre: string;
    icono?: typeof MessageCircle;
    letra?: string;
    href: () => string;
    clases: string;
  }> = [
    {
      id: "whatsapp",
      nombre: "WhatsApp",
      icono: MessageCircle,
      href: () => `https://wa.me/?text=${texto}%20${encodeURIComponent(urlCompleta())}`,
      clases: "bg-[#25D366]/10 text-[#1da851] hover:bg-[#25D366]/20",
    },
    {
      id: "facebook",
      nombre: "Facebook",
      letra: "f",
      href: () => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlCompleta())}`,
      clases: "bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20",
    },
    {
      id: "x",
      nombre: "X (Twitter)",
      letra: "𝕏",
      href: () => `https://twitter.com/intent/tweet?text=${texto}&url=${encodeURIComponent(urlCompleta())}`,
      clases: "bg-slate-900/10 text-slate-900 hover:bg-slate-900/20",
    },
    {
      id: "telegram",
      nombre: "Telegram",
      icono: Send,
      href: () => `https://t.me/share/url?url=${encodeURIComponent(urlCompleta())}&text=${texto}`,
      clases: "bg-[#229ED9]/10 text-[#229ED9] hover:bg-[#229ED9]/20",
    },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1 mr-1">
        <Share2 className="w-3.5 h-3.5" /> Compartir
      </span>

      {destinos.map((d) => (
        <a
          key={d.id}
          id={`btn-compartir-${d.id}`}
          href={d.href()}
          target="_blank"
          rel="noopener noreferrer"
          title={`Compartir en ${d.nombre}`}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition ${d.clases}`}
        >
          {d.icono ? (
            <d.icono className="w-4 h-4" />
          ) : (
            <span className="font-black text-base leading-none">{d.letra}</span>
          )}
        </a>
      ))}

      <button
        type="button"
        id="btn-compartir-copiar"
        onClick={copiarLink}
        title="Copiar link"
        className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
      >
        {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Link2 className="w-4 h-4" />}
      </button>

      <button
        type="button"
        id="btn-compartir-nativo"
        onClick={compartirNativo}
        className="inline-flex items-center gap-1.5 px-4 h-10 rounded-full bg-[#1A2A44] text-white text-xs font-bold hover:bg-[#1A2A44]/90 transition md:hidden"
      >
        <Share2 className="w-3.5 h-3.5" />
        Compartir
      </button>
    </div>
  );
}
