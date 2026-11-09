"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CalendarDays, ListOrdered, MapPin } from "lucide-react";
import {
  agruparPorFecha,
  esPasado,
  fechaLargaEvento,
  mesActual,
  TIPOS_EVENTO,
  type ItemAgenda,
} from "@/lib/core/rules/agendaRules";
import { CalendarioMensual } from "./CalendarioMensual";

/**
 * AGENDA EN SOLO LECTURA (Paso 17B): la usa el CLUB (y cualquier rol interno).
 * Lista + calendario mensual con los eventos de la liga y los partidos
 * (en el caso del club, filtrados a SUS equipos por la server action).
 * Los partidos linkean a su detalle; los eventos muestran su descripción.
 */
export function AgendaLectura({
  items,
  mensajeVacio = "Todavía no hay eventos ni partidos cargados en los próximos meses.",
}: {
  items: ItemAgenda[];
  mensajeVacio?: string;
}) {
  const router = useRouter();
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [mes, setMes] = useState(mesActual());

  const grupos = useMemo(() => agruparPorFecha(items), [items]);
  const fechas = useMemo(() => Array.from(grupos.keys()), [grupos]);

  const clickItem = (item: ItemAgenda) => {
    if (item.kind === "partido" && item.href) router.push(item.href);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
        {(
          [
            { id: "lista", nombre: "Lista", Icono: ListOrdered },
            { id: "calendario", nombre: "Calendario", Icono: CalendarDays },
          ] as const
        ).map(({ id, nombre, Icono }) => (
          <button
            key={id}
            type="button"
            onClick={() => setVista(id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition ${
              vista === id
                ? "bg-white text-[#1A2A44] shadow-sm"
                : "text-slate-500 hover:text-[#1A2A44]"
            }`}
          >
            <Icono className="w-3.5 h-3.5" />
            {nombre}
          </button>
        ))}
      </div>

      {vista === "lista" && (
        <div className="flex flex-col gap-5">
          {fechas.length === 0 && (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">{mensajeVacio}</p>
            </div>
          )}
          {fechas.map((fecha) => {
            const delDia = grupos.get(fecha) ?? [];
            return (
              <section key={fecha} className={esPasado(fecha) ? "opacity-55" : ""}>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                  {fechaLargaEvento(fecha)}
                </h3>
                <div className="flex flex-col gap-2">
                  {delDia.map((item) => (
                    <FilaLectura key={`${item.kind}-${item.id}`} item={item} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {vista === "calendario" && (
        <CalendarioMensual mes={mes} items={items} onCambiarMes={setMes} onClickItem={clickItem} />
      )}
    </div>
  );
}

function FilaLectura({ item }: { item: ItemAgenda }) {
  const esPartido = item.kind === "partido";
  const tipoUI = TIPOS_EVENTO[item.tipo ?? "otro"];
  const color = esPartido ? "#2563EB" : tipoUI.color;

  const contenido = (
    <div
      className={`bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3 transition ${
        esPartido && item.href ? "hover:border-blue-300" : ""
      }`}
    >
      <span
        className="w-1.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-[#1A2A44] text-sm">{item.titulo}</h4>
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            {esPartido ? "Partido" : tipoUI.nombre}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 font-semibold mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {item.hora && <span>{item.hora} hs</span>}
          {item.detalle && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {item.detalle}
            </span>
          )}
        </p>
      </div>
      {esPartido && item.href && (
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 shrink-0">
          Ver →
        </span>
      )}
    </div>
  );

  if (esPartido && item.href) {
    return (
      <a href={item.href} className="block">
        {contenido}
      </a>
    );
  }
  return contenido;
}
