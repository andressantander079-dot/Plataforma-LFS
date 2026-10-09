"use client";

import { useState, useTransition } from "react";
import {
  Award,
  CircleAlert,
  Loader2,
  PencilLine,
  Phone,
  Mail,
  UserCheck,
  UserX,
  UserPlus,
  X,
} from "lucide-react";
import {
  actualizarArbitroAdmin,
  type NivelArbitroUI,
  type PadronArbitroUI,
} from "@/lib/actions/arbitros.actions";
import { ESTADO_ARBITRO_UI } from "@/lib/core/rules/arbitrosRules";
import { PanelRegistrarArbitro } from "./PanelRegistrarArbitro";

/**
 * COLEGIO DE ÁRBITROS (admin) — padrón completo: foto, contacto, nivel,
 * estado y stats reales. La liga fija nivel, estado y tarifa personalizada
 * desde el editor de cada tarjeta.
 */
export function ColegioArbitros({
  padron,
  niveles,
}: {
  padron: PadronArbitroUI[];
  niveles: NivelArbitroUI[];
}) {
  const [editando, setEditando] = useState<PadronArbitroUI | null>(null);
  const [registrando, setRegistrando] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de acción superior del padrón */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div>
          <h2 className="font-serif font-black text-[#1A2A44] text-base">
            Padrón Oficial de Árbitros
          </h2>
          <p className="text-xs text-slate-500">
            {padron.length === 0
              ? "No hay árbitros registrados en el padrón de la liga."
              : `${padron.length} ${padron.length === 1 ? "árbitro habilitado" : "árbitros habilitados"} para designaciones.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegistrando(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-bold text-xs shadow-sm transition active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Registrar Árbitro</span>
        </button>
      </div>

      {padron.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm flex flex-col items-center gap-3">
          <p className="font-serif text-lg font-bold text-[#1A2A44]">Sin árbitros en el padrón</p>
          <p className="text-xs text-slate-500 max-w-md">
            Registrá a los árbitros de la liga para asignarles nivel, tarifas y crearles su cuenta de acceso para ver designaciones y cargar planillas.
          </p>
          <button
            type="button"
            onClick={() => setRegistrando(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#ea580c] text-white font-bold text-xs shadow-md transition mt-1 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Registrar Primer Árbitro</span>
          </button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {padron.map((a) => {
          const estadoUi = ESTADO_ARBITRO_UI[a.estado] ?? ESTADO_ARBITRO_UI.activo;
          return (
            <div
              key={a.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                {a.fotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.fotoUrl}
                    alt={a.nombre}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-100 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#1A2A44] text-white flex items-center justify-center font-black text-lg shrink-0">
                    {a.nombre.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-black text-[#1A2A44] truncate">{a.nombre}</p>
                  <p className="text-[10px] font-bold text-[#F97316] flex items-center gap-1">
                    <Award className="w-3 h-3" /> {a.nivelNombre ?? "Sin nivel asignado"}
                  </p>
                  <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5">
                    {a.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" /> {a.email}
                      </span>
                    )}
                    {a.telefono && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 shrink-0" /> {a.telefono}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${estadoUi.className}`}>
                  {estadoUi.label}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center border-t border-slate-100 pt-3">
                <div>
                  <p className="font-black text-sm text-[#1A2A44]">{a.dirigidos}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Partidos</p>
                </div>
                <div>
                  <p className="font-black text-sm text-amber-600">{a.amarillasPromedio}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Amarillas/p</p>
                </div>
                <div>
                  <p className="font-black text-sm text-red-600">{a.rojasTotal}</p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Rojas</p>
                </div>
              </div>

              <button
                onClick={() => setEditando(a)}
                className="w-full py-2 rounded-xl border border-slate-200 hover:border-[#F97316] hover:text-[#F97316] text-xs font-bold text-slate-600 transition flex items-center justify-center gap-1.5"
              >
                <PencilLine className="w-3.5 h-3.5" /> Editar nivel y estado
              </button>
            </div>
          );
        })}
      </div>

      {editando && (
        <EditorArbitro
          arbitro={editando}
          niveles={niveles}
          onCerrar={() => setEditando(null)}
        />
      )}

      {registrando && (
        <PanelRegistrarArbitro
          abierto={registrando}
          onCerrar={() => setRegistrando(false)}
          niveles={niveles}
        />
      )}
    </div>
  );
}

function EditorArbitro({
  arbitro,
  niveles,
  onCerrar,
}: {
  arbitro: PadronArbitroUI;
  niveles: NivelArbitroUI[];
  onCerrar: () => void;
}) {
  const [levelId, setLevelId] = useState<string>(arbitro.nivelId ?? "");
  const [estado, setEstado] = useState<"activo" | "suspendido">(
    arbitro.estado === "suspendido" ? "suspendido" : "activo"
  );
  const [tarifa, setTarifa] = useState<string>(
    arbitro.tarifaOverride != null ? String(arbitro.tarifaOverride) : ""
  );
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const guardar = () => {
    setAviso(null);
    if (estado === "suspendido" && !window.confirm(`¿Suspender a ${arbitro.nombre}? No se lo va a poder designar.`)) {
      return;
    }
    startTransition(async () => {
      const res = await actualizarArbitroAdmin({
        userId: arbitro.id,
        levelId: levelId || null,
        estado,
        tarifaOverride: tarifa.trim() === "" ? null : Number(tarifa),
      });
      if (res?.error) setAviso(res.error);
      else onCerrar();
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-black text-[#1A2A44]">{arbitro.nombre}</h3>
          <button onClick={onCerrar} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
            Nivel / categoría arbitral
          </label>
          <select
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          >
            <option value="">Sin nivel</option>
            {niveles.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre} (${n.tarifa_partido.toLocaleString("es-AR")}/partido)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
            Estado
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setEstado("activo")}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition flex items-center justify-center gap-1.5 ${
                estado === "activo"
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" /> Activo
            </button>
            <button
              onClick={() => setEstado("suspendido")}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border-2 transition flex items-center justify-center gap-1.5 ${
                estado === "suspendido"
                  ? "border-red-500 bg-red-50 text-red-700"
                  : "border-slate-200 text-slate-500"
              }`}
            >
              <UserX className="w-3.5 h-3.5" /> Suspendido
            </button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
            Tarifa personalizada por partido (opcional — pisa la del nivel)
          </label>
          <input
            type="number"
            min={0}
            value={tarifa}
            onChange={(e) => setTarifa(e.target.value)}
            placeholder="Dejalo vacío para usar la tarifa del nivel"
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60"
          />
        </div>

        {aviso && (
          <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
            <CircleAlert className="w-3.5 h-3.5" /> {aviso}
          </p>
        )}

        <button
          onClick={guardar}
          disabled={pendiente}
          className="w-full py-3 rounded-xl bg-[#1A2A44] hover:bg-[#25375a] text-white font-black text-sm transition flex items-center justify-center gap-2"
        >
          {pendiente && <Loader2 className="w-4 h-4 animate-spin" />}
          Guardar cambios
        </button>
      </div>
    </div>
  );
}
