import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Plus } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { crearCancha } from "@/lib/actions/competencias.actions";
import { BotonEliminarCancha } from "@/components/competencias/BotonEliminarCancha";

/** Registro de canchas (escenarios) — admin. */
export default async function Canchas() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: canchas } = await supabase
    .from("venues")
    .select("id, name, address")
    .order("name");

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <Link
          href="/admin/competencias"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Competencias
        </Link>
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <MapPin className="w-7 h-7 text-[#F97316]" />
          Canchas
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Escenarios donde se juegan los partidos. Se eligen al programar cada partido.
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await crearCancha(formData);
        }}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-wrap items-end gap-3"
      >
        <label className="flex-1 min-w-[180px] flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
          Nombre
          <input
            name="name"
            required
            placeholder="Ej: Polideportivo Municipal"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
          />
        </label>
        <label className="flex-1 min-w-[180px] flex flex-col gap-1.5 text-xs font-bold text-[#1A2A44]">
          Dirección (opcional)
          <input
            name="address"
            placeholder="Ej: Gdor. Paz 742, Ushuaia"
            className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/60"
          />
        </label>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-bold hover:bg-[#F97316]/90 transition shadow-md flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Agregar cancha
        </button>
      </form>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {(canchas ?? []).length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            Todavía no hay canchas cargadas.
          </p>
        )}
        <ul className="divide-y divide-slate-100">
          {(canchas ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#1A2A44] truncate">{c.name}</p>
                {c.address && <p className="text-[11px] text-slate-500 truncate">{c.address}</p>}
              </div>
              <BotonEliminarCancha canchaId={c.id} nombre={c.name} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
