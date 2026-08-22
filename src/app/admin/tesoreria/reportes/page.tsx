import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, AlertTriangle, CalendarClock } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { estadoCargo, formatoPesos } from "@/lib/core/tesoreria/money";
import { BotonExportarCSV } from "@/components/tesoreria/BotonExportarCSV";
import { GestionCierres, type MesCierre } from "@/components/tesoreria/GestionCierres";

/**
 * TESORERÍA — REPORTES
 * Lo que le sirve a la liga y al contador:
 *  · Ranking de morosos (deuda viva con recargo incluido)
 *  · Recaudación mes a mes (ingresos vs gastos)
 *  · Resumen por torneo (cargado vs cobrado)
 *  · Cierre de caja mensual
 * Todo se puede exportar a Excel (CSV).
 */

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function claveMes(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

export default async function TesoreriaReportes() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const esAdmin = profile?.role === "admin";

  const [
    { data: settings },
    { data: cargos },
    { data: pagosAprobados },
    { data: gastos },
    { data: cierres },
  ] = await Promise.all([
    supabase.from("treasury_settings").select("late_fee_percent").eq("id", 1).single(),
    supabase
      .from("treasury_charges")
      .select("id, club_id, competition_id, monto, fecha_vencimiento, status, clubs(name), competitions(name)")
      .neq("status", "anulado"),
    supabase
      .from("treasury_payments")
      .select("charge_id, monto, resuelto_at, created_at")
      .eq("status", "aprobado"),
    supabase.from("treasury_expenses").select("monto, fecha, categoria, anulado_at"),
    supabase.from("treasury_cierres").select("*"),
  ]);

  const lateFee = Number(settings?.late_fee_percent ?? 0);

  // ── Deuda por cargo (con recargo por mora) ────────────────────────────────
  const aprobadoPorCargo = new Map<string, number>();
  for (const p of pagosAprobados ?? []) {
    aprobadoPorCargo.set(p.charge_id, (aprobadoPorCargo.get(p.charge_id) ?? 0) + Number(p.monto));
  }

  // ── 1) RANKING DE MOROSOS ─────────────────────────────────────────────────
  const deudaPorClub = new Map<string, { nombre: string; saldo: number; vencido: number }>();
  for (const c of cargos ?? []) {
    const e = estadoCargo(
      Number(c.monto),
      c.fecha_vencimiento,
      lateFee,
      aprobadoPorCargo.get(c.id) ?? 0,
      false
    );
    if (e.saldo <= 0) continue;
    const nombre = (c.clubs as unknown as { name: string } | null)?.name ?? "—";
    const actual = deudaPorClub.get(c.club_id) ?? { nombre, saldo: 0, vencido: 0 };
    actual.saldo += e.saldo;
    if (e.estado === "vencido") actual.vencido += e.saldo;
    deudaPorClub.set(c.club_id, actual);
  }
  const morosos = [...deudaPorClub.values()].sort((a, b) => b.saldo - a.saldo);

  // ── 2) RECAUDACIÓN POR MES (últimos 12) ───────────────────────────────────
  const ultimos12: string[] = [];
  const ahora = new Date();
  for (let i = 11; i >= 0; i--) {
    ultimos12.push(claveMes(new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)));
  }

  const ingresosPorMes = new Map<string, number>();
  for (const p of pagosAprobados ?? []) {
    const fecha = new Date(p.resuelto_at ?? p.created_at);
    const clave = claveMes(fecha);
    ingresosPorMes.set(clave, (ingresosPorMes.get(clave) ?? 0) + Number(p.monto));
  }
  const gastosPorMes = new Map<string, number>();
  for (const g of (gastos ?? []).filter((g) => !g.anulado_at)) {
    const clave = claveMes(new Date(g.fecha + "T12:00:00"));
    gastosPorMes.set(clave, (gastosPorMes.get(clave) ?? 0) + Number(g.monto));
  }

  const recaudacion = ultimos12.map((clave) => {
    const [anio, mes] = clave.split("-").map(Number);
    const ingresos = ingresosPorMes.get(clave) ?? 0;
    const egresos = gastosPorMes.get(clave) ?? 0;
    return {
      clave,
      etiqueta: `${MESES_ES[mes - 1]} ${anio}`,
      ingresos,
      egresos,
      neto: ingresos - egresos,
    };
  });

  // ── 3) RESUMEN POR TORNEO ─────────────────────────────────────────────────
  const porTorneo = new Map<
    string,
    { nombre: string; cargado: number; cobrado: number; cargos: number }
  >();
  for (const c of (cargos ?? []).filter((c) => c.competition_id)) {
    const nombre =
      (c.competitions as unknown as { name: string } | null)?.name ?? "Torneo sin nombre";
    const actual = porTorneo.get(c.competition_id) ?? {
      nombre,
      cargado: 0,
      cobrado: 0,
      cargos: 0,
    };
    actual.cargado += Number(c.monto);
    actual.cobrado += Math.min(aprobadoPorCargo.get(c.id) ?? 0, Number(c.monto));
    actual.cargos += 1;
    porTorneo.set(c.competition_id, actual);
  }
  const resumenTorneos = [...porTorneo.values()].sort((a, b) => b.cargado - a.cargado);

  // ── 4) CIERRES DE CAJA ────────────────────────────────────────────────────
  const cierresPorClave = new Map<string, (typeof cierres extends (infer T)[] | null ? T : never)>();
  for (const c of cierres ?? []) {
    cierresPorClave.set(`${c.anio}-${String(c.mes).padStart(2, "0")}`, c);
  }
  const mesesCierre: MesCierre[] = ultimos12
    .slice()
    .reverse()
    .map((clave) => {
      const [anio, mes] = clave.split("-").map(Number);
      const cierre = cierresPorClave.get(clave);
      const cerrado = !!cierre && !cierre.reabierto_at;
      let detalle: string | null = null;
      if (cierre) {
        detalle = cerrado
          ? `Cerrado el ${new Date(cierre.cerrado_at).toLocaleDateString("es-AR")}`
          : `Reabierto el ${new Date(cierre.reabierto_at).toLocaleDateString("es-AR")} · Motivo: ${cierre.reapertura_motivo ?? "—"}`;
      }
      return {
        anio,
        mes,
        etiqueta: `${MESES_ES[mes - 1]} ${anio}`,
        cerrado,
        detalle,
      };
    });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tesoreria"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Tesorería
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-[#F97316]" />
            Reportes
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Morosos, recaudación mensual, resumen por torneo y cierres de caja. Todo exportable a
            Excel.
          </p>
        </div>
      </div>

      {/* ── MOROSOS ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Ranking de morosos
            <span className="text-[10px] font-semibold text-slate-400">
              (incluye recargo por mora)
            </span>
          </h2>
          <BotonExportarCSV
            nombreArchivo="morosos-lfs"
            encabezados={["Club", "Deuda total", "Deuda vencida"]}
            filas={morosos.map((m) => [m.nombre, formatoPesos(m.saldo), formatoPesos(m.vencido)])}
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3 text-right">Deuda total</th>
                <th className="px-4 py-3 text-right">Deuda vencida</th>
              </tr>
            </thead>
            <tbody>
              {morosos.map((m, i) => (
                <tr key={m.nombre} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-xs font-black text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#1A2A44]">{m.nombre}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-[#1A2A44]">
                    {formatoPesos(m.saldo)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold">
                    {m.vencido > 0 ? (
                      <span className="text-red-600">{formatoPesos(m.vencido)}</span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {morosos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-xs text-slate-400">
                    Ningún club debe plata. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── RECAUDACIÓN POR MES ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44]">
            Recaudación mes a mes (últimos 12)
          </h2>
          <BotonExportarCSV
            nombreArchivo="recaudacion-mensual-lfs"
            encabezados={["Mes", "Ingresos", "Gastos", "Neto"]}
            filas={recaudacion.map((r) => [
              r.etiqueta,
              formatoPesos(r.ingresos),
              formatoPesos(r.egresos),
              formatoPesos(r.neto),
            ])}
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Mes</th>
                  <th className="px-4 py-3 text-right">Ingresos</th>
                  <th className="px-4 py-3 text-right">Gastos</th>
                  <th className="px-4 py-3 text-right">Neto</th>
                </tr>
              </thead>
              <tbody>
                {recaudacion
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr key={r.clave} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 text-xs font-bold text-[#1A2A44] capitalize">
                        {r.etiqueta}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-green-700">
                        {formatoPesos(r.ingresos)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-xs font-bold text-red-600">
                        {formatoPesos(r.egresos)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right text-xs font-black ${
                          r.neto >= 0 ? "text-[#1A2A44]" : "text-red-700"
                        }`}
                      >
                        {formatoPesos(r.neto)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── RESUMEN POR TORNEO ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44]">Resumen por torneo</h2>
          <BotonExportarCSV
            nombreArchivo="resumen-por-torneo-lfs"
            encabezados={["Torneo", "Cargos", "Cargado", "Cobrado", "Pendiente"]}
            filas={resumenTorneos.map((t) => [
              t.nombre,
              t.cargos,
              formatoPesos(t.cargado),
              formatoPesos(t.cobrado),
              formatoPesos(t.cargado - t.cobrado),
            ])}
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Torneo</th>
                <th className="px-4 py-3 text-center">Cargos</th>
                <th className="px-4 py-3 text-right">Cargado</th>
                <th className="px-4 py-3 text-right">Cobrado</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {resumenTorneos.map((t) => (
                <tr key={t.nombre} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-xs font-bold text-[#1A2A44]">{t.nombre}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500">{t.cargos}</td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-[#1A2A44]">
                    {formatoPesos(t.cargado)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-green-700">
                    {formatoPesos(t.cobrado)}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-orange-600">
                    {formatoPesos(t.cargado - t.cobrado)}
                  </td>
                </tr>
              ))}
              {resumenTorneos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-xs text-slate-400">
                    Todavía no hay cargos asociados a torneos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── CIERRE DE CAJA ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#F97316]" />
          Cierre de caja mensual
        </h2>
        <p className="text-[11px] text-slate-500 -mt-2">
          Cerrar un mes lo bloquea: no se pueden cargar ni anular movimientos de ese mes. Solo el
          administrador puede reabrirlo, y queda registrado el motivo.
        </p>
        <GestionCierres meses={mesesCierre} esAdmin={esAdmin} />
      </section>
    </div>
  );
}
