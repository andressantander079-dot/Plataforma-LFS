"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Scale,
  Gavel,
  History,
  BookOpen,
  Plus,
  Loader2,
  CircleAlert,
  Pencil,
  Ban,
  Search,
  AlertTriangle,
  HandMetal,
  Eye,
} from "lucide-react";
import {
  modificarSancion,
  anularSancion,
  resolverApelacion,
  type PanelTribunal,
  type SancionFila,
  type ApelacionFila,
} from "@/lib/actions/tribunal.actions";
import {
  estadoSancion,
  ESTADO_SANCION_UI,
  ESTADO_APELACION_UI,
  ESTADO_MULTA_UI,
  motivoLegible,
  formatoPesos,
  ETIQUETA_TIPO_SANCIONADO,
} from "@/lib/core/rules/tribunalRules";
import { ModalSancionManual } from "./ModalSancionManual";
import { PanelCatalogo } from "./PanelCatalogo";

/**
 * TRIBUNAL DE DISCIPLINA — Panel de la federación.
 * Pestañas: Vigentes / Apelaciones / Historial / Catálogo.
 * El admin puede modificar (fechas, motivo) o anular cualquier sanción:
 * todo queda registrado en la auditoría.
 */

type Pestaña = "vigentes" | "apelaciones" | "historial" | "catalogo";

function formatoFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatoFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Chip de estado de la multa (tesorería), tal como lo pidió el usuario. */
function ChipMulta({ sancion }: { sancion: SancionFila }) {
  if (!sancion.cargo) {
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_MULTA_UI.sin_multa.clases}`}>
        {ESTADO_MULTA_UI.sin_multa.label}
      </span>
    );
  }
  const { cargo } = sancion;
  const pago = cargo.ultimoPago;

  // Comprobante subido y esperando revisión de tesorería
  if (cargo.status === "pendiente" && pago?.status === "pendiente") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200">
        Comprobante en revisión
      </span>
    );
  }
  // Rechazado por tesorería (con fecha y hora)
  if (pago?.status === "rechazado") {
    return (
      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-red-50 text-red-700 border-red-200">
        Pago rechazado {pago.resueltoAt ? `· ${formatoFechaHora(pago.resueltoAt)}` : ""}
      </span>
    );
  }
  const ui = ESTADO_MULTA_UI[cargo.status];
  const aprobado = pago?.status === "aprobado" ? pago.resueltoAt : null;
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ui.clases}`}>
      {ui.label}
      {cargo.status === "pagado" && aprobado ? ` · ${formatoFechaHora(aprobado)}` : ""}
    </span>
  );
}

function ChipOrigen({ origen }: { origen: SancionFila["origen"] }) {
  return origen === "automatica" ? (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">
      Automática
    </span>
  ) : (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
      Manual
    </span>
  );
}

export function TribunalAdmin({ panel }: { panel: PanelTribunal }) {
  const [pestaña, setPestaña] = useState<Pestaña>("vigentes");
  const [modalNueva, setModalNueva] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "error" | "ok"; texto: string } | null>(null);

  // Filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroClub, setFiltroClub] = useState("");
  const [filtroTorneo, setFiltroTorneo] = useState("");

  // Modales
  const [modificando, setModificando] = useState<SancionFila | null>(null);
  const [anulando, setAnulando] = useState<SancionFila | null>(null);
  const [resolviendo, setResolviendo] = useState<ApelacionFila | null>(null);

  const sancionesFiltradas = useMemo(() => {
    const texto = filtroTexto.trim().toLowerCase();
    return panel.sanciones.filter((s) => {
      if (filtroClub && s.clubId !== filtroClub) return false;
      if (filtroTorneo && s.competitionId !== filtroTorneo) return false;
      if (texto) {
        const blob = `${s.sancionadoNombre} ${s.clubNombre} ${motivoLegible(s.infraccion)}`.toLowerCase();
        if (!blob.includes(texto)) return false;
      }
      return true;
    });
  }, [panel.sanciones, filtroTexto, filtroClub, filtroTorneo]);

  const vigentes = sancionesFiltradas.filter((s) => estadoSancion({
    anulada_at: s.anuladaAt,
    partidos_pendientes: s.partidosPendientes,
  }) === "activa");

  const historial = sancionesFiltradas.filter((s) => {
    const e = estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes });
    return e === "cumplida" || e === "anulada";
  });

  const apelacionesPendientes = panel.apelaciones.filter((a) => a.estado === "pendiente");
  const multasPendientes = panel.sanciones.filter(
    (s) => s.cargo && (s.cargo.status === "pendiente" || s.cargo.status === "parcial") && !s.anuladaAt
  );
  const totalMultasPendientes = multasPendientes.reduce((acc, s) => acc + (s.cargo?.monto ?? 0), 0);

  const avisar = (tipo: "error" | "ok", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4000);
  };

  const confirmarModificacion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!modificando) return;
    const fd = new FormData(e.currentTarget);
    fd.set("id", modificando.id);
    startTransition(async () => {
      const res = await modificarSancion(fd);
      if (res?.error) avisar("error", res.error);
      else {
        avisar("ok", "Sanción modificada. Quedó registrado en auditoría.");
        setModificando(null);
      }
    });
  };

  const confirmarAnulacion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!anulando) return;
    const fd = new FormData(e.currentTarget);
    fd.set("id", anulando.id);
    startTransition(async () => {
      const res = await anularSancion(fd);
      if (res?.error) avisar("error", res.error);
      else {
        avisar("ok", "Sanción anulada (y su multa, si estaba pendiente).");
        setAnulando(null);
      }
    });
  };

  const confirmarResolucion = (decision: "aceptada" | "rechazada") => {
    if (!resolviendo) return;
    const textarea = document.getElementById("resolucion-apelacion") as HTMLTextAreaElement | null;
    const fd = new FormData();
    fd.set("apelacionId", resolviendo.id);
    fd.set("decision", decision);
    fd.set("resolucion", textarea?.value ?? "");
    startTransition(async () => {
      const res = await resolverApelacion(fd);
      if (res?.error) avisar("error", res.error);
      else {
        avisar("ok", decision === "aceptada" ? "Apelación aceptada: la sanción quedó anulada." : "Apelación rechazada.");
        setResolviendo(null);
      }
    });
  };

  const TABS: Array<{ id: Pestaña; label: string; icono: typeof Scale; cantidad?: number }> = [
    { id: "vigentes", label: "Vigentes", icono: Scale, cantidad: vigentes.length },
    { id: "apelaciones", label: "Apelaciones", icono: Gavel, cantidad: apelacionesPendientes.length },
    { id: "historial", label: "Historial", icono: History },
    { id: "catalogo", label: "Catálogo", icono: BookOpen, cantidad: panel.catalogo.filter((c) => c.activo).length },
  ];

  const renderFilaSancion = (s: SancionFila) => {
    const estado = estadoSancion({ anulada_at: s.anuladaAt, partidos_pendientes: s.partidosPendientes });
    const uiEstado = ESTADO_SANCION_UI[estado];
    return (
      <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {s.playerId ? (
                <Link
                  href={`/admin/tribunal/jugador/${s.playerId}`}
                  className="font-serif text-sm font-black text-[#1A2A44] hover:text-[#F97316] transition"
                >
                  {s.sancionadoNombre}
                </Link>
              ) : (
                <span className="font-serif text-sm font-black text-[#1A2A44]">{s.sancionadoNombre}</span>
              )}
              <ChipOrigen origen={s.origen} />
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${uiEstado.clases}`}>
                {uiEstado.label}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {ETIQUETA_TIPO_SANCIONADO[s.sancionadoTipo]} · {s.clubNombre}
              {s.equipoNombre ? ` (${s.equipoNombre})` : ""}
              {s.competitionNombre ? ` · ${s.competitionNombre}` : ""} · {formatoFecha(s.createdAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            {s.partidosPendientes > 0 && (
              <p className="text-sm font-black text-red-600">
                {s.partidosPendientes} fecha{s.partidosPendientes > 1 ? "s" : ""}
              </p>
            )}
            {s.montoMulta != null && s.montoMulta > 0 && (
              <p className="text-sm font-black text-amber-600">{formatoPesos(s.montoMulta)}</p>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
          {motivoLegible(s.infraccion)}
        </p>
        {s.anuladaMotivo && (
          <p className="text-[11px] text-slate-500 italic">
            Anulada el {formatoFecha(s.anuladaAt)}: {s.anuladaMotivo}
          </p>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <ChipMulta sancion={s} />
            {s.apelacion && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ESTADO_APELACION_UI[s.apelacion.estado].clases}`}>
                Apelación: {ESTADO_APELACION_UI[s.apelacion.estado].label}
              </span>
            )}
          </div>
          {estado !== "anulada" && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setModificando(s)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center gap-1 hover:bg-slate-200"
              >
                <Pencil className="w-3 h-3" /> Modificar
              </button>
              <button
                onClick={() => setAnulando(s)}
                className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 text-[10px] font-bold flex items-center gap-1 hover:bg-red-100"
              >
                <Ban className="w-3 h-3" /> Anular
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderApelacion = (a: ApelacionFila) => {
    const sancion = panel.sanciones.find((s) => s.id === a.sancionId);
    const ui = ESTADO_APELACION_UI[a.estado];
    return (
      <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-serif text-sm font-black text-[#1A2A44]">
                {sancion?.sancionadoNombre ?? "Sanción"}
              </span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${ui.clases}`}>{ui.label}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {sancion?.clubNombre} · {motivoLegible(sancion?.infraccion ?? "")} · presentada el {formatoFechaHora(a.createdAt)}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 whitespace-pre-wrap">
          {a.motivo}
        </p>
        {a.adjuntos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {a.adjuntos.map((adj) => (
              <span key={adj.path} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <Eye className="w-3 h-3" /> {adj.nombre}
              </span>
            ))}
          </div>
        )}
        {a.resolucion && (
          <p className="text-[11px] text-slate-500 italic">
            Fallo ({a.resueltoAt ? formatoFechaHora(a.resueltoAt) : "—"}): {a.resolucion}
          </p>
        )}
        {a.estado === "pendiente" && (
          <button
            onClick={() => setResolviendo(a)}
            className="self-start px-4 py-2 rounded-xl bg-[#1A2A44] text-white text-xs font-bold flex items-center gap-1.5 hover:bg-[#25375a]"
          >
            <Gavel className="w-3.5 h-3.5" /> Resolver apelación
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Encabezado + acción principal */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Scale className="w-7 h-7 text-[#F97316]" />
            Tribunal de Disciplina
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Sanciones automáticas y manuales, apelaciones y multas. Todo queda en auditoría.
          </p>
        </div>
        <button
          onClick={() => setModalNueva(true)}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#ea580c] text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-[#F97316]/20 hover:opacity-95"
        >
          <Plus className="w-4 h-4" /> Nueva sanción manual
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vigentes</p>
          <p className="font-serif text-2xl font-black text-red-600 mt-1">{vigentes.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Apelaciones pendientes</p>
          <p className="font-serif text-2xl font-black text-amber-600 mt-1">{apelacionesPendientes.length}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Multas por cobrar</p>
          <p className="font-serif text-2xl font-black text-[#1A2A44] mt-1">{formatoPesos(totalMultasPendientes)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">En el historial</p>
          <p className="font-serif text-2xl font-black text-slate-500 mt-1">{historial.length}</p>
        </div>
      </div>

      {/* Aviso */}
      {aviso && (
        <p
          className={`text-xs font-bold rounded-xl border px-3 py-2.5 flex items-center gap-1.5 ${
            aviso.tipo === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}
        >
          <CircleAlert className="w-4 h-4 shrink-0" /> {aviso.texto}
        </p>
      )}

      {/* Pestañas */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-2xl p-1 overflow-x-auto">
        {TABS.map((t) => {
          const activa = pestaña === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setPestaña(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                activa ? "bg-[#1A2A44] text-white shadow" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <t.icono className="w-3.5 h-3.5" />
              {t.label}
              {t.cantidad != null && t.cantidad > 0 && (
                <span
                  className={`min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black flex items-center justify-center ${
                    activa ? "bg-[#F97316] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {t.cantidad}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filtros (no aplican al catálogo) */}
      {pestaña !== "catalogo" && pestaña !== "apelaciones" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nombre, club o motivo…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
            />
          </div>
          <select
            value={filtroClub}
            onChange={(e) => setFiltroClub(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="">Todos los clubes</option>
            {panel.clubes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            value={filtroTorneo}
            onChange={(e) => setFiltroTorneo(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
          >
            <option value="">Todos los torneos</option>
            {panel.competencias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Contenido por pestaña */}
      {pestaña === "vigentes" && (
        <div className="flex flex-col gap-3">
          {vigentes.map(renderFilaSancion)}
          {vigentes.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <HandMetal className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">No hay sanciones vigentes con estos filtros.</p>
            </div>
          )}
        </div>
      )}

      {pestaña === "apelaciones" && (
        <div className="flex flex-col gap-3">
          {panel.apelaciones.map(renderApelacion)}
          {panel.apelaciones.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <Gavel className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Todavía no se presentaron apelaciones.</p>
            </div>
          )}
        </div>
      )}

      {pestaña === "historial" && (
        <div className="flex flex-col gap-3">
          {historial.map(renderFilaSancion)}
          {historial.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
              <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-500">Sin sanciones cumplidas ni anuladas todavía.</p>
            </div>
          )}
        </div>
      )}

      {pestaña === "catalogo" && <PanelCatalogo catalogo={panel.catalogo} />}

      {/* Modal: nueva sanción manual */}
      <ModalSancionManual
        abierto={modalNueva}
        alCerrar={() => setModalNueva(false)}
        catalogo={panel.catalogo}
        clubes={panel.clubes}
        competencias={panel.competencias}
      />

      {/* Modal: modificar sanción */}
      {modificando && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setModificando(null)}>
          <form
            onSubmit={confirmarModificacion}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-serif text-base font-black text-[#1A2A44]">Modificar sanción</h3>
              <p className="text-[11px] text-slate-500">
                {modificando.sancionadoNombre} · {modificando.clubNombre}
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fechas de suspensión</span>
              <input
                name="fechas"
                type="number"
                min={0}
                max={30}
                defaultValue={modificando.partidosPendientes}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo / infracción</span>
              <textarea
                name="infraccion"
                rows={3}
                defaultValue={motivoLegible(modificando.infraccion)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-none"
              />
            </label>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> El cambio queda registrado en la auditoría con el valor anterior y el nuevo.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setModificando(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">
                Cancelar
              </button>
              <button disabled={pendiente} className="flex-1 py-2.5 rounded-xl bg-[#F97316] text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar cambio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: anular sanción */}
      {anulando && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setAnulando(null)}>
          <form
            onSubmit={confirmarAnulacion}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-serif text-base font-black text-red-600">Anular sanción</h3>
              <p className="text-[11px] text-slate-500">
                {anulando.sancionadoNombre} · {motivoLegible(anulando.infraccion)}
              </p>
            </div>
            <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              La sanción deja de contar de inmediato y, si tenía una multa sin pagar, también se anula en tesorería.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Motivo de la anulación</span>
              <textarea
                name="motivo"
                rows={3}
                required
                minLength={5}
                placeholder="Ej: El video muestra que la agresión no fue tal…"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAnulando(null)} className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold">
                Cancelar
              </button>
              <button disabled={pendiente} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Anular sanción
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: resolver apelación */}
      {resolviendo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setResolviendo(null)}>
          <div
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="font-serif text-base font-black text-[#1A2A44]">Resolver apelación</h3>
              <p className="text-[11px] text-slate-500">
                {panel.sanciones.find((s) => s.id === resolviendo.sancionId)?.sancionadoNombre} · presentada el {formatoFechaHora(resolviendo.createdAt)}
              </p>
            </div>
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {resolviendo.motivo}
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fundamentos del fallo</span>
              <textarea
                id="resolucion-apelacion"
                rows={3}
                minLength={5}
                placeholder="Ej: Revisado el video, se confirma la agresión…"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40 resize-none"
              />
            </label>
            <p className="text-[10px] text-slate-400">
              Si la aceptás, la sanción (y su multa pendiente) se anulan automáticamente.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => confirmarResolucion("rechazada")}
                disabled={pendiente}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Rechazar
              </button>
              <button
                onClick={() => confirmarResolucion("aceptada")}
                disabled={pendiente}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {pendiente && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Aceptar (anula)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
