import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Clock, Receipt } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  estadoCargo,
  formatoPesos,
  METODO_PAGO_UI,
  TIPO_CARGO_UI,
} from "@/lib/core/tesoreria/money";
import { FormularioCargo } from "@/components/tesoreria/FormularioCargo";
import { PagosPendientes } from "@/components/tesoreria/PagosPendientes";
import { BotonAnular } from "@/components/tesoreria/BotonAnular";

/**
 * TESORERÍA — MOVIMIENTOS
 * Pagos esperando aprobación + todos los cargos con su estado de cuenta.
 * El admin además puede anular (con motivo, queda registro).
 */

const ESTADO_CARGO_UI: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-slate-100 text-slate-600" },
  parcial: { label: "Pago parcial", className: "bg-blue-100 text-blue-700" },
  vencido: { label: "Vencido", className: "bg-red-100 text-red-700" },
  pagado: { label: "Pagado", className: "bg-green-100 text-green-700" },
  anulado: { label: "Anulado", className: "bg-slate-200 text-slate-500 line-through" },
};

export default async function TesoreriaMovimientos() {
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
    { data: clubes },
    { data: torneos },
    { data: cargos },
    { data: pagos },
  ] = await Promise.all([
    supabase.from("treasury_settings").select("late_fee_percent").eq("id", 1).single(),
    supabase.from("clubs").select("id, name").order("name"),
    supabase.from("competitions").select("id, name").order("created_at", { ascending: false }),
    supabase
      .from("treasury_charges")
      .select("*, clubs(name), competitions(name)")
      .order("created_at", { ascending: false }),
    supabase
      .from("treasury_payments")
      .select("*, clubs(name), treasury_charges(descripcion)")
      .order("created_at", { ascending: false }),
  ]);

  const lateFee = Number(settings?.late_fee_percent ?? 0);

  const aprobadoPorCargo = new Map<string, number>();
  for (const p of (pagos ?? []).filter((p) => p.status === "aprobado")) {
    aprobadoPorCargo.set(p.charge_id, (aprobadoPorCargo.get(p.charge_id) ?? 0) + Number(p.monto));
  }

  const pagosPendientes = (pagos ?? [])
    .filter((p) => p.status === "pendiente")
    .map((p) => ({
      id: p.id,
      clubNombre: (p.clubs as unknown as { name: string } | null)?.name ?? "—",
      descripcionCargo:
        (p.treasury_charges as unknown as { descripcion: string } | null)?.descripcion ?? "—",
      monto: Number(p.monto),
      metodo: p.metodo,
      comprobante_path: p.comprobante_path,
      created_at: p.created_at,
    }));

  const cargosUI = (cargos ?? []).map((c) => {
    const e = estadoCargo(
      Number(c.monto),
      c.fecha_vencimiento,
      lateFee,
      aprobadoPorCargo.get(c.id) ?? 0,
      c.status === "anulado"
    );
    return {
      id: c.id,
      club: (c.clubs as unknown as { name: string } | null)?.name ?? "—",
      torneo: (c.competitions as unknown as { name: string } | null)?.name ?? null,
      tipo: c.tipo,
      descripcion: c.descripcion,
      vencimiento: c.fecha_vencimiento,
      anuladoMotivo: c.anulado_motivo,
      estado: e,
    };
  });

  // Pagos aprobados recientes con su recibo
  const pagosResueltos = (pagos ?? [])
    .filter((p) => p.status !== "pendiente")
    .slice(0, 20)
    .map((p) => ({
      id: p.id,
      club: (p.clubs as unknown as { name: string } | null)?.name ?? "—",
      descripcionCargo:
        (p.treasury_charges as unknown as { descripcion: string } | null)?.descripcion ?? "—",
      monto: Number(p.monto),
      metodo: p.metodo,
      status: p.status,
      receipt: p.receipt_number,
      motivo: p.rechazo_motivo ?? p.anulado_motivo,
      fecha: p.created_at,
    }));

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-2">
        <Link
          href="/admin/tesoreria"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Tesorería
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-[#F97316]" />
              Movimientos
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Aprobá comprobantes, cargá cuotas y controlá la deuda de cada club.
            </p>
          </div>
          <FormularioCargo
            clubes={(clubes ?? []).map((c) => ({ id: c.id, nombre: c.name }))}
            torneos={(torneos ?? []).map((t) => ({ id: t.id, nombre: t.name }))}
          />
        </div>
      </div>

      {/* Pagos pendientes de aprobación */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          Comprobantes por aprobar ({pagosPendientes.length})
        </h2>
        <PagosPendientes pagos={pagosPendientes} />
      </section>

      {/* Cargos */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44]">
          Cargos a clubes ({cargosUI.length})
        </h2>
        {cargosUI.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">
            Todavía no hay cargos. Usá el botón «Nuevo cargo» para cargar el primero.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs min-w-[720px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                  <th className="py-2 pr-3">Club</th>
                  <th className="py-2 pr-3">Cargo</th>
                  <th className="py-2 pr-3">Vence</th>
                  <th className="py-2 pr-3 text-right">Total</th>
                  <th className="py-2 pr-3 text-right">Saldo</th>
                  <th className="py-2 pr-3">Estado</th>
                  {esAdmin && <th className="py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cargosUI.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="py-2.5 pr-3 font-bold text-[#1A2A44]">{c.club}</td>
                    <td className="py-2.5 pr-3">
                      <p className="font-semibold text-slate-700">{c.descripcion}</p>
                      <p className="text-[10px] text-slate-400">
                        {TIPO_CARGO_UI[c.tipo] ?? c.tipo}
                        {c.torneo ? ` · ${c.torneo}` : ""}
                        {c.anuladoMotivo ? ` · Motivo: ${c.anuladoMotivo}` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">
                      {c.vencimiento
                        ? new Date(c.vencimiento + "T12:00:00").toLocaleDateString("es-AR")
                        : "—"}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-bold text-[#1A2A44]">
                      {formatoPesos(c.estado.total)}
                      {c.estado.recargo > 0 && (
                        <span className="block text-[9px] text-red-500 font-bold">
                          incl. recargo {formatoPesos(c.estado.recargo)}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-black text-[#1A2A44]">
                      {formatoPesos(c.estado.saldo)}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_CARGO_UI[c.estado.estado].className}`}
                      >
                        {ESTADO_CARGO_UI[c.estado.estado].label}
                      </span>
                    </td>
                    {esAdmin && (
                      <td className="py-2.5">
                        {c.estado.estado !== "anulado" && (
                          <BotonAnular tipo="cargo" id={c.id} descripcion={c.descripcion} />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagos resueltos (historial con recibos) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
          <Receipt className="w-4 h-4 text-[#F97316]" />
          Pagos resueltos (últimos 20)
        </h2>
        {pagosResueltos.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">Todavía no hay pagos procesados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pagosResueltos.map((p) => (
              <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-3 text-xs">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-[#1A2A44]">{p.club}</p>
                  <p className="text-[10px] text-slate-500">
                    {p.descripcionCargo} · {METODO_PAGO_UI[p.metodo] ?? p.metodo} ·{" "}
                    {new Date(p.fecha).toLocaleDateString("es-AR")}
                    {p.motivo ? ` · ${p.motivo}` : ""}
                  </p>
                </div>
                <span className="font-black text-[#1A2A44]">{formatoPesos(p.monto)}</span>
                {p.status === "aprobado" && p.receipt && (
                  <Link
                    href={`/admin/tesoreria/recibos/${p.id}`}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"
                  >
                    Recibo {p.receipt}
                  </Link>
                )}
                {p.status === "rechazado" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-700">
                    Rechazado
                  </span>
                )}
                {p.status === "anulado" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-500">
                    Anulado
                  </span>
                )}
                {esAdmin && p.status === "aprobado" && (
                  <BotonAnular tipo="pago" id={p.id} descripcion={`${p.club} — ${formatoPesos(p.monto)}`} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
