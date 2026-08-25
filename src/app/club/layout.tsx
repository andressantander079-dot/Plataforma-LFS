import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ClubSidebar } from "@/components/club/ClubSidebar";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import { AlertCircle } from "lucide-react";

export default async function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createLfsServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Perfil del usuario logueado
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    // Si un administrador entra a /club, le mostramos el panel del club pero
    // necesitamos asignarle un club para visualizar. Tomamos el primer club de la liga.
    const { data: primerClub } = await supabase
      .from("clubs")
      .select("id, name, status")
      .order("name")
      .limit(1)
      .maybeSingle();

    if (!primerClub) {
      return (
        <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h1 className="font-serif text-xl font-bold text-[#1A2A44]">
              No hay clubes registrados
            </h1>
            <p className="text-slate-500 text-sm">
              Registrá un club en el panel de administración primero.
            </p>
            <div className="w-40"><BotonCerrarSesion /></div>
          </div>
        </main>
      );
    }

    return (
      <ClubSidebar
        clubName={`${primerClub.name} (Vista Admin)`}
        clubStatus={primerClub.status as "habilitado" | "en_revision" | "inhabilitado"}
        userName={profile.full_name || "Administrador"}
      >
        {children}
      </ClubSidebar>
    );
  }

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
    .select("name, status")
    .eq("id", profile.club_id)
    .single();

  if (!club) redirect("/login");

  return (
    <ClubSidebar
      clubName={club.name}
      clubStatus={club.status as "habilitado" | "en_revision" | "inhabilitado"}
      userName={profile.full_name || "Delegado"}
    >
      {children}
    </ClubSidebar>
  );
}
