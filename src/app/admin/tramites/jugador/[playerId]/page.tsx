import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, History, ArrowRight, BadgeCheck } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

/**
 * HISTORIAL DEL JUGADOR (admin, Paso 11)
 * Línea de tiempo de todos sus pases efectivos agrupados en PERÍODOS:
 * en qué club estuvo, desde cuándo y hasta cuándo (incluye préstamos
 * con su retorno). Se construye a partir de los pases completados.
 */

interface TransferRow {
  id: string;
  tipo_pase: string;
  status: string;
  numero_pase: string | null;
  fecha_retorno: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
  from: { name: string } | null;
  to: { name: string } | null;
}

interface Periodo {
  club: string;
  desde: Date;
  hasta: Date | null; // null = actualidad
  esPrestamo: boolean;
  numeroPase: string | null;
}

function fechaEfectivo(t: TransferRow): Date {
  const meta = t.metadata ?? {};
  const comp = typeof meta.completado_at === "string" ? meta.completado_at : null;
  return new Date(comp ?? t.created_at);
}

export default async function HistorialJugadorPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
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
  if (profile?.role !== "admin") redirect("/login");

  const { data: jugador } = await supabase
    .from("players")
    .select("id, first_name, last_name, dni, fecha_nacimiento, foto_path, status, created_at")
    .eq("id", playerId)
    .single();
  if (!jugador) notFound();

  const [{ data: transfers }, { data: actuales }] = await Promise.all([
    supabase
      .from("transfers")
      .select(
        "id, tipo_pase, status, numero_pase, fecha_retorno, created_at, metadata, from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
      )
      .eq("player_id", playerId)
      .eq("status", "7_COMPLETED")
      .order("created_at", { ascending: true }),
    supabase
      .from("player_categories")
      .select("clubs(name), categories(name)")
      .eq("player_id", playerId),
  ]);

  // Construir los períodos a partir de los pases efectivos
  const pases = ((transfers ?? []) as unknown as TransferRow[]).sort(
    (a, b) => fechaEfectivo(a).getTime() - fechaEfectivo(b).getTime()
  );

  const periodos: Periodo[] = [];
  let clubActual: string | null = null;
  let desdeActual: Date = new Date(jugador.created_at);

  function cerrarPeriodo(hasta: Date | null, esPrestamo: boolean, numeroPase: string | null) {
    if (!clubActual) return;
    periodos.push({ club: clubActual, desde: desdeActual, hasta, esPrestamo, numeroPase });
  }

  for (const t of pases) {
    const origen = t.from?.name ?? null;
    const destino = t.to?.name ?? null;
    const fecha = fechaEfectivo(t);
    const meta = t.metadata ?? {};
    const devuelto = typeof meta.devuelto_at === "string" ? new Date(meta.devuelto_at) : null;

    if (clubActual === null) {
      // Primer pase: período inicial en el club de origen (o libre)
      clubActual = origen ?? "Jugador libre";
    }
    cerrarPeriodo(fecha, false, t.numero_pase);

    if (t.tipo_pase === "prestamo") {
      // Período de préstamo en el club destino
      clubActual = destino ? `${destino}` : clubActual;
      desdeActual = fecha;
      periodos.push({
        club: clubActual,
        desde: fecha,
        hasta: devuelto ?? (t.fecha_retorno ? new Date(t.fecha_retorno) : null),
        esPrestamo: true,
        numeroPase: t.numero_pase,
      });
      if (devuelto) {
        // Volvió al club de origen
        clubActual = origen ?? clubActual;
        desdeActual = devuelto;
      } else {
        clubActual = null; // el préstamo sigue en curso (ya quedó como período abierto)
      }
    } else {
      // Pase definitivo: nuevo período en el club destino
      clubActual = destino;
      desdeActual = fecha;
    }
  }
  // Período abierto hasta hoy
  if (clubActual !== null) {
    cerrarPeriodo(null, false, null);
  }
  periodos.reverse(); // el más reciente primero

  const clubesActuales = [
    ...new Set(
      ((actuales ?? []) as unknown as { clubs: { name: string } | null }[])
        .map((a) => a.clubs?.name)
        .filter(Boolean) as string[]
    ),
  ];
  const urlFotos = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos-jugadores/`;
  const fmt = (d: Date) => d.toLocaleDateString("es-AR");

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tramites"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Trámites
        </Link>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={jugador.foto_path ? `${urlFotos}${jugador.foto_path}` : "/jugador-default.png"}
            alt={`Foto de ${jugador.last_name}`}
            className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100"
          />
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <History className="w-6 h-6 text-[#F97316]" />
              {jugador.last_name}, {jugador.first_name}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              DNI {jugador.dni}
              {jugador.fecha_nacimiento && (
                <> · nació el {new Date(jugador.fecha_nacimiento).toLocaleDateString("es-AR")}</>
              )}
              {" · "}Club actual:{" "}
              <span className="font-bold text-[#1A2A44]">
                {clubesActuales.length > 0 ? clubesActuales.join(", ") : "Sin club (libre)"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Períodos */}
      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44]">Trayectoria por períodos</h2>
        {periodos.length === 0 ? (
          <p className="text-xs text-slate-400">
            Este jugador no tiene pases efectivos todavía: siempre estuvo en su club actual.
          </p>
        ) : (
          <ol className="relative border-l-2 border-slate-200 ml-3 flex flex-col gap-4">
            {periodos.map((p, i) => (
              <li key={i} className="ml-5 relative">
                <span
                  className={`absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                    p.hasta === null ? "bg-green-500" : p.esPrestamo ? "bg-sky-500" : "bg-slate-400"
                  }`}
                />
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold text-sm text-[#1A2A44] flex items-center gap-2 flex-wrap">
                      {p.club}
                      {p.esPrestamo && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                          Préstamo
                        </span>
                      )}
                      {p.hasta === null && (
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                          <BadgeCheck className="w-3 h-3" /> Actualidad
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      {fmt(p.desde)}
                      <ArrowRight className="w-3 h-3 text-[#F97316]" />
                      {p.hasta === null
                        ? "hoy"
                        : p.esPrestamo
                          ? `${fmt(p.hasta)} (retorno)`
                          : fmt(p.hasta)}
                    </p>
                  </div>
                  {p.numeroPase && (
                    <span className="font-mono text-[10px] font-bold text-[#F97316]">
                      {p.numeroPase}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="text-[10px] text-slate-400">
          Los períodos se arman a partir de los pases efectivos. Si un préstamo está en curso, la
          fecha de fin es la de retorno prevista.
        </p>
      </section>
    </div>
  );
}
