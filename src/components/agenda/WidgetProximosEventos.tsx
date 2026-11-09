import Link from "next/link";
import { CalendarDays, ChevronRight, MapPin } from "lucide-react";
import { obtenerProximosEventos } from "@/lib/actions/agenda.actions";
import { fechaLargaEvento, TIPOS_EVENTO } from "@/lib/core/rules/agendaRules";

/**
 * Widget del dashboard admin (Paso 17B): los PRÓXIMOS 3 eventos de la liga
 * con link directo a la agenda completa. Es un server component: los datos
 * llegan frescos en cada carga del dashboard.
 */
export async function WidgetProximosEventos() {
  const eventos = await obtenerProximosEventos(3);

  return (
    <section className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[#F97316]" />
          <h2 className="font-serif text-base font-bold text-[#1A2A44]">Próximos eventos</h2>
        </div>
        <Link
          href="/admin/agenda"
          className="text-[11px] font-black uppercase tracking-widest text-[#F97316] hover:underline flex items-center gap-0.5"
        >
          Ver agenda <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {eventos.length === 0 ? (
        <p className="text-xs text-slate-400 font-semibold py-2">
          No hay eventos cargados.{" "}
          <Link href="/admin/agenda" className="text-[#F97316] font-bold">
            Crear el primero
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {eventos.map((e) => {
            const tipoUI = TIPOS_EVENTO[e.tipo] ?? TIPOS_EVENTO.otro;
            return (
              <Link
                key={e.id}
                href="/admin/agenda"
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition"
              >
                <span
                  className="w-1.5 self-stretch rounded-full shrink-0"
                  style={{ backgroundColor: tipoUI.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1A2A44] truncate">{e.titulo}</p>
                  <p className="text-[11px] text-slate-400 font-semibold flex flex-wrap items-center gap-x-2">
                    <span className="capitalize">{fechaLargaEvento(e.fecha)}</span>
                    {e.hora && <span>· {e.hora} hs</span>}
                    {e.ubicacion && (
                      <span className="flex items-center gap-0.5">
                        · <MapPin className="w-3 h-3" /> {e.ubicacion}
                      </span>
                    )}
                  </p>
                </div>
                <span
                  className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 hidden sm:block"
                  style={{ backgroundColor: `${tipoUI.color}1A`, color: tipoUI.color }}
                >
                  {tipoUI.nombre}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
