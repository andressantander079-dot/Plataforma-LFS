"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Copy,
  ListOrdered,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  agruparPorFecha,
  esPasado,
  fechaLargaEvento,
  mesActual,
  TIPOS_EVENTO,
  type ItemAgenda,
} from "@/lib/core/rules/agendaRules";
import {
  eliminarEvento,
  guardarEvento,
  type AgendaCompleta,
  type EventoLigaUI,
} from "@/lib/actions/agenda.actions";
import { CalendarioMensual } from "./CalendarioMensual";
import { FormularioEvento } from "./FormularioEvento";

type Vista = "lista" | "calendario";

interface ModalState {
  evento: EventoLigaUI | null; // null = crear
}

/**
 * AGENDA DEL ADMIN (Paso 17B): lista + calendario mensual con los eventos
 * propios de la liga y los partidos del fixture (solo lectura, linkean al
 * detalle). Crear / editar / duplicar / eliminar eventos, con aviso opcional
 * por mensajería al crear.
 */
export function AgendaAdmin({ agenda }: { agenda: AgendaCompleta }) {
  const router = useRouter();
  const [vista, setVista] = useState<Vista>("lista");
  const [mes, setMes] = useState(mesActual());
  const [modal, setModal] = useState<ModalState | null>(null);
  const [avisos, setAvisos] = useState<{ ok: boolean; texto: string } | null>(null);
  const [procesando, startTransition] = useTransition();

  const eventoPorId = useMemo(
    () => new Map(agenda.eventos.map((e) => [e.id, e])),
    [agenda.eventos]
  );
  const grupos = useMemo(() => agruparPorFecha(agenda.items), [agenda.items]);
  const fechas = useMemo(() => Array.from(grupos.keys()), [grupos]);

  const mostrarAviso = (ok: boolean, texto: string) => {
    setAvisos({ ok, texto });
    window.setTimeout(() => setAvisos(null), 5000);
  };

  const abrirDuplicar = (evento: EventoLigaUI) => {
    // Duplicar = crear con los datos precargados, sin id y sin reenviar aviso
    setModal({ evento: { ...evento, id: "", avisar: "nadie", avisadoAt: null } });
  };

  const handleGuardar = (datos: Parameters<typeof guardarEvento>[0]) => {
    startTransition(async () => {
      const res = await guardarEvento(datos);
      if (res.ok) {
        setModal(null);
        mostrarAviso(
          true,
          datos.id
            ? "Evento actualizado."
            : res.avisoEnviado
              ? "Evento creado y aviso enviado por mensajería."
              : "Evento creado."
        );
        router.refresh();
      } else {
        mostrarAviso(false, res.error ?? "No se pudo guardar el evento.");
      }
    });
  };

  const handleEliminar = (evento: EventoLigaUI) => {
    if (!window.confirm(`¿Eliminar "${evento.titulo}"? Esta acción no se puede deshacer.`)) {
      return;
    }
    startTransition(async () => {
      const res = await eliminarEvento(evento.id);
      mostrarAviso(res.ok, res.ok ? "Evento eliminado." : (res.error ?? "No se pudo eliminar."));
      if (res.ok) router.refresh();
    });
  };

  const clickItemCalendario = (item: ItemAgenda) => {
    if (item.kind === "partido") {
      if (item.href) router.push(item.href);
      return;
    }
    const evento = eventoPorId.get(item.id);
    if (evento) setModal({ evento });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Aviso flotante */}
      {avisos && (
        <div
          className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white ${
            avisos.ok ? "bg-emerald-600" : "bg-rose-600"
          }`}
        >
          {avisos.ok ? <CheckCircle2 className="w-4 h-4" /> : <CircleAlert className="w-4 h-4" />}
          {avisos.texto}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex bg-slate-100 rounded-xl p-1">
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
        <button
          type="button"
          onClick={() => setModal({ evento: null })}
          className="px-4 py-2.5 bg-[#F97316] hover:bg-[#EA580C] text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-md flex items-center gap-1.5 transition"
        >
          <Plus className="w-4 h-4" /> Nuevo evento
        </button>
      </div>

      {procesando && (
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Guardando…
        </div>
      )}

      {/* Vista LISTA */}
      {vista === "lista" && (
        <div className="flex flex-col gap-5">
          {fechas.length === 0 && (
            <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">
                No hay eventos ni partidos cargados en los próximos meses.
              </p>
            </div>
          )}
          {fechas.map((fecha) => {
            const items = grupos.get(fecha) ?? [];
            const pasado = esPasado(fecha);
            return (
              <section key={fecha} className={pasado ? "opacity-55" : ""}>
                <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#F97316]" />
                  {fechaLargaEvento(fecha)}
                </h3>
                <div className="flex flex-col gap-2">
                  {items.map((item) =>
                    item.kind === "partido" ? (
                      <FilaPartido key={`p-${item.id}`} item={item} />
                    ) : (
                      <FilaEvento
                        key={`e-${item.id}`}
                        item={item}
                        evento={eventoPorId.get(item.id) ?? null}
                        onEditar={(e) => setModal({ evento: e })}
                        onDuplicar={abrirDuplicar}
                        onEliminar={handleEliminar}
                      />
                    )
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Vista CALENDARIO */}
      {vista === "calendario" && (
        <CalendarioMensual
          mes={mes}
          items={agenda.items}
          onCambiarMes={setMes}
          onClickItem={clickItemCalendario}
        />
      )}

      {/* Modal crear / editar / duplicar */}
      {modal && (
        <FormularioEvento
          evento={modal.evento}
          procesando={procesando}
          onGuardar={handleGuardar}
          onCerrar={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filas
// ---------------------------------------------------------------------------

function FilaEvento({
  item,
  evento,
  onEditar,
  onDuplicar,
  onEliminar,
}: {
  item: ItemAgenda;
  evento: EventoLigaUI | null;
  onEditar: (e: EventoLigaUI) => void;
  onDuplicar: (e: EventoLigaUI) => void;
  onEliminar: (e: EventoLigaUI) => void;
}) {
  if (!evento) return null;
  const tipoUI = TIPOS_EVENTO[item.tipo ?? "otro"];
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3 hover:border-slate-300 transition">
      <span
        className="w-1.5 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: tipoUI.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-[#1A2A44] text-sm">{item.titulo}</h4>
          <span
            className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${tipoUI.color}1A`, color: tipoUI.color }}
          >
            {tipoUI.nombre}
          </span>
          {evento.avisadoAt && (
            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
              Avisado
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-400 font-semibold mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {item.hora && <span>{item.hora} hs</span>}
          {item.detalle && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {item.detalle}
            </span>
          )}
        </p>
        {evento.descripcion && (
          <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{evento.descripcion}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onEditar(evento)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1A2A44] transition"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDuplicar(evento)}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-[#1A2A44] transition"
          title="Duplicar"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onEliminar(evento)}
          className="p-2 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function FilaPartido({ item }: { item: ItemAgenda }) {
  const contenido = (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-start gap-3 hover:border-blue-300 transition">
      <span className="w-1.5 self-stretch rounded-full shrink-0 bg-blue-600" />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-[#1A2A44] text-sm">{item.titulo}</h4>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
            Partido
          </span>
        </div>
        {item.detalle && (
          <p className="text-[11px] text-slate-400 font-semibold mt-1">
            {item.hora ? `${item.hora} hs · ` : ""}
            {item.detalle}
          </p>
        )}
      </div>
      {item.href && (
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 shrink-0">
          Ver →
        </span>
      )}
    </div>
  );
  if (!item.href) return contenido;
  return (
    <a href={item.href} className="block">
      {contenido}
    </a>
  );
}
