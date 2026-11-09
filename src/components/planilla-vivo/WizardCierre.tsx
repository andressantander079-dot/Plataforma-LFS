"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Loader2,
  PenLine,
  Vote,
  FileCheck,
  CheckCircle2,
  Star,
  AlertTriangle,
  Send,
} from "lucide-react";
import type { PlanillaEnVivo } from "@/lib/actions/planilla-en-vivo.actions";
import {
  cerrarPlanillaPremium,
  registrarFirmaYVoto,
} from "@/lib/actions/planilla-en-vivo.actions";
import {
  ETIQUETA_ROL,
  estadoFirmas,
  rolesPresentes,
  votantesEsperados,
  type RolFirma,
  type VotanteFigura,
} from "@/lib/core/rules/firmasRules";
import { FirmaCanvas } from "@/components/planilla-vivo/FirmaCanvas";

/**
 * WIZARD DE CIERRE — Paso 17C
 * Paso 1: observaciones del árbitro.
 * Paso 2: firmas + voto de la figura "pasando el teléfono" (cada uno
 *         firma en el canvas y, si vota, toca el ícono del jugador).
 * Paso 3: revisión final y envío. Solo la firma del principal bloquea.
 */

const PASOS = [
  { clave: 1, nombre: "Observaciones", icono: PenLine },
  { clave: 2, nombre: "Firmas y figura", icono: Vote },
  { clave: 3, nombre: "Revisión y envío", icono: FileCheck },
];

const ROLES_QUE_VOTAN: RolFirma[] = ["principal", "segundo_arbitro", "planillero", "dt_local", "dt_visitante"];

export function WizardCierre({
  planilla,
  onCerrar,
}: {
  planilla: PlanillaEnVivo;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [paso, setPaso] = useState(1);
  const [observaciones, setObservaciones] = useState(planilla.observaciones ?? "");
  const [firmando, setFirmando] = useState<RolFirma | null>(null);
  const [votoElegido, setVotoElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [figuraPublicada, setFiguraPublicada] = useState<string | null>(null);

  const haySegundo = planilla.oficiales.some(
    (o) => o.rol === "segundo_arbitro" && o.estado === "aceptada"
  );
  const hayPlanillero =
    planilla.oficiales.some((o) => o.rol === "planillero" && o.estado === "aceptada") ||
    Boolean(planilla.cuerpoTecnico.planilleroNombre);

  const presentes = useMemo(
    () => rolesPresentes({ haySegundoArbitro: haySegundo, hayPlanillero }),
    [haySegundo, hayPlanillero]
  );
  const estado = useMemo(
    () => estadoFirmas(planilla.firmas, presentes),
    [planilla.firmas, presentes]
  );
  const votantes = useMemo(
    () => votantesEsperados({ haySegundoArbitro: haySegundo, hayPlanillero }),
    [haySegundo, hayPlanillero]
  );

  const nombrePorDefecto = (rol: RolFirma): string => {
    switch (rol) {
      case "principal":
        return planilla.arbitroPrincipalNombre ?? "";
      case "segundo_arbitro":
        return planilla.oficiales.find((o) => o.rol === "segundo_arbitro")?.nombre ?? "";
      case "planillero":
        return (
          planilla.oficiales.find((o) => o.rol === "planillero")?.nombre ??
          planilla.cuerpoTecnico.planilleroNombre
        );
      case "dt_local":
        return planilla.cuerpoTecnico.dtLocal;
      case "dt_visitante":
        return planilla.cuerpoTecnico.dtVisitante;
      case "capitan_local":
        return planilla.convocados.find((c) => c.playerId === planilla.capitanLocalId)?.nombre ?? "";
      case "capitan_visitante":
        return planilla.convocados.find((c) => c.playerId === planilla.capitanVisitanteId)?.nombre ?? "";
    }
  };

  const registrar = (rol: RolFirma, dataUrl: string | null, voto: string | null) => {
    startTransition(async () => {
      const res = await registrarFirmaYVoto(planilla.matchId, {
        rol,
        nombreFirmante: nombrePorDefecto(rol),
        dataUrl,
        votoJugadorId: voto,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setFirmando(null);
      setVotoElegido(null);
      router.refresh();
    });
  };

  const enviar = () => {
    startTransition(async () => {
      const res = await cerrarPlanillaPremium(planilla.matchId, { observaciones });
      if (res.error) {
        setError(res.error);
        return;
      }
      setFiguraPublicada(res.figuraNombre ?? null);
      router.refresh();
    });
  };

  const rolAVotante = (rol: RolFirma): VotanteFigura | null =>
    (ROLES_QUE_VOTAN as string[]).includes(rol) ? (rol as VotanteFigura) : null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header + pasos */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-xl font-black text-[#1A2A44]">Cierre de la planilla</h3>
            <button
              type="button"
              onClick={onCerrar}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2">
            {PASOS.map((p) => (
              <div
                key={p.clave}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-black uppercase tracking-wide ${
                  paso === p.clave
                    ? "bg-[#1A2A44] text-white"
                    : paso > p.clave
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-400"
                }`}
              >
                <p.icono className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{p.nombre}</span>
                <span className="sm:hidden">{p.clave}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {figuraPublicada !== null || (paso === 3 && planilla.figuraNombre) ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <Star className="w-8 h-8" />
              </div>
              <h4 className="font-serif text-2xl font-black text-[#1A2A44]">
                ¡Planilla cerrada!
              </h4>
              <p className="text-sm text-slate-500">
                Quedó enviada a la federación para su aprobación.
              </p>
              {(figuraPublicada ?? planilla.figuraNombre) && (
                <p className="text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                  ⭐ Figura del partido: {figuraPublicada ?? planilla.figuraNombre}
                </p>
              )}
              <button
                type="button"
                onClick={onCerrar}
                className="mt-2 rounded-xl bg-[#1A2A44] text-white font-bold text-sm px-6 py-3 hover:bg-[#24355a] transition-colors"
              >
                Listo
              </button>
            </div>
          ) : (
            <>
              {/* PASO 1: OBSERVACIONES */}
              {paso === 1 && (
                <>
                  <label className="text-xs font-semibold text-slate-500 flex flex-col gap-1.5">
                    Observaciones del árbitro (aparecen en la planilla impresa)
                    <textarea
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      rows={6}
                      maxLength={2000}
                      placeholder="Incidentes, advertencias al banco, estado de la cancha, lo que quieras dejar asentado..."
                      className="rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#F97316]/60 focus:border-[#F97316] outline-none resize-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="self-end rounded-xl bg-[#1A2A44] text-white font-bold text-sm px-6 py-3 hover:bg-[#24355a] transition-colors"
                  >
                    Seguir con las firmas →
                  </button>
                </>
              )}

              {/* PASO 2: FIRMAS + VOTO */}
              {paso === 2 && (
                <>
                  <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                    📱 <b>Pasando el teléfono:</b> tocá el nombre de cada persona, que firme en la
                    pantalla y —si le toca votar— que elija la figura del partido. La única firma
                    obligatoria es la tuya (árbitro principal). Si alguien no quiere firmar, queda
                    registrado como "No firmó".
                  </p>

                  {firmando ? (
                    <div className="flex flex-col gap-3">
                      {(ROLES_QUE_VOTAN as string[]).includes(firmando) && (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Vote className="w-3.5 h-3.5" /> {ETIQUETA_ROL[firmando]}: elegí la figura del partido
                          </p>
                          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                            {planilla.convocados.map((c) => (
                              <button
                                key={c.sheetPlayerId}
                                type="button"
                                onClick={() => setVotoElegido(c.playerId)}
                                className={`rounded-lg border-2 px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
                                  votoElegido === c.playerId
                                    ? "border-amber-400 bg-amber-50 text-amber-800"
                                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                              >
                                <span className="font-black mr-1">{c.numero ?? "—"}</span> {c.nombre}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <FirmaCanvas
                        etiqueta={`Firma de ${ETIQUETA_ROL[firmando]} — ${nombrePorDefecto(firmando)}`}
                        confirmando={pending}
                        onCancelar={() => {
                          setFirmando(null);
                          setVotoElegido(null);
                        }}
                        onConfirmar={(dataUrl) => registrar(firmando, dataUrl, votoElegido)}
                      />
                      {(ROLES_QUE_VOTAN as string[]).includes(firmando) && (
                        <p className="text-[11px] text-slate-400 text-center">
                          Podés firmar sin votar: dejá la figura sin elegir.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {presentes.map((rol) => {
                        const firma = planilla.firmas[rol];
                        const voto = rolAVotante(rol)
                          ? planilla.votosFigura.find((v) => v.votante === rol)
                          : undefined;
                        const nombreVotado = voto
                          ? planilla.convocados.find((c) => c.playerId === voto.jugadorId)?.nombre
                          : null;
                        return (
                          <div
                            key={rol}
                            className={`flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 ${
                              firma?.firmo
                                ? "border-green-200 bg-green-50"
                                : firma && !firma.firmo
                                  ? "border-slate-200 bg-slate-50"
                                  : "border-slate-200"
                            }`}
                          >
                            {firma?.firmo ? (
                              <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                            ) : (
                              <PenLine className="w-5 h-5 text-slate-400 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-slate-800">
                                {ETIQUETA_ROL[rol]}
                                {rol === "principal" && (
                                  <span className="ml-1.5 text-[9px] font-black text-red-500 uppercase">
                                    Obligatoria
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 truncate">
                                {firma
                                  ? firma.firmo
                                    ? `${firma.nombre} ✍️${nombreVotado ? ` · votó a ${nombreVotado}` : ""}`
                                    : `${firma.nombre} — No firmó`
                                  : nombrePorDefecto(rol) || "Sin nombre cargado"}
                              </p>
                            </div>
                            {!firma && (
                              <div className="flex gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFirmando(rol);
                                    setVotoElegido(null);
                                  }}
                                  className="rounded-lg bg-[#F97316] hover:bg-[#ea6a0a] text-white text-[11px] font-black px-3 py-2 transition-colors"
                                >
                                  Firmar
                                </button>
                                {rol !== "principal" && (
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => registrar(rol, null, null)}
                                    className="rounded-lg border border-slate-300 text-slate-500 text-[11px] font-black px-3 py-2 hover:bg-slate-50 transition-colors"
                                  >
                                    No firmó
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex justify-between mt-2">
                        <button
                          type="button"
                          onClick={() => setPaso(1)}
                          className="rounded-xl border border-slate-300 text-slate-600 font-bold text-sm px-5 py-3 hover:bg-slate-50 transition-colors"
                        >
                          ← Volver
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaso(3)}
                          className="rounded-xl bg-[#1A2A44] text-white font-bold text-sm px-6 py-3 hover:bg-[#24355a] transition-colors"
                        >
                          Revisar y enviar →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* PASO 3: REVISIÓN */}
              {paso === 3 && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 p-3.5 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Resultado
                      </p>
                      <p className="font-mono text-3xl font-black text-[#1A2A44]">
                        {planilla.homeScore ?? 0} - {planilla.awayScore ?? 0}
                      </p>
                      <p className="text-xs text-slate-500">
                        {planilla.local} vs {planilla.visitante}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 p-3.5 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Firmas
                      </p>
                      <p className="font-mono text-3xl font-black text-[#1A2A44]">
                        {estado.firmadas}/{estado.total}
                      </p>
                      <p className="text-xs text-slate-500">
                        {estado.noFirmaron.length > 0 &&
                          `No firmaron: ${estado.noFirmaron.map((r) => ETIQUETA_ROL[r]).join(", ")}`}
                        {estado.noFirmaron.length === 0 && "Todo firmado o registrado"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Votos de la figura ({planilla.votosFigura.length}/{votantes.length})
                    </p>
                    <p className="text-xs text-slate-500">
                      La votación es interna: no se imprime en la planilla, pero la figura se
                      publica al cerrar.
                    </p>
                  </div>

                  {!estado.puedeCerrar && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                      Falta tu firma (árbitro principal): volvé al paso anterior y firmá.
                    </div>
                  )}

                  <div className="flex justify-between">
                    <button
                      type="button"
                      onClick={() => setPaso(2)}
                      className="rounded-xl border border-slate-300 text-slate-600 font-bold text-sm px-5 py-3 hover:bg-slate-50 transition-colors"
                    >
                      ← Volver
                    </button>
                    <button
                      type="button"
                      disabled={!estado.puedeCerrar || pending}
                      onClick={enviar}
                      className="inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white font-black text-sm px-6 py-3 transition-colors"
                    >
                      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Cerrar y enviar planilla
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
