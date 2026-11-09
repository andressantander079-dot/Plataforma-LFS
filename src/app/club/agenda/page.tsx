import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerAgendaClub } from "@/lib/actions/agenda.actions";
import { AgendaLectura } from "@/components/agenda/AgendaLectura";

export const dynamic = "force-dynamic";

/**
 * AGENDA DEL CLUB (Paso 17B): los eventos de la liga (reuniones, congresos,
 * cierres de inscripción…) junto con los partidos de SUS equipos, en vista
 * lista o calendario mensual. Solo lectura.
 */
export default async function ClubAgenda() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const agenda = await obtenerAgendaClub();

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <CalendarDays className="w-7 h-7 text-[#F97316]" />
          Agenda de la Liga
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Eventos de la federación y los partidos de tus equipos, todo en un solo calendario.
        </p>
      </div>

      <AgendaLectura
        items={agenda.items}
        mensajeVacio="Todavía no hay eventos ni partidos de tus equipos en los próximos meses."
      />
    </div>
  );
}
