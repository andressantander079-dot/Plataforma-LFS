"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Lock,
  RefreshCw,
  Calendar,
  Users,
  Banknote,
  ShieldCheck,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { createLfsClient } from "@/lib/infrastructure/supabase/client";
import {
  obtenerConfigMercado,
  type ConfigMercado,
} from "@/lib/actions/tramites.actions";
import {
  estadoVentana,
  ESTADO_VENTANA_UI,
  textoRecargo,
} from "@/lib/core/rules/tramitesRules";

/**
 * VISTA DE SOLO LECTURA del mercado de pases (Trámites → Configuración).
 * Muestra EXACTAMENTE lo mismo que se edita en Configuración LFS → Pases &
 * Fichajes (misma fuente: pase_settings, transfer_windows, categories y
 * transfer_fees) y se actualiza EN VIVO vía Realtime, sin recargar.
 */

export function VistaMercadoReadOnly({ inicial }: { inicial: ConfigMercado }) {
  const [config, setConfig] = useState<ConfigMercado>(inicial);
  const [actualizado, setActualizado] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      const nueva = await obtenerConfigMercado();
      setConfig(nueva);
      setActualizado(
        new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    } catch {
      // silencioso: se reintenta con el próximo cambio
    }
  }, []);

  useEffect(() => {
    const supabase = createLfsClient();
    let canal = supabase.channel("mercado-readonly");
    for (const tabla of ["pase_settings", "transfer_windows", "transfer_fees", "categories"]) {
      canal = canal.on(
        "postgres_changes",
        { event: "*", schema: "public", table: tabla },
        refrescar
      );
    }
    canal.subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [refrescar]);

  const s = config.settings;

  const Item = ({ label, valor, detalle }: { label: string; valor: string; detalle?: string }) => (
    <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="text-sm font-black text-[#1A2A44] mt-0.5">{valor}</p>
      {detalle && <p className="text-[10px] text-slate-400 mt-0.5">{detalle}</p>}
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Aviso de solo lectura + vivo */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <Lock className="w-4 h-4 text-blue-600 shrink-0" />
        <p className="text-[11px] text-blue-800 flex-1 min-w-[220px]">
          <strong>Vista de solo lectura.</strong> Esta configuración se edita desde{" "}
          <Link href="/admin/configuracion" className="underline font-bold">
            Configuración LFS → Pases &amp; Fichajes
          </Link>
          . Los cambios aparecen acá solos, sin recargar.
        </p>
        {actualizado && (
          <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Actualizado {actualizado}
          </span>
        )}
      </div>

      {/* Reglas */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-serif text-base font-bold text-[#1A2A44]">Reglas del mercado</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Item label="Tenencia mínima" valor={`${s.tenencia_anios} año${s.tenencia_anios !== 1 ? "s" : ""}`} detalle="0 = sin tenencia" />
          <Item label="Alerta de pase trabado" valor={`${s.alerta_trabado_horas} hs`} detalle="Sin movimiento → se marca trabado" />
          <Item label="Cancelación automática" valor={`${s.cancelacion_trabado_horas} hs`} detalle="Sin respuesta → se cancela solo" />
          <Item label="Aviso retorno de préstamo" valor={`${s.aviso_retorno_horas} hs antes`} />
          <Item label="Cupo por plantel" valor={`${s.cupo_plantel} jugadores`} />
          <Item label="Recargo por rescisión" valor={textoRecargo(s.recargo_modo, s.recargo_valor)} />
          <Item
            label="Firma digital del jugador"
            valor={s.firma_obligatoria ? "Obligatoria" : "Opcional"}
            detalle={s.firma_obligatoria ? "El jugador firma online antes del cierre" : "Del dictamen pasa directo a auditoría"}
          />
        </div>
      </section>

      {/* Ventanas */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Calendar className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-serif text-base font-bold text-[#1A2A44]">Ventanas de mercado</h3>
        </div>
        {config.ventanas.map((v) => {
          const est = estadoVentana(v.fechaDesde, v.fechaHasta);
          const ui = ESTADO_VENTANA_UI[est];
          return (
            <div key={v.id} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className="flex-1 min-w-[160px]">
                <p className="text-sm font-bold text-[#1A2A44]">{v.nombre}</p>
                <p className="text-[11px] text-slate-500">{v.fechaDesde} → {v.fechaHasta}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${ui.clases}`}>{ui.label}</span>
            </div>
          );
        })}
        {config.ventanas.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-3">No hay ventanas cargadas: el mercado está cerrado.</p>
        )}
      </section>

      {/* Años por categoría */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Users className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-serif text-base font-bold text-[#1A2A44]">Años de nacimiento por categoría</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {config.categorias.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5">
              <span className="text-xs font-bold text-[#1A2A44] truncate">{c.name}</span>
              <span className="text-[11px] text-slate-500 font-semibold shrink-0">
                {c.anio_desde != null && c.anio_hasta != null
                  ? `${c.anio_desde} → ${c.anio_hasta}`
                  : "Sin límite de edad"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Derechos de pase */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
          <Banknote className="w-5 h-5 text-[#F97316]" />
          <h3 className="font-serif text-base font-bold text-[#1A2A44]">Derechos de pase (tarifas)</h3>
        </div>
        {config.fees.map((f) => (
          <div key={f.id} className="flex items-center gap-3 flex-wrap bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            <div className="flex-1 min-w-[160px]">
              <p className="text-sm font-bold text-[#1A2A44]">
                {f.categoriaNombre} · {f.tipo === "definitivo" ? "Pase definitivo" : "Préstamo"}
              </p>
              <p className="text-[11px] text-slate-500">
                {f.torneoNombre ? `Torneo: ${f.torneoNombre}` : "Regla general"}
              </p>
            </div>
            <span className="text-sm font-black text-amber-600">${f.monto.toLocaleString("es-AR")}</span>
          </div>
        ))}
        {config.fees.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-3">Sin tarifas cargadas.</p>
        )}
      </section>

      <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
        <Settings2 className="w-3 h-3" />
        Fuente única: misma información que en Configuración LFS → Pases &amp; Fichajes.
      </p>
    </div>
  );
}
