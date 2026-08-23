import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { FormularioFirma9b } from "@/components/pases/FormularioFirma9b";
import { ShieldCheck, ArrowRight } from "lucide-react";

interface DatosFirmaPase {
  transfer_id: string;
  jugador: string;
  jugador_dni_ultimos3: string;
  es_menor: boolean;
  club_origen: string;
  club_destino: string;
  tipo_pase: "definitivo" | "prestamo";
  fecha_retorno: string | null;
  torneo: string | null;
  aprobado_en: string | null;
  habilitada: boolean;
  motivo: "firmado" | "rechazado" | "cancelado" | null;
}

/**
 * FIRMA ONLINE DEL PASE (Paso 9B) — página PÚBLICA (el jugador no tiene usuario).
 * El link lleva un token secreto de un solo uso que dura 72 hs.
 * El jugador lee su documento de conformidad, dibuja su firma y se saca una
 * foto del DNI; si es menor de edad, también firma su madre, padre o tutor/a.
 */
export default async function FirmarPase({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createLfsServerClient();

  const { data } = await supabase.rpc("obtener_pase_firma", { p_token: token });
  const pase = (Array.isArray(data) ? data[0] : data) as DatosFirmaPase | null;

  const nombreTramite = pase?.tipo_pase === "prestamo" ? "préstamo" : "pase definitivo";

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="text-center">
          <p className="font-serif font-black text-xl text-[#1A2A44]">Liga de Fútsal de Ushuaia</p>
          <p className="text-[11px] text-slate-400 uppercase tracking-widest">
            Firma online de pase
          </p>
        </div>

        {!pase ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">🔗</p>
            <p className="font-black text-[#1A2A44]">Este link no es válido</p>
            <p className="text-xs text-slate-500">
              Puede haberse usado ya o estar mal copiado. Pedile el link nuevo a tu club.
            </p>
          </div>
        ) : pase.motivo === "firmado" ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">✅</p>
            <p className="font-black text-green-900">Este pase ya fue firmado</p>
            <p className="text-xs text-green-800">
              La liga está revisando la documentación. Cuando se oficialice te avisan por los
              canales del club.
            </p>
          </div>
        ) : pase.motivo === "rechazado" ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">❌</p>
            <p className="font-black text-red-900">Este pase fue rechazado</p>
            <p className="text-xs text-red-800">
              El jugador no aceptó el {nombreTramite}. Si fue un error, el club destino tiene que
              iniciar un trámite nuevo.
            </p>
          </div>
        ) : pase.motivo === "cancelado" ? (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">🚫</p>
            <p className="font-black text-[#1A2A44]">Este pase fue cancelado</p>
            <p className="text-xs text-slate-500">
              El trámite ya no está vigente. Cualquier duda, hablá con tu club.
            </p>
          </div>
        ) : !pase.habilitada ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">⏰</p>
            <p className="font-black text-[#1A2A44]">Este link ya no sirve</p>
            <p className="text-xs text-slate-500">
              El link de firma dura 72 hs y este ya venció. La liga puede generar uno nuevo:
              pedíselo a tu club.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-1 shadow-sm">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Estás firmando el {nombreTramite} de
              </p>
              <p className="font-black text-lg text-[#1A2A44]">{pase.jugador}</p>
              <p className="text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{pase.club_origen}</span>
                <ArrowRight className="w-4 h-4 text-[#F97316]" />
                <span className="font-bold text-[#1A2A44]">{pase.club_destino}</span>
              </p>
              {pase.es_menor && (
                <p className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-2.5 py-1.5 mt-1.5 w-fit">
                  🛡️ Jugador/a menor de edad: también tiene que firmar su madre, padre o tutor/a.
                </p>
              )}
            </div>

            <FormularioFirma9b
              token={token}
              jugador={pase.jugador}
              dniUltimos3={pase.jugador_dni_ultimos3}
              esMenor={pase.es_menor}
              clubOrigen={pase.club_origen}
              clubDestino={pase.club_destino}
              tipoPase={pase.tipo_pase}
              fechaRetorno={pase.fecha_retorno}
              torneo={pase.torneo}
            />
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Plataforma LFS — la firma queda registrada con fecha, hora y evidencia.
        </p>
      </div>
    </main>
  );
}
