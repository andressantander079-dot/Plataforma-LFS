"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { toggleLikePublico, registrarVistaPublica } from "@/lib/actions/noticias.actions";

/** Clave de localStorage con el id anónimo del dispositivo. */
const CLAVE_DISPOSITIVO = "lfs-dispositivo-id";

function obtenerDispositivoId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(CLAVE_DISPOSITIVO);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLAVE_DISPOSITIVO, id);
  }
  return id;
}

/** Registra la lectura una sola vez al abrir el detalle. */
export function RegistradorVista({ newsId }: { newsId: string }) {
  useEffect(() => {
    const dispositivo = obtenerDispositivoId();
    if (!dispositivo) return;
    const clave = `lfs-vista-${newsId}`;
    // No contamos dos veces la misma lectura en la sesión
    if (sessionStorage.getItem(clave)) return;
    sessionStorage.setItem(clave, "1");
    registrarVistaPublica(newsId, dispositivo).catch(() => {});
  }, [newsId]);

  return null;
}

/** Botón "me gusta": 1 por dispositivo, con toggle y contador optimista. */
export function BotonLike({ newsId, likesIniciales }: { newsId: string; likesIniciales: number }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(likesIniciales);
  const [ocupado, setOcupado] = useState(false);

  // Estado inicial: ¿este dispositivo ya le dio like? (marca local)
  useEffect(() => {
    setLiked(localStorage.getItem(`lfs-like-${newsId}`) === "1");
  }, [newsId]);

  async function alternar() {
    if (ocupado) return;
    setOcupado(true);

    // Optimista
    const nuevoLiked = !liked;
    setLiked(nuevoLiked);
    setLikes((l) => l + (nuevoLiked ? 1 : -1));

    const r = await toggleLikePublico(newsId, obtenerDispositivoId());
    setOcupado(false);
    if (!r.ok) {
      // Revertir
      setLiked(!nuevoLiked);
      setLikes((l) => l + (nuevoLiked ? -1 : 1));
      return;
    }
    setLiked(Boolean(r.liked));
    setLikes(Number(r.likes ?? likes));
    localStorage.setItem(`lfs-like-${newsId}`, r.liked ? "1" : "0");
  }

  return (
    <button
      type="button"
      id={`btn-like-${newsId}`}
      onClick={alternar}
      disabled={ocupado}
      aria-pressed={liked}
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-sm transition shadow-sm disabled:opacity-60 ${
        liked
          ? "bg-rose-500 text-white shadow-rose-500/30"
          : "bg-white border border-slate-200 text-slate-600 hover:border-rose-300 hover:text-rose-500"
      }`}
    >
      <Heart className={`w-4 h-4 transition-transform ${liked ? "fill-current scale-110" : ""}`} />
      {likes.toLocaleString("es-AR")} Me gusta
    </button>
  );
}
