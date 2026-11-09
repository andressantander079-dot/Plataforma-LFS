"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  celdasDelMes,
  etiquetaMes,
  mesActual,
  mesMovido,
  TIPOS_EVENTO,
  type ItemAgenda,
} from "@/lib/core/rules/agendaRules";

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Grilla mensual de 42 celdas (semana empezando lunes) con los ítems de la
 * agenda (eventos propios con su color + partidos del fixture en azul).
 * Los ítems son clickeables: el padre decide qué hacer (abrir edición,
 * navegar al detalle, etc.).
 */
export function CalendarioMensual({
  mes,
  items,
  onCambiarMes,
  onClickItem,
}: {
  mes: string; // 'YYYY-MM'
  items: ItemAgenda[];
  onCambiarMes: (mes: string) => void;
  onClickItem?: (item: ItemAgenda) => void;
}) {
  const celdas = celdasDelMes(mes);
  const itemsPorFecha = new Map<string, ItemAgenda[]>();
  for (const item of items) {
    const lista = itemsPorFecha.get(item.fecha) ?? [];
    lista.push(item);
    itemsPorFecha.set(item.fecha, lista);
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
      {/* Cabecera con navegación */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <button
          type="button"
          onClick={() => onCambiarMes(mesMovido(mes, -1))}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <h3 className="font-serif text-lg font-black text-[#1A2A44]">{etiquetaMes(mes)}</h3>
          {mes !== mesActual() && (
            <button
              type="button"
              onClick={() => onCambiarMes(mesActual())}
              className="text-[10px] font-black uppercase tracking-widest text-[#F97316] hover:underline"
            >
              Hoy
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => onCambiarMes(mesMovido(mes, 1))}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Celdas */}
      <div className="grid grid-cols-7">
        {celdas.map((celda, i) => {
          const delDia = itemsPorFecha.get(celda.fecha) ?? [];
          return (
            <div
              key={celda.fecha}
              className={`min-h-[86px] md:min-h-[104px] border-b border-slate-100 p-1.5 flex flex-col gap-1 ${
                i % 7 !== 6 ? "border-r" : ""
              } ${celda.esDelMes ? "bg-white" : "bg-slate-50/40"}`}
            >
              <span
                className={`text-[11px] font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  celda.esHoy
                    ? "bg-[#F97316] text-white"
                    : celda.esDelMes
                      ? "text-[#1A2A44]"
                      : "text-slate-300"
                }`}
              >
                {celda.dia}
              </span>
              <div className="flex flex-col gap-1">
                {delDia.slice(0, 3).map((item) => {
                  const color =
                    item.kind === "partido"
                      ? "#2563EB"
                      : (TIPOS_EVENTO[item.tipo ?? "otro"]?.color ?? "#64748B");
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => onClickItem?.(item)}
                      className="text-left text-[10px] leading-tight font-bold rounded-md px-1.5 py-1 truncate hover:opacity-80 transition"
                      style={{ backgroundColor: `${color}1A`, color }}
                      title={`${item.hora ? `${item.hora} · ` : ""}${item.titulo}${item.detalle ? ` · ${item.detalle}` : ""}`}
                    >
                      {item.kind === "partido" && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle"
                          style={{ backgroundColor: color }}
                        />
                      )}
                      {item.hora ? `${item.hora} ` : ""}
                      {item.titulo}
                    </button>
                  );
                })}
                {delDia.length > 3 && (
                  <span className="text-[9px] font-bold text-slate-400 px-1">
                    +{delDia.length - 3} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
