import { redirect } from "next/navigation";
import { Settings, ShieldAlert, Phone, User } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { FormularioConfiguracionClub } from "@/components/club/FormularioConfiguracionClub";

export default async function ClubConfiguracionPage() {
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

  const clubId = profile?.club_id;
  if (!clubId) redirect("/club/dashboard");

  const { data: club } = await supabase
    .from("clubs")
    .select("*")
    .eq("id", clubId)
    .single();

  if (!club) redirect("/club/dashboard");

  const metadata = (club.metadata ?? {}) as Record<string, unknown>;
  const phone = typeof metadata.telefono_delegado === "string" ? metadata.telefono_delegado : "";
  const camiseta = typeof metadata.color_camiseta === "string" ? metadata.color_camiseta : "";
  const camisetaAlternativa =
    typeof metadata.color_camiseta_alternativa === "string"
      ? metadata.color_camiseta_alternativa
      : "";

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto">
      {/* Encabezado */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Settings className="w-7 h-7 text-[#F97316]" />
          Configuración del Club
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Gestión de contactos para delegados, equipaciones y control administrativo oficial.
        </p>
      </div>

      {/* Ajustes Editables por el Club */}
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-bold text-[#1A2A44]">Datos de Contacto y Colores</h3>
        <p className="text-[11px] text-slate-500 -mt-2">
          Esta información ayuda a coordinar los partidos con los otros delegados de la liga.
        </p>
        <FormularioConfiguracionClub
          clubId={club.id}
          initialPhone={phone}
          initialCamiseta={camiseta}
          initialCamisetaAlternativa={camisetaAlternativa}
        />
      </section>

      {/* Información Institucional Oficial (Solo Lectura) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <ShieldAlert className="w-5 h-5 text-[#F97316]" />
          <div>
            <h4 className="font-bold text-xs text-[#1A2A44] uppercase tracking-wide">
              Información Registrada Oficial
            </h4>
            <span className="text-[10px] text-slate-450">
              Para modificar estos datos, debés enviar un reclamo a la federación.
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#1A2A44]">
          {/* Nombre Oficial */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Nombre Oficial del Club
            </span>
            <span className="font-bold bg-slate-50 border rounded-lg px-3 py-2.5 block text-slate-650">
              {club.name}
            </span>
          </div>

          {/* Estado de Habilitación */}
          <div>
            <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
              Estado de Inscripción
            </span>
            <span className="font-bold bg-slate-50 border rounded-lg px-3 py-2.5 block capitalize text-slate-650">
              {club.status}
            </span>
          </div>

          {/* Presidente */}
          <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-2">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#F97316]" /> Presidente Oficial
            </span>
            <p className="font-bold text-sm text-[#1A2A44]">
              {club.president_name || "—"}
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#F97316]" /> {club.president_phone || "—"}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">DNI: {club.president_dni || "—"}</p>
          </div>

          {/* Tesorero */}
          <div className="border border-slate-100 rounded-xl p-4 flex flex-col gap-2">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-[#F97316]" /> Tesorero Oficial
            </span>
            <p className="font-bold text-sm text-[#1A2A44]">
              {club.treasurer_name || "—"}
            </p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#F97316]" /> {club.treasurer_phone || "—"}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">DNI: {club.treasurer_dni || "—"}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
