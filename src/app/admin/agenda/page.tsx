import { Calendar } from "lucide-react";
import { obtenerAgendaAdmin } from "@/lib/actions/agenda.actions";
import { AgendaAdmin } from "@/components/agenda/AgendaAdmin";

export const metadata = {
  title: "Agenda y Eventos | Admin LFS",
  description: "Calendario de reuniones de delegados, congresos y cierres de inscripción.",
};

/**
 * AGENDA DEL ADMIN (Paso 17B): eventos propios de la liga (crear, editar,
 * duplicar, eliminar, avisar por mensajería) + partidos del fixture
 * automáticos. Vista lista y calendario mensual.
 */
export default async function AgendaAdminPage() {
  const agenda = await obtenerAgendaAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="border-b pb-4">
        <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Calendar className="w-7 h-7 text-[#F97316]" />
          Agenda y Eventos
        </h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Eventos de la liga y partidos del fixture, todo en un solo calendario. Los clubes y
          árbitros la ven desde sus paneles.
        </p>
      </div>

      <AgendaAdmin agenda={agenda} />
    </div>
  );
}
