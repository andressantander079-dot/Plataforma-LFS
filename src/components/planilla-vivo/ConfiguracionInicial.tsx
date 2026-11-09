"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Users,
  Palette,
  ClipboardCheck,
  Loader2,
  Crown,
  Hash,
} from "lucide-react";
import type { PlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import {
  configurarReloj,
  confirmarStaff,
  guardarCapitan,
  guardarColores,
  guardarNumeroCamiseta,
  iniciarPartido,
} from "@/lib/actions/planilla-en-vivo.actions";
import {
  construirSemaforo,
  numerosDuplicados,
  puedeIniciarPartido,
} from "@/lib/core/rules/planillaPremiumRules";

/**
 * CONFIGURACIÓN INICIAL + SEMÁFORO PRE-PARTIDO — Paso 17C
 * Antes de arrancar: duración del reloj, colores de camiseta, cuerpo
 * técnico (DTs y planillero), números y capitanes. El semáforo marca
 * qué falta; solo lo bloqueante frena el inicio.
 */
export function ConfiguracionInicial({ planilla }: { planilla: PlanillaEnVivo }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [duracion, setDuracion] = useState(planilla.duracionTiempoMin);
  const [entretiempo, setEntretiempo] = useState(planilla.duracionEntretiempoMin);
  const [colorLocal, setColorLocal] = useState(planilla.colorLocal ?? "#1A2A44");
  const [colorVisitante, setColorVisitante] = useState(planilla.colorVisitante ?? "#F97316");
  const [dtLocal, setDtLocal] = useState(planilla.cuerpoTecnico.dtLocal);
  const [ayudanteLocal, setAyudanteLocal] = useState(planilla.cuerpoTecnico.ayudanteLocal);
  const [dtVisitante, setDtVisitante] = useState(planilla.cuerpoTecnico.dtVisitante);
  const [ayudanteVisitante, setAyudanteVisitante] = useState(planilla.cuerpoTecnico.ayudanteVisitante);
  const [planilleroNombre, setPlanilleroNombre] = useState(planilla.cuerpoTecnico.planilleroNombre);

  const convLocal = useMemo(
    () => planilla.convocados.filter((c) => c.teamId === planilla.homeTeamId),
    [planilla]
  );
  const convVisitante = useMemo(
    () => planilla.convocados.filter((c) => c.teamId === planilla.awayTeamId),
    [planilla]
  );

  const semaforo = useMemo(
    () =>
      construirSemaforo({
        convocatoriaLocalConfirmada: Boolean(planilla.confirmadaLocal),
        convocatoriaVisitanteConfirmada: Boolean(planilla.confirmadaVisitante),
        titularesLocal: convLocal.filter((c) => c.esTitular).length,
        titularesVisitante: convVisitante.filter((c) => c.esTitular).length,
        capitanLocal: Boolean(planilla.capitanLocalId),
        capitanVisitante: Boolean(planilla.capitanVisitanteId),
        numerosDuplicadosLocal: numerosDuplicados(convLocal.map((c) => c.numero)),
        numerosDuplicadosVisitante: numerosDuplicados(convVisitante.map((c) => c.numero)),
        segundoArbitroAsignado: planilla.oficiales.some(
          (o) => o.rol === "segundo_arbitro" && o.estado === "aceptada"
        ),
        planilleroAsignado:
          planilla.oficiales.some((o) => o.rol === "planillero" && o.estado === "aceptada") ||
          Boolean(planilla.cuerpoTecnico.planilleroNombre),
      }),
    [planilla, convLocal, convVisitante]
  );
  const listoParaArrancar = puedeIniciarPartido(semaforo);

  const ejecutar = (fn: () => Promise<{ ok?: boolean; error?: string }>, onOk?: () => void) => {
    startTransition(async () => {
      const res = await fn();
      if (res.error) alert(res.error);
      else {
        onOk?.();
        router.refresh();
      }
    });
  };

  const inputClase =
    "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316] outline-none";

  const renderEquipo = (
    titulo: string,
    convocados: typeof convLocal,
    capitanId: string | null,
    teamId: string
  ) => (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
      <h4 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
        <Users className="w-4 h-4 text-[#F97316]" /> {titulo}
      </h4>
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
        {convocados.map((c) => (
          <div
            key={c.sheetPlayerId}
            className="flex items-center gap-2 text-sm border-b border-slate-100 pb-1.5"
          >
            <button
              type="button"
              title={capitanId === c.playerId ? "Es el capitán" : "Marcar capitán"}
              disabled={pending || !planilla.puedeCargar}
              onClick={() => ejecutar(() => guardarCapitan(planilla.matchId, teamId, c.playerId))}
              className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                capitanId === c.playerId
                  ? "bg-amber-400 text-white"
                  : "bg-slate-100 text-slate-400 hover:bg-amber-100 hover:text-amber-500"
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 truncate">
              {c.nombre}
              {!c.esTitular && <span className="text-[10px] text-slate-400 ml-1">(suplente)</span>}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Hash className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="number"
                min={1}
                max={99}
                defaultValue={c.numero ?? ""}
                disabled={pending || !planilla.puedeCargar}
                onBlur={(e) => {
                  const valor = e.target.value === "" ? null : Number(e.target.value);
                  if (valor !== c.numero) {
                    ejecutar(() => guardarNumeroCamiseta(planilla.matchId, c.sheetPlayerId, valor));
                  }
                }}
                placeholder="—"
                className="w-12 rounded-lg border border-slate-300 px-1.5 py-1 text-xs text-center focus:ring-2 focus:ring-[#F97316]/60 outline-none"
              />
            </div>
          </div>
        ))}
        {convocados.length === 0 && (
          <p className="text-xs text-slate-400 italic">Sin convocados todavía.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* SEMÁFORO */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <h3 className="font-serif text-lg font-black text-[#1A2A44] flex items-center gap-2 mb-4">
          <ClipboardCheck className="w-5 h-5 text-[#F97316]" />
          Semáforo pre-partido
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {semaforo.map((item) => (
            <div
              key={item.clave}
              className={`flex items-start gap-3 rounded-2xl border p-3 ${
                item.estado === "ok"
                  ? "border-green-200 bg-green-50"
                  : item.estado === "advertencia"
                    ? "border-amber-200 bg-amber-50"
                    : "border-red-200 bg-red-50"
              }`}
            >
              {item.estado === "ok" ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
              ) : item.estado === "advertencia" ? (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-bold text-sm text-slate-800">{item.titulo}</p>
                <p className="text-xs text-slate-500">{item.detalle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* NÚMEROS Y CAPITANES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderEquipo(`${planilla.local} (Local)`, convLocal, planilla.capitanLocalId, planilla.homeTeamId)}
        {renderEquipo(`${planilla.visitante} (Visitante)`, convVisitante, planilla.capitanVisitanteId, planilla.awayTeamId)}
      </div>

      {/* RELOJ + COLORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
          <h4 className="font-bold text-sm text-[#1A2A44]">Duración del partido</h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              Minutos por tiempo
              <input
                type="number"
                min={5}
                max={45}
                value={duracion}
                onChange={(e) => setDuracion(Number(e.target.value))}
                disabled={pending || !planilla.puedeCerrar}
                className={inputClase}
              />
            </label>
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              Entretiempo
              <input
                type="number"
                min={1}
                max={20}
                value={entretiempo}
                onChange={(e) => setEntretiempo(Number(e.target.value))}
                disabled={pending || !planilla.puedeCerrar}
                className={inputClase}
              />
            </label>
          </div>
          {planilla.puedeCerrar && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                ejecutar(() =>
                  configurarReloj(planilla.matchId, {
                    duracionTiempoMin: duracion,
                    duracionEntretiempoMin: entretiempo,
                  })
                )
              }
              className="self-start text-xs font-bold bg-[#1A2A44] text-white rounded-xl px-4 py-2 hover:bg-[#24355a] disabled:bg-slate-300 transition-colors"
            >
              Guardar duración
            </button>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
          <h4 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#F97316]" /> Colores de camiseta
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              {planilla.local}
              <input
                type="color"
                value={colorLocal}
                onChange={(e) => setColorLocal(e.target.value)}
                disabled={!planilla.puedeCargar}
                className="w-full h-10 rounded-xl border border-slate-300 cursor-pointer"
              />
            </label>
            <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
              {planilla.visitante}
              <input
                type="color"
                value={colorVisitante}
                onChange={(e) => setColorVisitante(e.target.value)}
                disabled={!planilla.puedeCargar}
                className="w-full h-10 rounded-xl border border-slate-300 cursor-pointer"
              />
            </label>
          </div>
          {planilla.puedeCargar && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                ejecutar(() =>
                  guardarColores(planilla.matchId, {
                    colorLocal,
                    colorVisitante,
                  })
                )
              }
              className="self-start text-xs font-bold bg-[#1A2A44] text-white rounded-xl px-4 py-2 hover:bg-[#24355a] disabled:bg-slate-300 transition-colors"
            >
              Guardar colores
            </button>
          )}
        </div>
      </div>

      {/* CUERPO TÉCNICO */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3">
        <h4 className="font-bold text-sm text-[#1A2A44]">Cuerpo técnico y planillero</h4>
        <p className="text-xs text-slate-500">
          Los clubes precargan a su DT; acá confirmás o corregís. Estos nombres van impresos en la
          planilla debajo de cada firma.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            DT de {planilla.local}
            <input value={dtLocal} onChange={(e) => setDtLocal(e.target.value)} disabled={pending || !planilla.puedeCerrar} className={inputClase} placeholder="Nombre y apellido" />
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Ayudante de {planilla.local}
            <input value={ayudanteLocal} onChange={(e) => setAyudanteLocal(e.target.value)} disabled={pending || !planilla.puedeCerrar} className={inputClase} placeholder="Opcional" />
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            DT de {planilla.visitante}
            <input value={dtVisitante} onChange={(e) => setDtVisitante(e.target.value)} disabled={pending || !planilla.puedeCerrar} className={inputClase} placeholder="Nombre y apellido" />
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1">
            Ayudante de {planilla.visitante}
            <input value={ayudanteVisitante} onChange={(e) => setAyudanteVisitante(e.target.value)} disabled={pending || !planilla.puedeCerrar} className={inputClase} placeholder="Opcional" />
          </label>
          <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1 md:col-span-2">
            Planillero/a de mesa
            <input value={planilleroNombre} onChange={(e) => setPlanilleroNombre(e.target.value)} disabled={pending || !planilla.puedeCerrar} className={inputClase} placeholder="Si no hay usuario designado, escribí el nombre" />
          </label>
        </div>
        {planilla.puedeCerrar && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              ejecutar(() =>
                confirmarStaff(planilla.matchId, {
                  dtLocal,
                  ayudanteLocal,
                  dtVisitante,
                  ayudanteVisitante,
                  planilleroNombre,
                })
              )
            }
            className="self-start text-xs font-bold bg-[#1A2A44] text-white rounded-xl px-4 py-2 hover:bg-[#24355a] disabled:bg-slate-300 transition-colors"
          >
            Confirmar cuerpo técnico
          </button>
        )}
      </div>

      {/* BOTÓN INICIAR */}
      {planilla.puedeCerrar && (
        <button
          type="button"
          disabled={pending || !listoParaArrancar}
          onClick={() => ejecutar(() => iniciarPartido(planilla.matchId))}
          className="w-full inline-flex items-center justify-center gap-3 bg-[#F97316] hover:bg-[#ea6a0a] disabled:bg-slate-300 text-white font-black text-lg rounded-2xl px-6 py-4 shadow-lg transition-colors"
        >
          {pending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
          {listoParaArrancar ? "¡ARRANCAR EL PARTIDO!" : "Completá el semáforo para arrancar"}
        </button>
      )}
    </div>
  );
}
