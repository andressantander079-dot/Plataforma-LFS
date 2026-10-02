import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  obtenerOCrearConversacionArbitro,
  obtenerMensajes,
} from "@/lib/actions/mensajeria.actions";
import { VentanaChat, type Mensaje } from "@/components/mensajeria/VentanaChat";

/**
 * MENSAJERÍA DEL ÁRBITRO
 * Chat privado y en tiempo real con la federación (antes era una maqueta).
 * Recibe los comunicados oficiales como tarjetas destacadas.
 */
export default async function ArbitroMensajeria() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "arbitro" && profile?.role !== "arbitro_asistente") {
    redirect("/login");
  }

  // Conversación individual del árbitro con la federación (se crea la primera vez)
  const conversacion = await obtenerOCrearConversacionArbitro(user.id);
  const mensajes = (await obtenerMensajes(conversacion.id)) as Mensaje[];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 h-[calc(100vh-6rem)]">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4 shrink-0">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-[#F97316]" />
          Mensajería Oficial
        </h1>
        <p className="text-slate-500 text-xs">
          Comunicate en tiempo real con la federación y el Colegio de Árbitros.
          Acá llegan también los comunicados oficiales.
        </p>
      </div>

      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-0 flex flex-col">
        <VentanaChat
          conversacionId={conversacion.id}
          mensajesIniciales={mensajes}
          usuarioActualId={user.id}
          titulo="Federación LFS"
          subtitulo="Colegio de Árbitros — respuesta en tiempo real"
          iniciales="LFS"
        />
      </div>
    </div>
  );
}
