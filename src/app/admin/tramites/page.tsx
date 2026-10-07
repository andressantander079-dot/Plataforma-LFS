import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Store, Settings2 } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { obtenerBandejaTramites } from "@/lib/actions/tramites.actions";
import { BandejaTramites } from "@/components/tramites/BandejaTramites";
import { BotonExportarCSV } from "@/components/tesoreria/BotonExportarCSV";

export const dynamic = "force-dynamic";

/**
 * TRÁMITES — Pases y transferencias (admin, Paso 15)
 * Bandeja con KPIs que filtran, pestañas (pendientes / en curso / trabados /
 * historial), tarjetas en móvil y tabla en escritorio. Abajo se conserva el
 * panel "Mercado de Pases" del año con export a CSV.
 */
export default async function TramitesAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const anio = new Date().getFullYear();

  const [bandeja, { data: cargosPase }] = await Promise.all([
    obtenerBandejaTramites(),
    supabase
      .from("treasury_charges")
      .select("club_id, monto, created_at, clubs(name)")
      .eq("tipo", "derecho_pase"),
  ]);

  // ── Panel Mercado de Pases (año en curso) ─────────────────────────────────
  const delAnio = bandeja.filas.filter((p) => new Date(p.createdAt).getFullYear() === anio);
  const efectivos = delAnio.filter((p) => p.estado === "7_COMPLETED");
  const movimientosPorClub = new Map<
    string,
    { nombre: string; ficharon: number; cedieron: number; gastado: number }
  >();
  for (const p of efectivos) {
    if (p.destino && p.destino !== "—") {
      const e =
        movimientosPorClub.get(p.destino) ?? { nombre: p.destino, ficharon: 0, cedieron: 0, gastado: 0 };
      e.ficharon++;
      movimientosPorClub.set(p.destino, e);
    }
    if (p.origen && p.origen !== "Libre") {
      const e =
        movimientosPorClub.get(p.origen) ?? { nombre: p.origen, ficharon: 0, cedieron: 0, gastado: 0 };
      e.cedieron++;
      movimientosPorClub.set(p.origen, e);
    }
  }

  interface CargoRow {
    club_id: string;
    monto: number;
    created_at: string;
    clubs: { name: string } | null;
  }
  let recaudadoAnio = 0;
  for (const c of (cargosPase ?? []) as unknown as CargoRow[]) {
    if (new Date(c.created_at).getFullYear() !== anio) continue;
    const nombre = c.clubs?.name;
    const monto = Number(c.monto ?? 0);
    recaudadoAnio += monto;
    if (nombre) {
      const e =
        movimientosPorClub.get(nombre) ?? { nombre, ficharon: 0, cedieron: 0, gastado: 0 };
      e.gastado += monto;
      movimientosPorClub.set(nombre, e);
    }
  }
  const mercado = [...movimientosPorClub.values()].sort(
    (a, b) => b.ficharon + b.cedieron - (a.ficharon + a.cedieron)
  );

  const fmtPesos = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-[#F97316]" />
            Trámites y Fichajes
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Circuito real de pases: solicitud → revisión → dictamen → firma del jugador → efectivo.
            Nada se borra: se rechaza o se cancela con motivo.
          </p>
        </div>
        <Link
          href="/admin/tramites/configuracion"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold bg-[#1A2A44] hover:bg-[#1A2A44]/90 text-white transition text-[11px]"
        >
          <Settings2 className="w-4 h-4" />
          Configuración del mercado
        </Link>
      </div>

      {/* Bandeja premium: KPIs + pestañas + tarjetas/tabla */}
      <BandejaTramites bandeja={bandeja} />

      {/* Mercado de pases del año */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
            <Store className="w-4 h-4 text-[#F97316]" />
            Mercado de Pases {anio}
            <span className="text-[10px] font-semibold text-slate-400">
              ({efectivos.length} pases efectivos · la federación cobró{" "}
              {fmtPesos.format(recaudadoAnio)} en derechos de pase)
            </span>
          </h2>
          <BotonExportarCSV
            nombreArchivo={`mercado-pases-${anio}-lfs`}
            encabezados={["Club", "Fichajes", "Cesiones", "Movimientos", "Derechos de pase"]}
            filas={mercado.map((m) => [
              m.nombre,
              m.ficharon,
              m.cedieron,
              m.ficharon + m.cedieron,
              m.gastado,
            ])}
            etiqueta="Exportar mercado (CSV)"
          />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3 text-center">Fichajes</th>
                <th className="px-4 py-3 text-center">Cesiones</th>
                <th className="px-4 py-3 text-center">Balance</th>
                <th className="px-4 py-3 text-right">Derechos de pase</th>
              </tr>
            </thead>
            <tbody>
              {mercado.map((m, i) => (
                <tr key={m.nombre} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-xs font-black text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-bold text-[#1A2A44]">{m.nombre}</td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-green-700">
                    +{m.ficharon}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-bold text-red-600">
                    −{m.cedieron}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-black text-[#1A2A44]">
                    {m.ficharon - m.cedieron > 0 ? "+" : ""}
                    {m.ficharon - m.cedieron}
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-bold text-slate-600">
                    {m.gastado > 0 ? fmtPesos.format(m.gastado) : "—"}
                  </td>
                </tr>
              ))}
              {mercado.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-400">
                    Todavía no hubo pases efectivos este año.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
