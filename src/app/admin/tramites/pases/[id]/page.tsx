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
import { obtenerDetallePaseAdmin } from "@/lib/actions/tramites.actions";
import { StepperPase } from "@/components/pases/StepperPase";
import { AccionesPaseAdmin } from "@/components/pases/AccionesPaseAdmin";
import { LinkFirma } from "@/components/pases/LinkFirma";
import { NroFederativoInput } from "@/components/pases/NroFederativoInput";
import { DocumentosPase, type DocumentoPaseUI } from "@/components/pases/DocumentosPase";
import { ComprobantePase } from "@/components/pases/ComprobantePase";
import { EvidenciaFirma, type EvidenciaTutorUI } from "@/components/pases/EvidenciaFirma";
import { BotonImprimir } from "@/components/tesoreria/BotonImprimir";
import { TarjetaAccionPase, BarraAccionFija } from "@/components/tramites/TarjetaAccionPase";
import { HerramientasTrabado } from "@/components/tramites/HerramientasTrabado";
import { ChecklistPase } from "@/components/tramites/ChecklistPase";
import { CargoPrevistoPase } from "@/components/tramites/CargoPrevistoPase";
import { TimelinePase } from "@/components/tramites/TimelinePase";

/**
 * DETALLE DEL PASE (admin, Paso 15) — qué hay que hacer ahora, checklist del
 * trámite, cargo de tesorería previsto/real, stepper, evidencia de firma,
 * documentos, timeline y acciones. En móvil la acción principal queda fija
 * abajo de la pantalla.
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

  // Detalle enriquecido: checklist, cargo previsto, timeline, trabado, acción
  const detalle = await obtenerDetallePaseAdmin(id);

  const meta = (pase.metadata ?? {}) as Record<string, unknown>;
  const estado = detalle.estado;
  const ui = ESTADO_PASE_UI[estado];
  const esTerminal = ["7_COMPLETED", "8_RECHAZADO", "9_CANCELADO"].includes(estado);

  const jugadorNombre = detalle.jugadorNombre;
  const origen = detalle.origen;
  const destino = detalle.destino;

  const firmaToken = typeof meta.firma_token === "string" ? meta.firma_token : null;
  const firmaActiva =
    estado === "5_PLAYER_SIGNATURE" &&
    pase.approved_at &&
    isCredentialActive(pase.approved_at);

  // Evidencia de la firma online (9B): firma dibujada + foto del DNI (+ tutor si es menor)
  const firmaJugadorPath =
    typeof meta.firma_jugador_path === "string" ? meta.firma_jugador_path : null;
  const dniJugadorPath =
    typeof meta.foto_dni_jugador_path === "string" ? meta.foto_dni_jugador_path : null;
  const tutorRaw = meta.tutor as Record<string, unknown> | null | undefined;
  const tutorEvidencia: EvidenciaTutorUI | null =
    !!tutorRaw && typeof tutorRaw.dni === "string"
      ? {
          parentesco: String(tutorRaw.parentesco ?? "Tutor/a"),
          nombre: String(tutorRaw.nombre ?? ""),
          apellido: String(tutorRaw.apellido ?? ""),
          dni: String(tutorRaw.dni),
          firma_path: String(tutorRaw.firma_path ?? ""),
          dni_path: String(tutorRaw.foto_path ?? ""),
        }
      : null;
  const hayEvidencia = !!(firmaJugadorPath || dniJugadorPath || tutorEvidencia);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-24 md:pb-8">
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
            <Link
              href={`/admin/tramites/jugador/${pase.player_id}`}
              className="text-[11px] font-bold text-[#F97316] hover:underline mt-1 inline-block"
            >
              Ver trayectoria completa del jugador →
            </Link>
          </div>
          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full ${ui.className}`}>
            {ui.label}
          </span>
        </div>
      </div>

      {/* QUÉ HAY QUE HACER AHORA — la acción principal, siempre visible */}
      {!esTerminal && (
        <TarjetaAccionPase transferId={pase.id} accion={detalle.accion} trabado={detalle.trabado} />
      )}

      {/* Herramientas para destrabar (solo si está trabado) */}
      {detalle.trabado && !esTerminal && <HerramientasTrabado transferId={pase.id} />}

      {/* Checklist automático del trámite */}
      {!esTerminal && <ChecklistPase items={detalle.checklist} />}

      {/* Cargo a tesorería: previsto desde el inicio, real al completarse */}
      <CargoPrevistoPase
        previsto={detalle.cargoPrevisto}
        cargosReales={detalle.cargosReales}
        completado={estado === "7_COMPLETED"}
      />

      {/* Stepper del circuito */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <StepperPase estado={estado} />
        {!esTerminal && (
          <p className="text-[11px] text-slate-400 mt-3">
            Ahora le toca a: <span className="font-bold text-slate-600">{aQuienLeToca(estado)}</span>
          </p>
        )}
      </div>

      {/* Acciones clásicas de la liga (rechazar, regenerar link, deuda saldada) */}
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

      {/* Evidencia de la firma online (9B) */}
      {hayEvidencia && (
        <EvidenciaFirma
          transferId={pase.id}
          firmaJugadorPath={firmaJugadorPath}
          dniJugadorPath={dniJugadorPath}
          tutor={tutorEvidencia}
        />
      )}

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
        <DocumentosPase transferId={pase.id} documentos={detalle.documentos as DocumentoPaseUI[]} />
      </div>

      {/* Timeline del trámite (con fecha y hora de cada evento) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
        <h2 className="font-bold text-sm text-[#1A2A44] flex items-center gap-2">
          <History className="w-4 h-4 text-[#F97316]" /> Historial del trámite
        </h2>
        <TimelinePase eventos={detalle.timeline} />
      </div>

      {/* Historial del jugador */}
      {detalle.historial.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2">
          <h2 className="font-bold text-sm text-[#1A2A44]">Otros pases de este jugador</h2>
          {detalle.historial.map((h) => (
            <Link
              key={h.id}
              href={`/admin/tramites/pases/${h.id}`}
              className="text-xs font-semibold text-slate-600 hover:text-[#F97316] transition flex items-center gap-2"
            >
              <span className="text-slate-400">
                {new Date(h.created_at).toLocaleDateString("es-AR")}
              </span>
              {h.origen} → {h.destino}
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

      {/* Barra fija inferior con la acción principal (solo móvil) */}
      {!esTerminal && <BarraAccionFija transferId={pase.id} accion={detalle.accion} />}
    </div>
  );
}
