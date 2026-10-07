"use client";

import { useState, useTransition } from "react";
import {
  Save,
  Loader2,
  CircleAlert,
  CheckCircle2,
  Calendar,
  Plus,
  Trash2,
  BookOpen,
  Clock,
  Users,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import {
  guardarReglasMercado,
  type ConfigMercado,
} from "@/lib/actions/tramites.actions";
import {
  guardarRangosCategorias,
  guardarFeePase,
  eliminarFeePase,
  crearVentana,
  eliminarVentana,
} from "@/lib/actions/pases.actions";
import {
  estadoVentana,
  ESTADO_VENTANA_UI,
  textoRecargo,
  validarReglasMercado,
  type RecargoModo,
} from "@/lib/core/rules/tramitesRules";

/**
 * EDITOR DEL MERCADO DE PASES — única puerta de edición (Paso 15).
 * Vive en Configuración LFS → Pases & Fichajes. Escribe en pase_settings,
 * transfer_windows, categories y transfer_fees (fuente única).
 * En Trámites → Configuración se ve lo mismo pero en solo lectura.
 */

function Aviso({ aviso }: { aviso: { tipo: "ok" | "error"; texto: string } | null }) {
  if (!aviso) return null;
  return (
    <p
      className={`text-xs font-bold rounded-xl border px-3 py-2.5 flex items-center gap-1.5 ${
        aviso.tipo === "error"
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      {aviso.tipo === "error" ? <CircleAlert className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
      {aviso.texto}
    </p>
  );
}

const inputCls =
  "w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316]/40";
const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400";

export function EditorMercadoPases({ config }: { config: ConfigMercado }) {
  const [pendiente, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const s = config.settings;

  const [modo, setModo] = useState<RecargoModo>(s.recargo_modo);

  const avisar = (tipo: "ok" | "error", texto: string) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 4500);
  };

  const guardarReglas = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const valido = validarReglasMercado({
      tenencia_anios: Number(fd.get("tenencia_anios")),
      recargo_modo: modo,
      recargo_valor: Number(fd.get("recargo_valor")),
      alerta_trabado_horas: Number(fd.get("alerta_trabado_horas")),
      cancelacion_trabado_horas: Number(fd.get("cancelacion_trabado_horas")),
      aviso_retorno_horas: Number(fd.get("aviso_retorno_horas")),
      cupo_plantel: Number(fd.get("cupo_plantel")),
      firma_obligatoria: fd.get("firma_obligatoria") === "on",
    });
    if (!valido.ok) {
      avisar("error", valido.error ?? "Revisá los valores.");
      return;
    }
    fd.set("recargo_modo", modo);
    startTransition(async () => {
      const res = await guardarReglasMercado(fd);
      if (res?.error) avisar("error", res.error);
      else avisar("ok", "Reglas del mercado guardadas. Se actualizan solas en Trámites → Configuración.");
    });
  };

  const guardarRangos = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rangos = config.categorias.map((c) => {
      const desde = String(fd.get(`desde_${c.id}`) ?? "").trim();
      const hasta = String(fd.get(`hasta_${c.id}`) ?? "").trim();
      return {
        id: c.id,
        anio_desde: desde ? Number(desde) : null,
        anio_hasta: hasta ? Number(hasta) : null,
      };
    });
    startTransition(async () => {
      const res = await guardarRangosCategorias(rangos);
      if (!res.success) avisar("error", res.error ?? "No se pudieron guardar los rangos.");
      else avisar("ok", "Años de nacimiento por categoría guardados.");
    });
  };

  const agregarFee = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await guardarFeePase(fd);
      if (!res.success) avisar("error", res.error ?? "No se pudo guardar la tarifa.");
      else {
        avisar("ok", "Tarifa guardada.");
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  const agregarVentana = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await crearVentana(fd);
      if (!res.success) avisar("error", res.error ?? "No se pudo crear la ventana.");
      else {
        avisar("ok", "Ventana creada.");
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Aviso aviso={aviso} />

      {/* 1. REGLAS DEL MERCADO */}
      <form onSubmit={guardarReglas} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Reglas del mercado</h3>
              <p className="text-xs text-slate-400">Estos valores aplican a todos los pases de la liga.</p>
            </div>
          </div>
          <button
            disabled={pendiente}
            className="px-4 py-2 bg-[#F97316] hover:bg-[#F97316]/90 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar reglas
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Tenencia mínima (años)</label>
            <input name="tenencia_anios" type="number" min={0} max={5} defaultValue={s.tenencia_anios} className={inputCls} />
            <p className="text-[10px] text-slate-400">Años en el club antes de poder darse de baja. 0 = sin tenencia.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Alerta de pase trabado (horas)</label>
            <input name="alerta_trabado_horas" type="number" min={1} max={720} defaultValue={s.alerta_trabado_horas} className={inputCls} />
            <p className="text-[10px] text-slate-400">Pasado este tiempo sin movimiento, el pase se marca como trabado.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Cancelación automática (horas)</label>
            <input name="cancelacion_trabado_horas" type="number" min={1} max={720} defaultValue={s.cancelacion_trabado_horas} className={inputCls} />
            <p className="text-[10px] text-slate-400">Tiempo máximo sin respuesta antes de cancelar solo. Mayor que la alerta.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Aviso de retorno de préstamo (horas)</label>
            <input name="aviso_retorno_horas" type="number" min={1} max={720} defaultValue={s.aviso_retorno_horas} className={inputCls} />
            <p className="text-[10px] text-slate-400">Cuántas horas antes del vencimiento se avisa que el préstamo termina.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Cupo máximo por plantel</label>
            <input name="cupo_plantel" type="number" min={10} max={50} defaultValue={s.cupo_plantel} className={inputCls} />
            <p className="text-[10px] text-slate-400">Jugadores habilitados en lista de buena fe.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Recargo por rescisión de préstamo</label>
            <div className="flex gap-2">
              <select value={modo} onChange={(e) => setModo(e.target.value as RecargoModo)} className={inputCls + " w-32 shrink-0"}>
                <option value="fijo">$ fijo</option>
                <option value="multiplicador">Multiplicador</option>
              </select>
              <input name="recargo_valor" type="number" min={modo === "multiplicador" ? 1 : 0} step={modo === "multiplicador" ? 0.1 : 500} defaultValue={s.recargo_valor} className={inputCls} />
            </div>
            <p className="text-[10px] text-slate-400">{textoRecargo(modo, s.recargo_valor)}</p>
          </div>
        </div>

        <label className="flex items-start gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer">
          <input name="firma_obligatoria" type="checkbox" defaultChecked={s.firma_obligatoria} className="mt-0.5 w-4 h-4 accent-[#F97316]" />
          <span>
            <span className="text-xs font-bold text-[#1A2A44] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Firma digital obligatoria del jugador
            </span>
            <span className="text-[11px] text-slate-500 block">
              Si se desactiva, el pase pasa del dictamen directo a la auditoría final, sin firma online.
            </span>
          </span>
        </label>
      </form>

      {/* 2. VENTANAS DE MERCADO */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Calendar className="w-5 h-5 text-[#F97316]" />
          <div>
            <h3 className="font-serif text-base font-bold text-[#1A2A44]">Ventanas de mercado</h3>
            <p className="text-xs text-slate-400">
              El libro de pases se abre y cierra SOLO por estas fechas (estado automático).
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {config.ventanas.map((v) => {
            const est = estadoVentana(v.fechaDesde, v.fechaHasta);
            const ui = ESTADO_VENTANA_UI[est];
            return (
              <div key={v.id} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-sm font-bold text-[#1A2A44]">{v.nombre}</p>
                  <p className="text-[11px] text-slate-500">
                    {v.fechaDesde} → {v.fechaHasta}
                  </p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ui.clases}`}>{ui.label}</span>
                <button
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar la ventana "${v.nombre}"?`)) return;
                    startTransition(async () => {
                      const res = await eliminarVentana(v.id);
                      if (!res.success) avisar("error", res.error ?? "No se pudo eliminar.");
                      else avisar("ok", "Ventana eliminada.");
                    });
                  }}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                  aria-label={`Eliminar ${v.nombre}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
          {config.ventanas.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">
              No hay ventanas cargadas: el mercado está cerrado. Creá una para habilitar pases.
            </p>
          )}
        </div>

        <form onSubmit={agregarVentana} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Nombre</label>
            <input name="nombre" required minLength={3} placeholder="Ej: Ventana Clausura 2026" className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Desde</label>
            <input name="fecha_desde" type="date" required className={inputCls} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Hasta</label>
            <input name="fecha_hasta" type="date" required className={inputCls} />
          </div>
          <button disabled={pendiente} className="px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>
      </section>

      {/* 3. AÑOS POR CATEGORÍA */}
      <form onSubmit={guardarRangos} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#F97316]" />
            <div>
              <h3 className="font-serif text-base font-bold text-[#1A2A44]">Años de nacimiento por categoría</h3>
              <p className="text-xs text-slate-400">De acá salen las validaciones de inscripción y la mayoría de edad en las firmas.</p>
            </div>
          </div>
          <button disabled={pendiente} className="px-4 py-2 bg-[#F97316] text-white text-xs font-bold rounded-xl shadow-md flex items-center gap-1.5 disabled:opacity-50">
            {pendiente ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Guardar años
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {config.categorias.map((c) => (
            <div key={c.id} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
              <span className="text-xs font-bold text-[#1A2A44] flex-1 truncate">{c.name}</span>
              <input
                name={`desde_${c.id}`}
                type="number"
                min={1950}
                max={new Date().getFullYear()}
                placeholder="Desde"
                defaultValue={c.anio_desde ?? ""}
                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
              />
              <span className="text-slate-400 text-xs">→</span>
              <input
                name={`hasta_${c.id}`}
                type="number"
                min={1950}
                max={new Date().getFullYear()}
                placeholder="Hasta"
                defaultValue={c.anio_hasta ?? ""}
                className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
              />
            </div>
          ))}
        </div>
      </form>

      {/* 4. DERECHOS DE PASE */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Banknote className="w-5 h-5 text-[#F97316]" />
          <div>
            <h3 className="font-serif text-base font-bold text-[#1A2A44]">Derechos de pase (tarifas)</h3>
            <p className="text-xs text-slate-400">
              Lo que la federación cobra al club destino por categoría/tipo. Se muestra como "cargo previsto" en cada pase.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {config.fees.map((f) => (
            <div key={f.id} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <BookOpen className="w-4 h-4 text-[#F97316] shrink-0" />
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-bold text-[#1A2A44]">
                  {f.categoriaNombre} · {f.tipo === "definitivo" ? "Pase definitivo" : "Préstamo"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {f.torneoNombre ? `Torneo: ${f.torneoNombre}` : "Regla general (todos los torneos)"}
                </p>
              </div>
              <span className="text-sm font-black text-amber-600">${f.monto.toLocaleString("es-AR")}</span>
              <button
                onClick={() => {
                  if (!window.confirm("¿Eliminar esta tarifa?")) return;
                  startTransition(async () => {
                    const res = await eliminarFeePase(f.id);
                    if (!res.success) avisar("error", res.error ?? "No se pudo eliminar.");
                    else avisar("ok", "Tarifa eliminada.");
                  });
                }}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200"
                aria-label="Eliminar tarifa"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {config.fees.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-3">Sin tarifas: los pases no generan cargo de derecho de pase.</p>
          )}
        </div>

        <form onSubmit={agregarFee} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Categoría</label>
            <select name="category_id" required className={inputCls}>
              <option value="">Elegí…</option>
              {config.categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Tipo</label>
            <select name="tipo" required className={inputCls}>
              <option value="definitivo">Definitivo</option>
              <option value="prestamo">Préstamo</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Torneo (opcional)</label>
            <select name="competition_id" className={inputCls}>
              <option value="">Todos</option>
              {config.torneos.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Monto ($)</label>
            <input name="monto" type="number" min={0} step={500} required className={inputCls} />
          </div>
          <button disabled={pendiente} className="px-4 py-2.5 rounded-xl bg-[#1A2A44] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </form>
      </section>

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
        <Clock className="w-3 h-3" />
        Todo lo que guardás acá se refleja automáticamente en Trámites → Configuración (vista de solo lectura).
      </p>
    </div>
  );
}

