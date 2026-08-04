import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerPanelMensajeriaAdmin } from "@/lib/actions/mensajeria.actions";
import { MensajeriaAdmin } from "@/components/mensajeria/MensajeriaAdmin";

/**
 * MENSAJERÍA — Panel de la federación
 * Chat privado y en tiempo real con cada club afiliado.
 */
export default async function AdminMensajeria() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/login");

  const conversaciones = await obtenerPanelMensajeriaAdmin();

  return (
    <div className="flex flex-col gap-4 max-w-7xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-[#F97316]" />
          Mensajería
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Comunicación directa y en tiempo real con cada club afiliado.
        </p>
      </div>

      <MensajeriaAdmin
        conversacionesIniciales={conversaciones}
        usuarioActualId={user.id}
      />
    </div>
  );
}
