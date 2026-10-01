import Link from "next/link";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { Users, Plus } from "lucide-react";
import { TarjetaClubAdmin, type ClubItem } from "@/components/admin/TarjetaClubAdmin";

/**
 * LISTADO DE CLUBES (datos reales desde Supabase)
 * Es un Server Component: los datos se traen en el servidor,
 * no hay mocks ni estados falsos.
 */

export default async function EquiposAdmin() {
  const supabase = await createLfsServerClient();

  const { data: clubs, error } = await supabase
    .from("clubs")
    .select(
      "id, name, president_name, president_dni, president_phone, treasurer_name, treasurer_dni, treasurer_phone, status"
    )
    .order("name");

  const lista = (clubs ?? []) as ClubItem[];

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

      {/* Tarjetas de Clubes con selector interactivo de habilitación */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {lista.map((club) => (
          <TarjetaClubAdmin key={club.id} club={club} />
        ))}
      </section>
    </div>
  );
}
