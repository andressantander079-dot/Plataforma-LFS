import { redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Eye, ArrowRight, CalendarClock, Store, Settings2, AlarmClock } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ESTADO_PASE_UI, type EstadoPase } from "@/lib/core/rules/pasesRules";
import { FormularioVentana, type VentanaUI } from "@/components/pases/FormularioVentana";
import { BotonExportarCSV } from "@/components/tesoreria/BotonExportarCSV";

/**
 * TRÁMITES — Pases y transferencias (admin)
 * Todos los pases reales del circuito + gestión del mercado (ventanas)
 * + panel "Mercado de Pases" del año con export a Excel.
 */

interface PaseFila {
  id: string;
  player_id: string;
  status: string;
  created_at: string;
  numero_pase: string | null;
  players: { first_name: string; last_name: string; dni: string } | null;
  from: { name: string } | null;
  to: { name: string } | null;
}

export default async function TramitesAdmin() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const anio = new Date().getFullYear();

  const [{ data: pases }, { data: ventanas }, { data: settings }, { data: cargosPase }] =
    await Promise.all([
      supabase
        .from("transfers")
        .select(
          "id, player_id, status, created_at, numero_pase, players(first_name, last_name, dni), from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("transfer_windows")
        .select("id, nombre, fecha_desde, fecha_hasta")
        .order("fecha_desde", { ascending: false }),
      supabase.from("pase_settings").select("alerta_trabado_horas").eq("id", 1).single(),
      supabase
        .from("treasury_charges")
        .select("club_id, monto, created_at, clubs(name)")
        .eq("tipo", "derecho_pase"),
    ]);

  const filas = (pases ?? []) as unknown as PaseFila[];

  const pendientesLiga = filas.filter((p) =>
    ["1_INIT_CLUB_A", "2_FVF_REVIEW", "6_FINAL_AUDIT"].includes(p.status)
  );

  // ── Alertas: pases TRABADOS (esperan dictamen de la liga más de lo permitido) ──
  const horasAlerta = Number(settings?.alerta_trabado_horas ?? 48);
  const ahora = Date.now();
  const trabados = filas.filter(
    (p) =>
      p.status === "2_FVF_REVIEW" &&
      ahora - new Date(p.created_at).getTime() > horasAlerta * 3600 * 1000
  );

  // ── Panel Mercado de Pases (año en curso) ─────────────────────────────────
  const delAnio = filas.filter((p) => new Date(p.created_at).getFullYear() === anio);
  const efectivos = delAnio.filter((p) => p.status === "7_COMPLETED");
  const movimientosPorClub = new Map<
    string,
    { nombre: string; ficharon: number; cedieron: number; gastado: number }
  >();
  for (const p of efectivos) {
    const destino = p.to?.name;
    const origen = p.from?.name;
    if (destino) {
      const e =
        movimientosPorClub.get(destino) ?? { nombre: destino, ficharon: 0, cedieron: 0, gastado: 0 };
      e.ficharon++;
      movimientosPorClub.set(destino, e);
    }
    if (origen) {
      const e =
        movimientosPorClub.get(origen) ?? { nombre: origen, ficharon: 0, cedieron: 0, gastado: 0 };
      e.cedieron++;
      movimientosPorClub.set(origen, e);
    }
  }

  // Montos: derechos de pase cobrados por la federación (salen de tesorería)
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

  const badge = (estado: string) => {
    const ui = ESTADO_PASE_UI[estado as EstadoPase] ?? {
      label: estado,
      className: "bg-slate-100 text-slate-600",
    };
    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${ui.className}`}>
        {ui.label}
      </span>
    );
  };

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

      {/* Alertas de pases trabados */}
      {trabados.length > 0 && (
        <section className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-2">
          <h2 className="font-bold text-sm text-red-800 flex items-center gap-2">
            <AlarmClock className="w-4 h-4" />
            {trabados.length} pase{trabados.length === 1 ? "" : "s"} trabado
            {trabados.length === 1 ? "" : "s"}: esperan tu dictamen hace más de {horasAlerta} hs
          </h2>
          <div className="flex flex-col gap-1.5">
            {trabados.map((p) => (
              <Link
                key={p.id}
                href={`/admin/tramites/pases/${p.id}`}
                className="bg-white border border-red-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-3 hover:border-red-400 transition"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-xs text-[#1A2A44]">
                    {p.players ? `${p.players.last_name}, ${p.players.first_name}` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {p.from?.name ?? "Libre"} → {p.to?.name ?? "—"} · esperando desde el{" "}
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-red-600">Dictaminar ahora →</span>
              </Link>
            ))}
          </div>
          <p className="text-[10px] text-red-500">
            Si un pase trabado no se resuelve, el sistema lo cancela automáticamente para que no
            quede colgado.
          </p>
        </section>
      )}

      {/* Pendientes de la liga */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44]">
          Esperan acción de la liga ({pendientesLiga.length})
        </h2>
        {pendientesLiga.length === 0 ? (
          <p className="text-xs text-slate-400">No hay nada esperando revisión ni auditoría. 👍</p>
        ) : (
          <div className="flex flex-col gap-2">
            {pendientesLiga.map((p) => (
              <Link
                key={p.id}
                href={`/admin/tramites/pases/${p.id}`}
                className="bg-white border border-orange-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 hover:border-[#F97316] transition shadow-sm"
              >
                <div className="flex-1 min-w-[200px]">
                  <p className="font-bold text-sm text-[#1A2A44]">
                    {p.players ? `${p.players.last_name}, ${p.players.first_name}` : "—"}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span>{p.from?.name ?? "Libre"}</span>
                    <ArrowRight className="w-3 h-3 text-[#F97316]" />
                    <span>{p.to?.name ?? "—"}</span>
                    <span className="text-slate-300">
                      · {new Date(p.created_at).toLocaleDateString("es-AR")}
                    </span>
                  </p>
                </div>
                {badge(p.status)}
                <Eye className="w-4 h-4 text-slate-300" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Todos los pases */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44]">Todos los trámites</h2>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Jugador</th>
                  <th className="px-4 py-3">Origen → Destino</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Iniciado</th>
                  <th className="px-4 py-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tramites/jugador/${p.player_id}`}
                        className="text-xs font-bold text-[#1A2A44] hover:text-[#F97316] transition"
                        title="Ver trayectoria del jugador"
                      >
                        {p.players ? `${p.players.last_name}, ${p.players.first_name}` : "—"}
                      </Link>
                      {p.numero_pase && (
                        <p className="text-[10px] font-mono font-bold text-[#F97316]">
                          {p.numero_pase}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-500">
                      <span className="flex items-center gap-1.5">
                        {p.from?.name ?? "Libre"}
                        <ArrowRight className="w-3 h-3 text-[#F97316]" />
                        <span className="text-[#1A2A44]">{p.to?.name ?? "—"}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{badge(p.status)}</td>
                    <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/tramites/pases/${p.id}`}
                        className="px-3 py-1 bg-slate-50 hover:bg-[#1A2A44] hover:text-white rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </Link>
                    </td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                      Todavía no hay trámites de pases.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

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
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
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

      {/* Ventanas de mercado */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-[#F97316]" />
          Ventanas del mercado de pases
        </h2>
        <p className="text-[11px] text-slate-500 -mt-2">
          Los clubes solo pueden iniciar pases mientras haya una ventana abierta. Vos podés
          iniciar un pase excepcional en cualquier momento.
        </p>
        <FormularioVentana ventanas={(ventanas ?? []) as VentanaUI[]} />
      </section>
    </div>
  );
}
