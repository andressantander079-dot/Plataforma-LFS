import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import {
  obtenerOCrearConversacion,
  obtenerMensajes,
} from "@/lib/actions/mensajeria.actions";
import { VentanaChat, type Mensaje } from "@/components/mensajeria/VentanaChat";

/**
 * MENSAJERÍA DEL CLUB
 * Chat privado y en tiempo real con la federación.
 * Mismo estilo de encabezado oscuro que el panel del club.
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

  const iniciales = club.name
    .split(" ")
    .filter((p: string) => p.length > 2)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col">
      {/* Barra superior (mismo estilo que el panel del club) */}
      <header className="bg-[#1A2A44] text-white shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0">
              {iniciales}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-black truncate">{club.name}</h1>
              <p className="text-slate-400 text-[11px]">
                Mensajería con la Federación — Liga de Fútsal de Ushuaia
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/club/dashboard"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-[#F97316] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al panel</span>
            </Link>
            <div className="w-36 hidden sm:block"><BotonCerrarSesion /></div>
          </div>
        </div>
      </header>

      {/* Chat a pantalla completa */}
      <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 flex">
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden min-h-[60vh]">
          <VentanaChat
            conversacionId={conversacion.id}
            mensajesIniciales={mensajes}
            usuarioActualId={user.id}
            titulo="Federación LFS"
            subtitulo="Administración de la liga — respuesta en tiempo real"
            iniciales="LFS"
          />
        </div>
      </div>
    </main>
  );
}
