import { redirect } from "next/navigation";
import Link from "next/link";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";
import { BadgeMensajeria } from "@/components/mensajeria/BadgeMensajeria";
import {
  Users, Phone, KeyRound, UserRound, ShieldCheck, AlertCircle,
  CheckCircle, XCircle, Mail, MessageSquare,
} from "lucide-react";

/**
 * PANEL DEL CLUB (rol club)
 * El club ve TODA la información que la federación le asignó:
 * sus datos institucionales, sus representantes y los usuarios
 * con acceso a la plataforma. Todo real desde Supabase.
 */

interface Club {
  id: string;
  name: string;
  president_name: string | null;
  president_dni: string;
  president_phone: string;
  treasurer_name: string | null;
  treasurer_dni: string;
  treasurer_phone: string;
  status: "inhabilitado" | "en_revision" | "habilitado";
}

interface Representante {
  id: string;
  full_name: string;
  dni: string;
  phone: string;
  cargo: string;
}

interface UsuarioClub {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string;
}

const STATUS_UI = {
  habilitado: { label: "Habilitado", className: "bg-green-500/15 text-green-300", Icon: CheckCircle },
  en_revision: { label: "En revisión", className: "bg-orange-500/15 text-orange-300", Icon: AlertCircle },
  inhabilitado: { label: "Inhabilitado", className: "bg-red-500/15 text-red-300", Icon: XCircle },
} as const;

export default async function ClubDashboard() {
  const supabase = await createLfsServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Perfil del usuario logueado: a qué club pertenece
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id, full_name")
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
    .select("*")
    .eq("id", profile.club_id)
    .single();

  if (!club) redirect("/login");

  const clubData = club as Club;

  // Representantes extra cargados por la federación
  const { data: representantes } = await supabase
    .from("club_representatives")
    .select("id, full_name, dni, phone, cargo")
    .eq("club_id", clubData.id)
    .order("created_at");

  // Todos los usuarios autorizados de este club
  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("club_id", clubData.id)
    .order("created_at");

  const status = STATUS_UI[clubData.status] ?? STATUS_UI.inhabilitado;
  const iniciales = clubData.name
    .split(" ")
    .filter((p: string) => p.length > 2)
    .slice(0, 2)
    .map((p: string) => p[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-slate-100">
      {/* Barra superior */}
      <header className="bg-[#1A2A44] text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-[#F97316] rounded-full flex items-center justify-center font-bold text-white shadow-md shrink-0">
              {iniciales}
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-lg font-black truncate">{clubData.name}</h1>
              <p className="text-slate-400 text-[11px]">Portal del Club — Liga de Fútsal de Ushuaia</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${status.className}`}>
              <status.Icon className="w-3 h-3" />
              {status.label}
            </span>
            <Link
              href="/club/mensajeria"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-[#F97316] transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Mensajería</span>
              <BadgeMensajeria />
            </Link>
            <div className="w-36 hidden sm:block"><BotonCerrarSesion /></div>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Datos institucionales */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#F97316]" />
            <h2 className="font-serif text-lg font-bold text-[#1A2A44]">
              Autoridades Registradas
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-slate-100 rounded-xl p-4">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Presidente
              </span>
              <p className="text-sm font-bold text-[#1A2A44] mt-1">
                {clubData.president_name ?? `DNI ${clubData.president_dni}`}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3 text-[#F97316]" /> {clubData.president_phone}
              </p>
            </div>
            <div className="border border-slate-100 rounded-xl p-4">
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                Tesorero
              </span>
              <p className="text-sm font-bold text-[#1A2A44] mt-1">
                {clubData.treasurer_name ?? `DNI ${clubData.treasurer_dni}`}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <Phone className="w-3 h-3 text-[#F97316]" /> {clubData.treasurer_phone}
              </p>
            </div>
          </div>

          {/* Representantes extra */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
              Otros representantes autorizados
            </span>
            {(representantes ?? []).length === 0 ? (
              <p className="text-slate-400 text-xs italic mt-2">
                No hay representantes adicionales registrados por la federación.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-slate-100 mt-2">
                {(representantes as Representante[]).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 py-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#1A2A44]/5 flex items-center justify-center shrink-0">
                      <UserRound className="w-4 h-4 text-[#1A2A44]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1A2A44] truncate">{r.full_name}</p>
                      <p className="text-[11px] text-slate-500">
                        DNI {r.dni} · {r.phone}
                      </p>
                    </div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#F97316]/10 text-[#F97316] shrink-0">
                      {r.cargo}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Usuarios con acceso */}
        <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-5 h-5 text-[#F97316]" />
            <h2 className="font-serif text-lg font-bold text-[#1A2A44]">
              Usuarios con Acceso a la Plataforma
            </h2>
          </div>
          <p className="text-slate-400 text-[11px] mb-4">
            Estas son las cuentas que la federación habilitó para tu club. Si
            necesitás dar de alta o baja un usuario, solicitálo por Mensajería.
          </p>

          {(usuarios ?? []).length === 0 ? (
            <p className="text-slate-400 text-xs italic">
              Todavía no hay usuarios habilitados para tu club.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {(usuarios as UsuarioClub[]).map((u) => (
                <div key={u.id} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-full bg-[#1A2A44] flex items-center justify-center shrink-0">
                    <UserRound className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-[#1A2A44] truncate">{u.full_name}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-[#F97316] shrink-0" />
                      {u.email ?? "Sin email"}
                    </p>
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold shrink-0">
                    Alta: {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pie */}
        <p className="text-center text-[10px] text-slate-400 pb-6">
          Plataforma LFS v3.0 — Si algún dato está incorrecto, reportalo a la federación.
        </p>
      </div>
    </main>
  );
}