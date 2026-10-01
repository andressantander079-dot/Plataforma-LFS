import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Paperclip, CalendarClock } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { aQuienLeToca, ESTADO_PASE_UI, type EstadoPase } from "@/lib/core/rules/pasesRules";
import { StepperPase } from "@/components/pases/StepperPase";
import { DocumentosPase, type DocumentoPaseUI } from "@/components/pases/DocumentosPase";
import { ComprobantePase } from "@/components/pases/ComprobantePase";
import { BotonRescindirPrestamo } from "@/components/pases/BotonRescindirPrestamo";
import { BotonImprimir } from "@/components/tesoreria/BotonImprimir";

/**
 * DETALLE DEL PASE (club) — seguimiento del trámite paso a paso,
 * documentos adjuntos y comprobante imprimible cuando queda efectivo.
 * La seguridad la da el RLS: solo lo ven los clubes involucrados y la liga.
 */
export default async function PaseDetalleClub({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: pase } = await supabase
    .from("transfers")
    .select(
      "*, players(first_name, last_name, dni), from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
    )
    .eq("id", id)
    .single();
  if (!pase) notFound(); // RLS: si no participás del pase, directamente no existe para vos

  const meta = (pase.metadata ?? {}) as Record<string, unknown>;
  const estado = pase.status as EstadoPase;
  const ui = ESTADO_PASE_UI[estado];

  // Mi club (para saber si puede rescindir un préstamo que recibió)
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();
  const miClubId = profile?.club_id ?? null;

  const esPrestamoEfectivo = pase.tipo_pase === "prestamo" && estado === "7_COMPLETED";
  const prestamoDevuelto = typeof meta.devuelto_at === "string";
  const puedeRescindir =
    esPrestamoEfectivo && !prestamoDevuelto && miClubId !== null && pase.to_club_id === miClubId;

  let recargoRescision = 0;
  if (puedeRescindir) {
    const { data: settings } = await supabase
      .from("pase_settings")
      .select("recargo_rescision")
      .eq("id", 1)
      .single();
    recargoRescision = Number(settings?.recargo_rescision ?? 0);
  }

  const { data: documentos } = await supabase
    .from("transfer_documents")
    .select("id, nombre, path, created_at")
    .eq("transfer_id", id)
    .order("created_at");

  const jugadorNombre = pase.players
    ? `${pase.players.last_name}, ${pase.players.first_name}`
    : "—";
  const origen = (pase.from as unknown as { name: string } | null)?.name ?? "Jugador libre";
  const destino = (pase.to as unknown as { name: string } | null)?.name ?? "—";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/club/tramites"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Trámites
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-[#F97316]" />
              Pase de {jugadorNombre}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {origen} → <span className="font-bold">{destino}</span> · iniciado el{" "}
              {new Date(pase.created_at).toLocaleDateString("es-AR")}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${ui.className}`}>
            {ui.label}
          </span>
          {pase.tipo_pase === "prestamo" && (
            <span className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-sky-100 text-sky-700">
              Préstamo
            </span>
          )}
        </div>
      </div>

      {/* Datos del préstamo */}
      {pase.tipo_pase === "prestamo" && (
        <div className="bg-sky-50 border border-sky-200 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="font-bold text-sm text-sky-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Préstamo
          </h2>
          <p className="text-xs text-sky-800">
            {prestamoDevuelto ? (
              <>
                Este préstamo ya terminó
                {typeof meta.devuelto_at === "string" && (
                  <>
                    {" "}el{" "}
                    <span className="font-bold">
                      {new Date(meta.devuelto_at as string).toLocaleDateString("es-AR")}
                    </span>
                  </>
                )}
                : el jugador volvió a su club de origen.
              </>
            ) : pase.fecha_retorno ? (
              <>
                El jugador vuelve a su club de origen el{" "}
                <span className="font-bold">
                  {new Date(pase.fecha_retorno).toLocaleDateString("es-AR")}
                </span>
                . La vuelta es automática: la liga avisa antes de esa fecha.
              </>
            ) : (
              "Préstamo sin fecha de retorno registrada."
            )}
          </p>
          {puedeRescindir && (
            <div className="border-t border-sky-200 pt-3">
              <BotonRescindirPrestamo transferId={pase.id} recargo={recargoRescision} />
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <StepperPase estado={estado} />
        {!["7_COMPLETED", "8_RECHAZADO", "9_CANCELADO"].includes(estado) && (
          <p className="text-[11px] text-slate-400 mt-3">
            Ahora le toca a: <span className="font-bold text-slate-600">{aQuienLeToca(estado)}</span>
          </p>
        )}
        {estado === "8_RECHAZADO" && typeof meta.rechazo_motivo === "string" && (
          <p className="text-xs font-semibold text-red-600 mt-2">
            Motivo del rechazo: {meta.rechazo_motivo}
          </p>
        )}
        {estado === "9_CANCELADO" && typeof meta.cancelacion_motivo === "string" && (
          <p className="text-xs font-semibold text-slate-500 mt-2">
            Motivo de la cancelación: {meta.cancelacion_motivo}
          </p>
        )}
      </div>

      {/* Documentos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#F97316]" /> Documentos del pase
        </h2>
        <p className="text-[11px] text-slate-400 -mt-1">
          Podés adjuntar la carta de liberación, el DNI del jugador o el formulario en papel
          (foto o PDF, máx. 5 MB).
        </p>
        <DocumentosPase transferId={pase.id} documentos={(documentos ?? []) as DocumentoPaseUI[]} />
      </div>

      {/* Comprobante oficial */}
      {estado === "7_COMPLETED" && (
        <div className="flex flex-col gap-3">
          <ComprobantePase
            numero={pase.numero_pase}
            jugador={jugadorNombre}
            dni={pase.players?.dni ?? "—"}
            clubOrigen={origen}
            clubDestino={destino}
            fechaEfectivo={
              typeof meta.completado_at === "string"
                ? new Date(meta.completado_at).toLocaleDateString("es-AR")
                : new Date().toLocaleDateString("es-AR")
            }
            nroFederativo={pase.nro_federativo}
          />
          <BotonImprimir />
        </div>
      )}
    </div>
  );
}
