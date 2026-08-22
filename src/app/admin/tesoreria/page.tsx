import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Wallet,
  ClipboardList,
  Settings,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { estadoCargo, formatoPesos } from "@/lib/core/tesoreria/money";

/**
 * TESORERÍA — Panel principal (admin + tesorero)
 * Resumen del dinero de la liga: deuda viva, recaudación del mes y
 * comprobantes esperando aprobación.
 */
export default async function TesoreriaPanel() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: settings }, { data: cargos }, { data: pagosAprobados }, { count: pendientesCount }] =
    await Promise.all([
      supabase.from("treasury_settings").select("late_fee_percent").eq("id", 1).single(),
      supabase
        .from("treasury_charges")
        .select("id, monto, fecha_vencimiento, status")
        .neq("status", "anulado"),
      supabase
        .from("treasury_payments")
        .select("charge_id, monto, created_at")
        .eq("status", "aprobado"),
      supabase
        .from("treasury_payments")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendiente"),
    ]);

  const lateFee = Number(settings?.late_fee_percent ?? 0);
  const aprobadoPorCargo = new Map<string, number>();
  for (const p of pagosAprobados ?? []) {
    aprobadoPorCargo.set(p.charge_id, (aprobadoPorCargo.get(p.charge_id) ?? 0) + Number(p.monto));
  }

  let deudaTotal = 0;
  let deudaVencida = 0;
  for (const c of cargos ?? []) {
    const e = estadoCargo(
      Number(c.monto),
      c.fecha_vencimiento,
      lateFee,
      aprobadoPorCargo.get(c.id) ?? 0,
      c.status === "anulado"
    );
    deudaTotal += e.saldo;
    if (e.estado === "vencido") deudaVencida += e.saldo;
  }

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const recaudadoMes = (pagosAprobados ?? [])
    .filter((p) => new Date(p.created_at) >= inicioMes)
    .reduce((s, p) => s + Number(p.monto), 0);

  const cantidadPendientes = pendientesCount ?? 0;

  const KPIS = [
    {
      icon: TrendingUp,
      label: "Recaudado este mes",
      valor: formatoPesos(recaudadoMes),
      clase: "text-green-700 bg-green-50",
    },
    {
      icon: Wallet,
      label: "Deuda total de clubes",
      valor: formatoPesos(deudaTotal),
      clase: "text-[#1A2A44] bg-slate-100",
    },
    {
      icon: AlertTriangle,
      label: "Deuda vencida (con recargo)",
      valor: formatoPesos(deudaVencida),
      clase: "text-red-700 bg-red-50",
    },
    {
      icon: Clock,
      label: "Comprobantes por aprobar",
      valor: String(cantidadPendientes),
      clase: "text-orange-700 bg-orange-50",
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
          <Wallet className="w-7 h-7 text-[#F97316]" />
          Tesorería
        </h1>
        <p className="text-slate-500 text-xs mt-0.5">
          Cuentas de los clubes, cobros, multas automáticas y recibos oficiales.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col gap-2"
          >
            <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${k.clase}`}>
              <k.icon className="w-4 h-4" />
            </span>
            <p className="font-black text-lg text-[#1A2A44] leading-tight">{k.valor}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {k.label}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/admin/tesoreria/movimientos"
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#F97316] transition flex items-center gap-3 group"
        >
          <ClipboardList className="w-6 h-6 text-[#F97316]" />
          <div className="flex-1">
            <p className="font-bold text-sm text-[#1A2A44]">Movimientos</p>
            <p className="text-[11px] text-slate-500">
              Aprobar comprobantes, cargar cuotas y ver la deuda de cada club.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
        </Link>
        <Link
          href="/admin/tesoreria/gastos"
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#F97316] transition flex items-center gap-3 group"
        >
          <TrendingDown className="w-6 h-6 text-[#F97316]" />
          <div className="flex-1">
            <p className="font-bold text-sm text-[#1A2A44]">Gastos</p>
            <p className="text-[11px] text-slate-500">
              Canchas, árbitros, material y devoluciones a clubes.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
        </Link>
        <Link
          href="/admin/tesoreria/reportes"
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#F97316] transition flex items-center gap-3 group"
        >
          <BarChart3 className="w-6 h-6 text-[#F97316]" />
          <div className="flex-1">
            <p className="font-bold text-sm text-[#1A2A44]">Reportes</p>
            <p className="text-[11px] text-slate-500">
              Morosos, recaudación mensual, resumen por torneo y cierre de caja.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
        </Link>
        <Link
          href="/admin/tesoreria/configuracion"
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:border-[#F97316] transition flex items-center gap-3 group"
        >
          <Settings className="w-6 h-6 text-[#F97316]" />
          <div className="flex-1">
            <p className="font-bold text-sm text-[#1A2A44]">Configuración</p>
            <p className="text-[11px] text-slate-500">
              Montos de multas, recargo por mora y datos fiscales de la liga.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#F97316] transition" />
        </Link>
      </div>
    </div>
  );
}
