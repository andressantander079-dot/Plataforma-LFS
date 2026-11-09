"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  AUDIENCIAS_AVISO,
  TIPOS_EVENTO_LISTA,
  validarEvento,
  type AudienciaAviso,
  type TipoEvento,
} from "@/lib/core/rules/agendaRules";
import type { EventoLigaUI } from "@/lib/actions/agenda.actions";

/**
 * Modal para crear / editar / duplicar un evento de la liga.
 * Valida en cliente con la MISMA regla pura que usa el servidor.
 * El aviso por mensajería solo se elige al CREAR (o duplicar): al editar
 * un evento ya avisado no se vuelve a mandar nada.
 */
export function FormularioEvento({
  evento,
  procesando,
  onGuardar,
  onCerrar,
}: {
  /** null = crear · con datos = editar o duplicar (según evento.id) */
  evento: EventoLigaUI | null;
  procesando: boolean;
  onGuardar: (datos: {
    id?: string;
    titulo: string;
    tipo: TipoEvento;
    fecha: string;
    hora: string | null;
    ubicacion: string | null;
    descripcion: string | null;
    avisar: AudienciaAviso;
  }) => void;
  onCerrar: () => void;
}) {
  const esEdicion = Boolean(evento?.id);
  const [titulo, setTitulo] = useState(evento?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoEvento>(evento?.tipo ?? "reunion_delegados");
  const [fecha, setFecha] = useState(evento?.fecha ?? "");
  const [hora, setHora] = useState(evento?.hora ?? "");
  const [ubicacion, setUbicacion] = useState(evento?.ubicacion ?? "");
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? "");
  const [avisar, setAvisar] = useState<AudienciaAviso>(evento?.avisar ?? "nadie");
  const [errores, setErrores] = useState<Record<string, string>>({});

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    const datos = {
      titulo: titulo.trim(),
      tipo,
      fecha,
      hora: hora.trim() === "" ? null : hora.trim(),
      ubicacion: ubicacion.trim() === "" ? null : ubicacion.trim(),
      descripcion: descripcion.trim() === "" ? null : descripcion.trim(),
      avisar,
    };
    const fallas = validarEvento(datos);
    setErrores(fallas);
    if (Object.keys(fallas).length > 0) return;
    onGuardar({ ...(esEdicion ? { id: evento!.id } : {}), ...datos });
  };

  const campoError = (campo: string) =>
    errores[campo] ? (
      <span className="text-[11px] font-bold text-rose-600 mt-1 block">{errores[campo]}</span>
    ) : null;

  const claseInput = (campo: string) =>
    `w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold text-[#1A2A44] placeholder:text-slate-300 focus:outline-none focus:ring-2 transition ${
      errores[campo]
        ? "border-rose-300 focus:ring-rose-200"
        : "border-slate-200 focus:border-[#F97316] focus:ring-orange-100"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#1A2A44]/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl sm:rounded-t-2xl z-10">
          <h3 className="font-serif text-lg font-black text-[#1A2A44]">
            {esEdicion ? "Editar evento" : "Nuevo evento"}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={enviar} className="p-5 flex flex-col gap-4" noValidate>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
              Título *
            </label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Reunión de delegados — Fecha 6"
              className={claseInput("titulo")}
              maxLength={140}
            />
            {campoError("titulo")}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Tipo *
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoEvento)}
                className={claseInput("tipo")}
              >
                {TIPOS_EVENTO_LISTA.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              {campoError("tipo")}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Fecha *
              </label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={claseInput("fecha")}
              />
              {campoError("fecha")}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Hora (opcional)
              </label>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={claseInput("hora")}
              />
              {campoError("hora")}
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                Ubicación
              </label>
              <input
                type="text"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                placeholder="Ej: Sede LFS, Ushuaia"
                className={claseInput("ubicacion")}
                maxLength={140}
              />
              {campoError("ubicacion")}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
              Descripción
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Detalles para los clubes y árbitros (opcional)"
              className={`${claseInput("descripcion")} min-h-[80px] resize-y`}
              maxLength={500}
            />
            {campoError("descripcion")}
          </div>

          {!esEdicion && (
            <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#F97316] block mb-1.5">
                Avisar por mensajería
              </label>
              <select
                value={avisar}
                onChange={(e) => setAvisar(e.target.value as AudienciaAviso)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-orange-200 bg-white text-sm font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-orange-100 transition"
              >
                {(Object.entries(AUDIENCIAS_AVISO) as Array<[AudienciaAviso, string]>).map(
                  ([id, nombre]) => (
                    <option key={id} value={id}>
                      {nombre}
                    </option>
                  )
                )}
              </select>
              <p className="text-[11px] text-slate-500 mt-2">
                Si elegís una audiencia, al guardar se manda un comunicado con los datos del
                evento. Solo se avisa al crear: después podés editarlo sin reenviar nada.
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCerrar}
              disabled={procesando}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={procesando}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-black uppercase tracking-widest transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {procesando && <Loader2 className="w-4 h-4 animate-spin" />}
              {esEdicion ? "Guardar cambios" : "Crear evento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
