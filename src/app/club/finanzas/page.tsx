import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, AlertTriangle, Receipt } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  estadoCargo,
  formatoPesos,
  METODO_PAGO_UI,
  TIPO_CARGO_UI,
} from "@/lib/core/tesoreria/money";
import { FormularioPagoClub } from "@/components/tesoreria/FormularioPagoClub";

/**
 * FINANZAS DEL CLUB
 * Estado de cuenta completo: qué debe, qué pagó, con qué recibo.
 * Desde cada cargo pendiente puede informar el pago con el comprobante.
 */

const ESTADO_UI: Record<string, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-slate-100 text-slate-600" },
  parcial: { label: "Pago parcial", className: "bg-blue-100 text-blue-700" },
  vencido: { label: "Vencido", className: "bg-red-100 text-red-700" },
  pagado: { label: "Pagado", className: "bg-green-100 text-green-700" },
  anulado: { label: "Anulado", className: "bg-slate-200 text-slate-400" },
};

export default async function ClubFinanzas() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  if (!profile?.club_id) redirect("/club/dashboard");

  const [{ data: settings }, { data: cargos }, { data: pagos }] = await Promise.all([
    supabase.from("treasury_settings").select("late_fee_percent").eq("id", 1).single(),
    supabase
      .from("treasury_charges")
      .select("*, competitions(name)")
      .eq("club_id", profile.club_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("treasury_payments")
      .select("*, treasury_charges(descripcion)")
      .eq("club_id", profile.club_id)
      .order("created_at", { ascending: false }),
  ]);

  const lateFee = Number(settings?.late_fee_percent ?? 0);

  const aprobadoPorCargo = new Map<string, number>();
  for (const p of (pagos ?? []).filter((p) => p.status === "aprobado")) {
    aprobadoPorCargo.set(p.charge_id, (aprobadoPorCargo.get(p.charge_id) ?? 0) + Number(p.monto));
  }
  const hayPendientePorCargo = new Set(
    (pagos ?? []).filter((p) => p.status === "pendiente").map((p) => p.charge_id)
  );

  const cargosUI = (cargos ?? []).map((c) => ({
    id: c.id,
    descripcion: c.descripcion,
    tipo: c.tipo,
    torneo: (c.competitions as unknown as { name: string } | null)?.name ?? null,
    vencimiento: c.fecha_vencimiento,
    conPagoPendiente: hayPendientePorCargo.has(c.id),
    estado: estadoCargo(
      Number(c.monto),
      c.fecha_vencimiento,
      lateFee,
      aprobadoPorCargo.get(c.id) ?? 0,
      c.status === "anulado"
    ),
  }));

  const deudaTotal = cargosUI.reduce((s, c) => s + c.estado.saldo, 0);
  const deudaVencida = cargosUI
    .filter((c) => c.estado.estado === "vencido")
    .reduce((s, c) => s + c.estado.saldo, 0);

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Link
            href="/club/dashboard"
            className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al panel
          </Link>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Wallet className="w-7 h-7 text-[#F97316]" />
            Estado de cuenta
          </h1>
          <p className="text-slate-500 text-xs">
            Cuotas, inscripciones y multas de tu club ante la liga.
          </p>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Deuda total
            </p>
            <p className="font-black text-xl text-[#1A2A44] mt-1">{formatoPesos(deudaTotal)}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500" /> Vencida (con recargo)
            </p>
            <p className="font-black text-xl text-red-700 mt-1">{formatoPesos(deudaVencida)}</p>
          </div>
        </div>

        {/* Cargos */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="font-serif text-base font-black text-[#1A2A44]">
            Cargos ({cargosUI.length})
          </h2>
          {cargosUI.length === 0 ? (
            <p className="text-xs text-slate-400 py-2">
              Tu club no tiene cargos registrados. ¡Están al día! 🎉
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {cargosUI.map((c) => (
                <li
                  key={c.id}
                  className={`border rounded-xl px-4 py-3 ${
                    c.estado.estado === "vencido"
                      ? "border-red-200 bg-red-50/40"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-bold text-sm text-[#1A2A44]">{c.descripcion}</p>
                      <p className="text-[10px] text-slate-500">
                        {TIPO_CARGO_UI[c.tipo] ?? c.tipo}
                        {c.torneo ? ` · ${c.torneo}` : ""}
                        {c.vencimiento
                          ? ` · Vence ${new Date(c.vencimiento + "T12:00:00").toLocaleDateString("es-AR")}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#1A2A44] text-sm">
                        {formatoPesos(c.estado.saldo)}
                      </p>
                      {c.estado.recargo > 0 && (
                        <p className="text-[9px] font-bold text-red-500">
                          incluye recargo {formatoPesos(c.estado.recargo)}
                        </p>
                      )}
                      {c.estado.pagado > 0 && c.estado.saldo > 0 && (
                        <p className="text-[9px] text-slate-400">
                          ya pagado {formatoPesos(c.estado.pagado)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ESTADO_UI[c.estado.estado].className}`}
                    >
                      {ESTADO_UI[c.estado.estado].label}
                    </span>
                  </div>

                  {c.estado.saldo > 0 && !c.conPagoPendiente && (
                    <FormularioPagoClub chargeId={c.id} saldo={c.estado.saldo} />
                  )}
                  {c.conPagoPendiente && c.estado.saldo > 0 && (
                    <p className="text-[10px] font-bold text-orange-600 mt-2">
                      Hay un comprobante de este cargo esperando aprobación de la liga.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pagos */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="font-serif text-base font-black text-[#1A2A44] flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#F97316]" />
            Pagos informados ({(pagos ?? []).length})
          </h2>
          {(pagos ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 py-2">Todavía no informaste pagos.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(pagos ?? []).map((p) => (
                <li key={p.id} className="py-2.5 flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex-1 min-w-[180px]">
                    <p className="font-bold text-[#1A2A44]">
                      {(p.treasury_charges as unknown as { descripcion: string } | null)
                        ?.descripcion ?? "—"}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {METODO_PAGO_UI[p.metodo] ?? p.metodo} ·{" "}
                      {new Date(p.created_at).toLocaleDateString("es-AR")}
                      {p.status === "rechazado" && p.rechazo_motivo
                        ? ` · Motivo: ${p.rechazo_motivo}`
                        : ""}
                    </p>
                  </div>
                  <span className="font-black text-[#1A2A44]">{formatoPesos(Number(p.monto))}</span>
                  {p.status === "aprobado" && p.receipt_number && (
                    <Link
                      href={`/club/finanzas/recibo/${p.id}`}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition"
                    >
                      Recibo {p.receipt_number}
                    </Link>
                  )}
                  {p.status === "pendiente" && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700">
                      Esperando aprobación
                    </span>
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
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
