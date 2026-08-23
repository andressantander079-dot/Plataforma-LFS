import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Paperclip, History } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  aQuienLeToca,
  ESTADO_PASE_UI,
  isCredentialActive,
  type EstadoPase,
} from "@/lib/core/rules/pasesRules";
import { StepperPase } from "@/components/pases/StepperPase";
import { AccionesPaseAdmin } from "@/components/pases/AccionesPaseAdmin";
import { LinkFirma } from "@/components/pases/LinkFirma";
import { NroFederativoInput } from "@/components/pases/NroFederativoInput";
import { DocumentosPase, type DocumentoPaseUI } from "@/components/pases/DocumentosPase";
import { ComprobantePase } from "@/components/pases/ComprobantePase";
import { BotonImprimir } from "@/components/tesoreria/BotonImprimir";

/**
 * DETALLE DEL PASE (admin) — auditoría completa del trámite:
 * stepper del circuito, timeline con fechas, documentos, acciones según
 * el estado, número federativo y comprobante imprimible al completarse.
 */
export default async function PaseDetalleAdmin({
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
  if (!pase) notFound();

  const meta = (pase.metadata ?? {}) as Record<string, unknown>;
  const estado = pase.status as EstadoPase;
  const ui = ESTADO_PASE_UI[estado];

  const [{ data: documentos }, { data: historial }] = await Promise.all([
    supabase
      .from("transfer_documents")
      .select("id, nombre, path, created_at")
      .eq("transfer_id", id)
      .order("created_at"),
    supabase
      .from("transfers")
      .select(
        "id, status, numero_pase, created_at, from:clubs!transfers_from_club_id_fkey(name), to:clubs!transfers_to_club_id_fkey(name)"
      )
      .eq("player_id", pase.player_id)
      .neq("id", id)
      .order("created_at", { ascending: false }),
  ]);

  const jugadorNombre = pase.players
    ? `${pase.players.last_name}, ${pase.players.first_name}`
    : "—";
  const origen =
    (pase.from as unknown as { name: string } | null)?.name ?? "Jugador libre";
  const destino = (pase.to as unknown as { name: string } | null)?.name ?? "—";

  const firmaToken = typeof meta.firma_token === "string" ? meta.firma_token : null;
  const firmaActiva =
    estado === "5_PLAYER_SIGNATURE" &&
    pase.approved_at &&
    isCredentialActive(pase.approved_at);

  // Timeline de eventos registrados en metadata
  const timeline: { texto: string; fecha: string }[] = [
    { texto: `Solicitud iniciada (${origen} → ${destino})`, fecha: pase.created_at },
  ];
  if (meta.excepcional) {
    timeline.push({
      texto: "⚠️ Iniciado como EXCEPCIÓN fuera de ventana por la liga",
      fecha: pase.created_at,
    });
  }
  if (typeof meta.notificado_at === "string") {
    timeline.push({
      texto: "Liga aprobó la revisión → dictamen del club de origen",
      fecha: meta.notificado_at,
    });
  }
  if (pase.approved_at && progresoAlMenosFirma(estado)) {
    timeline.push({ texto: "Club de origen aprobó → firma del jugador", fecha: pase.approved_at });
  }
  if (typeof meta.firmado_at === "string") {
    timeline.push({ texto: "✍️ Jugador firmó online con su DNI", fecha: meta.firmado_at });
  }
  if (typeof meta.completado_at === "string") {
    timeline.push({ texto: `🎉 Pase efectivo (${pase.numero_pase ?? "sin número"})`, fecha: meta.completado_at });
  }
  if (typeof meta.rechazado_at === "string") {
    timeline.push({
      texto: `❌ Rechazado por ${meta.rechazado_por === "club_origen" ? "el club de origen" : "la liga"}: ${meta.rechazo_motivo ?? ""}`,
      fecha: meta.rechazado_at,
    });
  }
  if (typeof meta.cancelado_at === "string") {
    timeline.push({ texto: `🚫 Cancelado: ${meta.cancelacion_motivo ?? ""}`, fecha: meta.cancelado_at });
  }

  function progresoAlMenosFirma(e: EstadoPase) {
    return ["5_PLAYER_SIGNATURE", "6_FINAL_AUDIT", "7_COMPLETED"].includes(e);
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tramites"
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
              {origen} → <span className="font-bold">{destino}</span> · DNI{" "}
              {pase.players?.dni ?? "—"} · iniciado el{" "}
              {new Date(pase.created_at).toLocaleDateString("es-AR")}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${ui.className}`}>
            {ui.label}
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <StepperPase estado={estado} />
        {!["7_COMPLETED", "8_RECHAZADO", "9_CANCELADO"].includes(estado) && (
          <p className="text-[11px] text-slate-400 mt-3">
            Ahora le toca a: <span className="font-bold text-slate-600">{aQuienLeToca(estado)}</span>
          </p>
        )}
      </div>

      {/* Acciones del admin */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-bold text-sm text-[#1A2A44]">Acciones de la liga</h2>
        <AccionesPaseAdmin transferId={pase.id} estado={estado} />
        {estado === "5_PLAYER_SIGNATURE" && firmaToken && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
            <LinkFirma token={firmaToken} />
            <p className="text-[10px] text-slate-400">
              {firmaActiva
                ? `Vigente hasta ${new Date(new Date(pase.approved_at).getTime() + 72 * 3600 * 1000).toLocaleString("es-AR")}`
                : "⏰ Link vencido: usá \"Regenerar link de firma\"."}
            </p>
          </div>
        )}
      </div>

      {/* Número federativo (referencia AFA/Comet) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h2 className="font-bold text-sm text-[#1A2A44]">Número federativo (opcional)</h2>
        <p className="text-[11px] text-slate-400 -mt-1">
          Si la liga también carga el pase en Comet/AFA, anotá acá el número como referencia.
        </p>
        <NroFederativoInput transferId={pase.id} valorActual={pase.nro_federativo} />
      </div>

      {/* Documentos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-[#F97316]" /> Documentos del pase
        </h2>
        <DocumentosPase
          transferId={pase.id}
          documentos={(documentos ?? []) as DocumentoPaseUI[]}
        />
      </div>

      {/* Timeline */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <History className="w-4 h-4 text-[#F97316]" /> Historial del trámite
        </h2>
        <ol className="flex flex-col gap-2">
          {timeline.map((t, i) => (
            <li key={i} className="flex gap-3 text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap w-24 shrink-0">
                {new Date(t.fecha).toLocaleDateString("es-AR")}
              </span>
              <span className="text-[#1A2A44] font-semibold">{t.texto}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Historial del jugador */}
      {(historial ?? []).length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44]">Otros pases de este jugador</h2>
          {(historial ?? []).map((h) => (
            <Link
              key={h.id}
              href={`/admin/tramites/pases/${h.id}`}
              className="text-xs font-semibold text-slate-600 hover:text-[#F97316] transition flex items-center gap-2"
            >
              <span className="text-slate-400">
                {new Date(h.created_at).toLocaleDateString("es-AR")}
              </span>
              {(h.from as unknown as { name: string } | null)?.name ?? "Libre"} →{" "}
              {(h.to as unknown as { name: string } | null)?.name ?? "—"}
              {h.numero_pase && (
                <span className="font-mono text-[#F97316]">{h.numero_pase}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* Comprobante oficial (solo cuando el pase quedó efectivo) */}
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
