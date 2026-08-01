import Link from "next/link";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  Users, Plus, Phone, CheckCircle, XCircle, AlertCircle, Eye, UserRound,
} from "lucide-react";

/**
 * LISTADO DE CLUBES (datos reales desde Supabase)
 * Es un Server Component: los datos se traen en el servidor,
 * no hay mocks ni estados falsos.
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

const STATUS_UI = {
  habilitado: {
    label: "Habilitado",
    border: "border-green-500",
    badge: "bg-green-50 text-green-700",
    Icon: CheckCircle,
  },
  en_revision: {
    label: "En revisión",
    border: "border-orange-500",
    badge: "bg-orange-50 text-orange-700",
    Icon: AlertCircle,
  },
  inhabilitado: {
    label: "Inhabilitado",
    border: "border-red-500",
    badge: "bg-red-50 text-red-700",
    Icon: XCircle,
  },
} as const;

export default async function EquiposAdmin() {
  const supabase = await createLfsServerClient();

  const { data: clubs, error } = await supabase
    .from("clubs")
    .select(
      "id, name, president_name, president_dni, president_phone, treasurer_name, treasurer_dni, treasurer_phone, status"
    )
    .order("name");

  const lista = (clubs ?? []) as Club[];

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="font-serif text-3xl font-black text-[#1A2A44] flex items-center gap-3">
            <Users className="w-8 h-8 text-[#F97316]" />
            Clubes Afiliados
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Administra los clubes inscritos, sus contactos de tesorería y estados de habilitación.
          </p>
        </div>

        <Link
          href="/admin/equipos/crear"
          id="btn-create-club"
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition shadow-lg shadow-[#F97316]/20 text-xs self-stretch sm:self-auto text-center justify-center"
        >
          <Plus className="w-4 h-4" />
          Registrar Club
        </Link>
      </section>

      {/* Error de conexión */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-5 py-4">
          No se pudieron cargar los clubes: {error.message}
        </div>
      )}

      {/* Estado vacío: todavía no hay clubes */}
      {!error && lista.length === 0 && (
        <section className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#1A2A44]/5 flex items-center justify-center">
            <Users className="w-7 h-7 text-[#F97316]" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-[#1A2A44]">
              Todavía no hay clubes registrados
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Registrá el primer club de la liga para empezar a cargar planteles.
            </p>
          </div>
          <Link
            href="/admin/equipos/crear"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-[#F97316] hover:bg-[#F97316]/95 text-white transition text-xs"
          >
            <Plus className="w-4 h-4" />
            Registrar el primer club
          </Link>
        </section>
      )}

      {/* Tarjetas de Clubes */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lista.map((club) => {
          const ui = STATUS_UI[club.status] ?? STATUS_UI.inhabilitado;
          return (
            <div
              key={club.id}
              className={`bg-white rounded-2xl border-l-4 ${ui.border} border-y border-r border-slate-200/80 p-5 flex flex-col justify-between shadow-sm hover:shadow transition duration-250`}
            >
              <div>
                {/* Encabezado */}
                <div className="flex justify-between items-center mb-3">
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1 ${ui.badge}`}
                  >
                    <ui.Icon className="w-3 h-3" />
                    {ui.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold">LFS v3.0</span>
                </div>

                <h4 className="font-serif text-lg font-bold text-[#1A2A44] mb-3">
                  {club.name}
                </h4>

                {/* Contactos */}
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 mb-6">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Presidente
                    </span>
                    <p className="text-slate-700 text-xs font-bold flex items-center gap-1">
                      <UserRound className="w-3 h-3 text-slate-400" />
                      {club.president_name ?? `DNI ${club.president_dni}`}
                    </p>
                    <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#F97316]" /> {club.president_phone}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">
                      Tesorero
                    </span>
                    <p className="text-slate-700 text-xs font-bold">
                      {club.treasurer_name ?? `DNI ${club.treasurer_dni}`}
                    </p>
                    <p className="text-slate-500 text-[10px] flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-[#F97316]" /> {club.treasurer_phone}
                    </p>
                  </div>
                </div>
              </div>

              {/* Accesos rápidos */}
              <div className="flex gap-2">
                <Link
                  href={`/admin/equipos/${club.id}/plantel`}
                  className="flex-1 px-3 py-2 bg-[#1A2A44]/5 hover:bg-[#1A2A44] text-[#1A2A44] hover:text-white rounded-lg font-bold text-[10px] transition text-center flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Ver Plantel
                </Link>
                <Link
                  href={`/admin/equipos/${club.id}/finanzas`}
                  className="px-3 py-2 bg-slate-50 hover:bg-[#F97316] hover:text-white text-slate-650 rounded-lg font-bold text-[10px] transition text-center"
                >
                  Finanzas
                </Link>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
