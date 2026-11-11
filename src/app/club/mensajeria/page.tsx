import { redirect } from "next/navigation";
import { AlertCircle, MessageSquare } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import {
  obtenerOCrearConversacion,
  obtenerMensajes,
} from "@/lib/actions/mensajeria.actions";
import { type Mensaje } from "@/components/mensajeria/VentanaChat";
import { MensajeriaClub } from "@/components/mensajeria/MensajeriaClub";

export const dynamic = "force-dynamic";

/**
 * MENSAJERÍA DEL CLUB
 * Panel empresarial para comunicarse en tiempo real con la federación,
 * redactar notas oficiales con editor de texto enriquecido, adjuntos, borradores y envíos programados.
 */
export default async function ClubMensajeria() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-orange-500" />
          <h1 className="font-serif text-xl font-bold text-[#1A2A44]">
            Usuario sin club asignado
          </h1>
          <p className="text-slate-500 text-sm">
            Tu usuario todavía no está vinculado a ningún club. Pedile a la
            federación que asigne tu cuenta desde el panel de administración.
          </p>
          <div className="w-40"><BotonCerrarSesion /></div>
        </div>
      </main>
    );
  }

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", profile.club_id)
    .single();

  if (!club) redirect("/login");

  // Conversación del club con la federación (se crea la primera vez)
  const conversacion = await obtenerOCrearConversacion(club.id);
  const mensajes = (await obtenerMensajes(conversacion.id)) as Mensaje[];

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-4">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-3 shrink-0">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-[#F97316]" />
          Mensajería Oficial
        </h1>
        <p className="text-slate-500 text-xs">
          Comunicate en tiempo real con la federación para consultas, notas oficiales, solicitudes o gestiones.
        </p>
      </div>

      <MensajeriaClub
        conversacionId={conversacion.id}
        mensajesIniciales={mensajes}
        usuarioActualId={user.id}
        clubId={club.id}
        clubNombre={club.name}
      />
    </div>
  );
}
