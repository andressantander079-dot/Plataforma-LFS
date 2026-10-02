"use client";

import { useMemo, useRef, useState } from "react";
import {
  Megaphone,
  Users,
  Flag,
  X,
  Send,
  Loader2,
  Paperclip,
  FileText,
  CheckCircle2,
  Lock,
  Eye,
} from "lucide-react";
import { EditorTextoEnriquecido } from "./EditorTextoEnriquecido";
import { enviarComunicado } from "@/lib/actions/mensajeria.actions";
import type { ConversacionResumen } from "@/lib/actions/mensajeria.actions";

/**
 * REDACTAR COMUNICADO OFICIAL — solo la federación.
 * Asunto obligatorio + editor enriquecido + difusión a uno, varios o todos
 * los clubes y árbitros. Opción "No permitir respuestas" (solo lectura).
 */

interface PanelRedactarProps {
  destinatarios: ConversacionResumen[]; // clubes y árbitros (del panel admin)
  onCerrar: () => void;
  onEnviado: () => void;
}

function inicialesDe(nombre: string) {
  return (
    nombre
      .split(" ")
      .filter((p) => p.length > 2)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase() || nombre.slice(0, 2).toUpperCase()
  );
}

export function PanelRedactarComunicado({
  destinatarios,
  onCerrar,
  onEnviado,
}: PanelRedactarProps) {
  const clubes = useMemo(
    () => destinatarios.filter((d) => d.tipoDestino === "club"),
    [destinatarios]
  );
  const arbitros = useMemo(
    () => destinatarios.filter((d) => d.tipoDestino === "arbitro"),
    [destinatarios]
  );

  const [seleccionClubes, setSeleccionClubes] = useState<Set<string>>(new Set());
  const [seleccionArbitros, setSeleccionArbitros] = useState<Set<string>>(new Set());
  const [todosClubes, setTodosClubes] = useState(false);
  const [todosArbitros, setTodosArbitros] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [asunto, setAsunto] = useState("");
  const [cuerpoHtml, setCuerpoHtml] = useState("");
  const [sinRespuestas, setSinRespuestas] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  function alternar(tipo: "club" | "arbitro", id: string) {
    const set = tipo === "club" ? seleccionClubes : seleccionArbitros;
    const setSet = tipo === "club" ? setSeleccionClubes : setSeleccionArbitros;
    const nueva = new Set(set);
    if (nueva.has(id)) nueva.delete(id);
    else nueva.add(id);
    setSet(nueva);
  }

  const totalSeleccionados =
    (todosClubes ? clubes.length : seleccionClubes.size) +
    (todosArbitros ? arbitros.length : seleccionArbitros.size);

  const clubesVisibles = clubes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );
  const arbitrosVisibles = arbitros.filter((a) =>
    a.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function manejarEnvio() {
    if (enviando) return;
    setError(null);
    setExito(null);

    if (!totalSeleccionados) {
      setError("Elegí al menos un destinatario.");
      return;
    }

    setEnviando(true);
    const formData = new FormData();
    formData.set("asunto", asunto);
    formData.set("cuerpoHtml", cuerpoHtml);
    formData.set("sinRespuestas", String(sinRespuestas));
    formData.set(
      "clubes",
      JSON.stringify(todosClubes ? ["*"] : [...seleccionClubes])
    );
    formData.set(
      "arbitros",
      JSON.stringify(todosArbitros ? ["*"] : [...seleccionArbitros])
    );
    if (archivo) formData.set("archivo", archivo);

    const resultado = await enviarComunicado(formData);
    setEnviando(false);

    if ("error" in resultado && resultado.error) {
      setError(resultado.error);
      return;
    }
    const enviados = "enviados" in resultado ? Number(resultado.enviados) : 0;
    const emails = "emailsRegistrados" in resultado ? Number(resultado.emailsRegistrados) : 0;
    setExito(
      `Comunicado enviado a ${enviados} destinatario${enviados === 1 ? "" : "s"}. ` +
        `${emails > 0 ? `${emails} aviso${emails === 1 ? "" : "s"} por email quedaron registrados.` : ""}`
    );
    setTimeout(() => onEnviado(), 1800);
  }

  return (
    <div className="flex flex-col h-full bg-[#F4F6FA] overflow-y-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#1A2A44] to-[#24344F] text-white shrink-0 sticky top-0 z-10 shadow-md">
        <Megaphone className="w-5 h-5 text-[#F97316]" />
        <div className="flex-1 min-w-0">
          <h2 className="font-serif font-bold leading-tight">Nuevo comunicado oficial</h2>
          <p className="text-[11px] text-slate-300">
            Llega al chat de cada destinatario y queda registrado su aviso por email.
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
          aria-label="Cerrar compositor"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 p-4 flex flex-col gap-4 max-w-3xl w-full mx-auto">
        {/* Destinatarios */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
              Destinatarios
            </h3>
            <span
              className={`text-xs font-bold rounded-full px-2.5 py-1 ${
                totalSeleccionados
                  ? "bg-orange-100 text-[#EA580C]"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {totalSeleccionados} seleccionado{totalSeleccionados === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTodosClubes((v) => !v);
                if (!todosClubes) setSeleccionClubes(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                todosClubes
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#1A2A44]"
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Todos los clubes
            </button>
            <button
              type="button"
              onClick={() => {
                setTodosArbitros((v) => !v);
                if (!todosArbitros) setSeleccionArbitros(new Set());
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition border ${
                todosArbitros
                  ? "bg-[#1A2A44] text-white border-[#1A2A44]"
                  : "bg-white text-[#1A2A44] border-slate-300 hover:border-[#1A2A44]"
              }`}
            >
              <Flag className="w-3.5 h-3.5" /> Todos los árbitros
            </button>
          </div>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar club o árbitro…"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
          />

          <div className="max-h-44 overflow-y-auto flex flex-col divide-y divide-slate-100 -mx-1 px-1">
            {clubesVisibles.map((c) => (
              <label
                key={c.destinoId}
                className={`flex items-center gap-2.5 py-2 cursor-pointer rounded-lg px-2 hover:bg-slate-50 ${
                  todosClubes ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={todosClubes || seleccionClubes.has(c.destinoId)}
                  onChange={() => alternar("club", c.destinoId)}
                  className="accent-[#F97316] w-4 h-4"
                />
                <span className="w-7 h-7 rounded-full bg-[#1A2A44] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {inicialesDe(c.nombre)}
                </span>
                <span className="text-sm font-semibold text-[#1A2A44] truncate">{c.nombre}</span>
                <span className="ml-auto text-[10px] font-bold uppercase text-slate-400 shrink-0">
                  Club
                </span>
              </label>
            ))}
            {arbitrosVisibles.map((a) => (
              <label
                key={a.destinoId}
                className={`flex items-center gap-2.5 py-2 cursor-pointer rounded-lg px-2 hover:bg-slate-50 ${
                  todosArbitros ? "opacity-40 pointer-events-none" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={todosArbitros || seleccionArbitros.has(a.destinoId)}
                  onChange={() => alternar("arbitro", a.destinoId)}
                  className="accent-[#F97316] w-4 h-4"
                />
                <span className="w-7 h-7 rounded-full bg-[#4A5D7A] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {inicialesDe(a.nombre)}
                </span>
                <span className="text-sm font-semibold text-[#1A2A44] truncate">{a.nombre}</span>
                <span className="ml-auto text-[10px] font-bold uppercase text-slate-400 shrink-0">
                  Árbitro
                </span>
              </label>
            ))}
            {!clubesVisibles.length && !arbitrosVisibles.length && (
              <p className="text-xs text-slate-400 py-3 text-center">
                Nadie coincide con “{busqueda}”.
              </p>
            )}
          </div>
        </section>

        {/* Asunto */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
          <label className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
            Asunto <span className="text-[#EA580C]">*</span>
          </label>
          <input
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            maxLength={120}
            placeholder="Ej.: Suspensión de la Fecha 12 por temporal"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-semibold text-[#1A2A44] focus:outline-none focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316]"
          />
        </section>

        {/* Cuerpo */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-black text-[#1A2A44] uppercase tracking-wide">
              Cuerpo del mensaje <span className="text-[#EA580C]">*</span>
            </label>
            <button
              type="button"
              onClick={() => setVistaPrevia((v) => !v)}
              className={`flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 transition ${
                vistaPrevia
                  ? "bg-[#1A2A44] text-white"
                  : "text-[#1A2A44] hover:bg-slate-100"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Vista previa
            </button>
          </div>
          {vistaPrevia ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 min-h-[220px]">
              <div
                className="prose-lfs text-sm text-slate-700"
                dangerouslySetInnerHTML={{ __html: cuerpoHtml }}
              />
            </div>
          ) : (
            <EditorTextoEnriquecido
              onChange={setCuerpoHtml}
              placeholder="Redactá el comunicado con el formato que necesites…"
            />
          )}
        </section>

        {/* Opciones */}
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sinRespuestas}
              onChange={(e) => setSinRespuestas(e.target.checked)}
              className="accent-[#F97316] w-4 h-4 mt-0.5"
            />
            <span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-[#1A2A44]">
                <Lock className="w-3.5 h-3.5 text-[#EA580C]" /> No permitir respuestas
              </span>
              <span className="text-xs text-slate-500 block mt-0.5">
                El chat de cada destinatario queda en solo lectura hasta que la federación
                escriba de nuevo. Ideal para resoluciones y disposiciones.
              </span>
            </span>
          </label>

          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={inputArchivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onClick={() => inputArchivoRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-[#1A2A44] hover:bg-slate-50 transition"
            >
              <Paperclip className="w-4 h-4 text-[#F97316]" /> Adjuntar archivo
            </button>
            {archivo && (
              <span className="inline-flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 text-xs font-semibold text-[#1A2A44]">
                <FileText className="w-4 h-4 text-[#F97316]" />
                <span className="truncate max-w-[200px]">{archivo.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setArchivo(null);
                    if (inputArchivoRef.current) inputArchivoRef.current.value = "";
                  }}
                  className="text-slate-400 hover:text-red-500"
                  aria-label="Quitar adjunto"
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            )}
          </div>
        </section>

        {/* Estado + acción */}
        {error && (
          <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        {exito && (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4" /> {exito}
          </p>
        )}

        <div
          className="sticky bottom-0 pb-2"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={manejarEnvio}
            disabled={enviando || !totalSeleccionados}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white font-black text-sm py-3.5 shadow-lg shadow-orange-500/30 hover:brightness-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {enviando ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            {enviando
              ? "Enviando…"
              : `Enviar comunicado a ${totalSeleccionados} destinatario${totalSeleccionados === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
