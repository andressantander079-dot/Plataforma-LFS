import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, TrendingDown, Paperclip } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { CATEGORIA_GASTO_UI, formatoPesos } from "@/lib/core/tesoreria/money";
import { FormularioGasto } from "@/components/tesoreria/FormularioGasto";
import { BotonAnular } from "@/components/tesoreria/BotonAnular";
import { VerComprobante } from "@/components/tesoreria/VerComprobante";

/**
 * TESORERÍA — GASTOS
 * Todo lo que la liga paga: canchas, árbitros, pelotas, devoluciones…
 * Nada se borra: las correcciones son anulaciones con motivo (solo admin).
 */
export default async function TesoreriaGastos() {
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

  const [{ data: clubes }, { data: gastos }] = await Promise.all([
    supabase.from("clubs").select("id, name").order("name"),
    supabase
      .from("treasury_expenses")
      .select("*, clubs(name)")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const activos = (gastos ?? []).filter((g) => !g.anulado_at);
  const totalMes = activos
    .filter((g) => {
      const f = new Date(g.fecha + "T12:00:00");
      const ahora = new Date();
      return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
    })
    .reduce((s, g) => s + Number(g.monto), 0);
  const totalGeneral = activos.reduce((s, g) => s + Number(g.monto), 0);

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tesoreria"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Tesorería
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <TrendingDown className="w-7 h-7 text-[#F97316]" />
              Gastos de la liga
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Canchas, árbitros, material y devoluciones a clubes. Nada se borra: solo se anula.
            </p>
          </div>
          <FormularioGasto
            clubes={(clubes ?? []).map((c) => ({ id: c.id, nombre: c.name }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="font-black text-lg text-[#1A2A44]">{formatoPesos(totalMes)}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Gastado este mes
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="font-black text-lg text-[#1A2A44]">{formatoPesos(totalGeneral)}</p>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Gastado en total
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-center">Comp.</th>
                {esAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {(gastos ?? []).map((g) => {
                const anulado = !!g.anulado_at;
                const clubNombre = (g.clubs as unknown as { name: string } | null)?.name;
                return (
                  <tr
                    key={g.id}
                    className={`border-t border-slate-100 ${anulado ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(g.fecha + "T12:00:00").toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                        {CATEGORIA_GASTO_UI[g.categoria] ?? g.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#1A2A44]">
                      <span className={anulado ? "line-through" : ""}>{g.concepto}</span>
                      {clubNombre && (
                        <span className="block text-[10px] text-slate-400">
                          Club: {clubNombre}
                        </span>
                      )}
                      {anulado && (
                        <span className="block text-[10px] text-red-500 font-semibold">
                          Anulado: {g.anulado_motivo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-xs text-[#1A2A44] whitespace-nowrap">
                      {formatoPesos(Number(g.monto))}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {g.comprobante_path ? (
                        <VerComprobante path={g.comprobante_path} />
                      ) : (
                        <Paperclip className="w-3.5 h-3.5 text-slate-200 inline" />
                      )}
                    </td>
                    {esAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!anulado && (
                          <BotonAnular tipo="gasto" id={g.id} descripcion={g.concepto} />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {(gastos ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-xs text-slate-400">
                    Todavía no hay gastos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
