import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { firmarPasePublico } from "@/lib/actions/pases.actions";
import { FormularioFirmaPublica } from "@/components/pases/FormularioFirmaPublica";
import { ShieldCheck, ArrowRight } from "lucide-react";

/**
 * FIRMA ONLINE DEL PASE — página PÚBLICA (el jugador no tiene usuario).
 * El link lleva un token secreto de un solo uso que dura 72 hs.
 * El jugador solo ve los datos de SU pase y firma con su DNI.
 */
export default async function FirmarPase({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createLfsServerClient();

  const { data } = await supabase.rpc("obtener_pase_firma", { p_token: token });
  const pase = Array.isArray(data) ? data[0] : data;

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-4">
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
        ) : !pase.habilitada ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center flex flex-col gap-2 shadow-sm">
            <p className="text-3xl">⏰</p>
            <p className="font-black text-[#1A2A44]">Este link ya no sirve</p>
            <p className="text-xs text-slate-500">
              El link de firma dura 72 hs y este ya venció (o el pase ya se firmó). La liga puede
              generar uno nuevo: pedíselo a tu club.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col gap-5 shadow-sm">
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Estás firmando el pase de
              </p>
              <p className="font-black text-lg text-[#1A2A44]">{pase.jugador}</p>
              <p className="text-sm text-slate-600 flex items-center gap-2 flex-wrap">
                <span className="font-semibold">{pase.club_origen}</span>
                <ArrowRight className="w-4 h-4 text-[#F97316]" />
                <span className="font-bold text-[#1A2A44]">{pase.club_destino}</span>
              </p>
            </div>

            <FormularioFirmaPublica token={token} firmar={firmarPasePublico} />
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" />
          Plataforma LFS — la firma queda registrada con fecha y hora.
        </p>
      </div>
    </main>
  );
}
