"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Trash2, Loader2, Users, Send, CheckCircle2 } from "lucide-react";
import type { OficialPartido } from "@/lib/actions/planilla-en-vivo.actions";
import {
  designarOficial,
  listarArbitrosParaOficiales,
  quitarOficial,
} from "@/lib/actions/planilla-en-vivo.actions";

/**
 * GESTIÓN DE OFICIALES (federación) — Paso 17C
 * Desde la planilla del partido, la liga designa el 2do árbitro y el
 * planillero de mesa: designación directa (queda aceptada) o propuesta
 * (el oficial acepta o rechaza desde su panel).
 */
export function GestionOficiales({
  matchId,
  oficiales,
  arbitroPrincipalId,
}: {
  matchId: string;
  oficiales: OficialPartido[];
  arbitroPrincipalId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<"segundo_arbitro" | "planillero">("segundo_arbitro");
  const [modo, setModo] = useState<"directa" | "propuesta">("directa");
  const [arbitros, setArbitros] = useState<{ id: string; nombre: string }[]>([]);
  const [elegido, setElegido] = useState("");
  const [cargandoLista, setCargandoLista] = useState(false);

  const abrir = () => {
    setAbierto(true);
    if (arbitros.length === 0 && !cargandoLista) {
      setCargandoLista(true);
      void listarArbitrosParaOficiales().then((res) => {
        setArbitros(res.data ?? []);
        setCargandoLista(false);
      });
    }
  };

  const designar = () => {
    if (!elegido) return;
    startTransition(async () => {
      const res = await designarOficial(matchId, elegido, rol, modo);
      if (res.error) {
        alert(res.error);
        return;
      }
      setAbierto(false);
      setElegido("");
      router.refresh();
    });
  };

  const quitar = (id: string) => {
    if (!window.confirm("¿Quitar este oficial del partido?")) return;
    startTransition(async () => {
      const res = await quitarOficial(id);
      if (res.error) alert(res.error);
      router.refresh();
    });
  };

  const badgeEstado = (estado: OficialPartido["estado"]) =>
    estado === "aceptada"
      ? "bg-green-100 text-green-700"
      : estado === "pendiente"
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 print:hidden">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#F97316]" /> Oficiales del partido
        </h4>
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#1A2A44] text-white rounded-xl px-3 py-2 hover:bg-[#24355a] transition-colors"
        >
          <UserPlus className="w-3.5 h-3.5" /> Designar
        </button>
      </div>

      {oficiales.length === 0 ? (
        <p className="text-xs text-slate-400 italic">
          Solo con el árbitro principal (en categorías chicas es lo normal).
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {oficiales.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 font-semibold text-slate-700">
                {o.rol === "segundo_arbitro" ? "2do árbitro" : "Planillero"}: {o.nombre}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badgeEstado(o.estado)}`}>
                {o.estado === "aceptada" ? "Confirmado" : o.estado === "pendiente" ? "Propuesto" : "Rechazó"}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => quitar(o.id)}
                className="w-7 h-7 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                title="Quitar"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {abierto && (
        <div className="rounded-2xl border-2 border-[#F97316]/40 bg-orange-50/50 p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              Rol
              <select
                value={rol}
                onChange={(e) => setRol(e.target.value as typeof rol)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="segundo_arbitro">2do árbitro</option>
                <option value="planillero">Planillero de mesa</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              Modo
              <select
                value={modo}
                onChange={(e) => setModo(e.target.value as typeof modo)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="directa">Directa (queda confirmado)</option>
                <option value="propuesta">Propuesta (él acepta)</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Árbitro
            <select
              value={elegido}
              onChange={(e) => setElegido(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">
                {cargandoLista ? "Cargando colegio..." : "Elegí un árbitro"}
              </option>
              {arbitros
                .filter((a) => a.id !== arbitroPrincipalId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="flex-1 rounded-xl border border-slate-300 text-slate-600 font-bold text-xs py-2.5 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!elegido || pending}
              onClick={designar}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#F97316] hover:bg-[#ea6a0a] disabled:bg-slate-300 text-white font-bold text-xs py-2.5 transition-colors"
            >
              {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : modo === "propuesta" ? <Send className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {modo === "propuesta" ? "Proponer" : "Designar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
