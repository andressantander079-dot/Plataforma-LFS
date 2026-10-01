import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Transferencias • Liga de Fútsal de Ushuaia",
  description:
    "Pases y transferencias oficiales de la Liga de Fútsal de Ushuaia: todos los movimientos efectivos del mercado.",
};

/**
 * TRANSFERENCIAS (pública, Paso 11)
 * Todos los pases efectivos del mercado, estilo "centro de fichajes".
 * Datos que ve cualquier visitante: jugador, foto, clubes, tipo y número.
 * NUNCA se muestran montos ni deudas: eso es interno de la liga.
 * Los datos salen de la función pases_publicos() (solo pases efectivos).
 */

interface PasePublico {
  transfer_id: string;
  jugador: string;
  foto_url: string | null;
  club_origen: string;
  club_destino: string;
  tipo_pase: string;
  numero_pase: string | null;
  oficializado_en: string;
}

export default async function TransferenciasPage() {
  const supabase = await createLfsServerClient();
  const { data } = await supabase.rpc("pases_publicos");
  const pases = (data ?? []) as PasePublico[];

  const urlFotos = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos-jugadores/`;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="font-serif text-2xl sm:text-3xl font-black text-[#1A2A44] flex items-center gap-2">
          <ArrowLeftRight className="w-7 h-7 text-[#F97316]" />
          Transferencias
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Mercado de pases oficial de la Liga de Fútsal de Ushuaia. Solo se muestran los pases
          ya efectivos, confirmados por la liga.
        </p>
      </div>

      {pases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <ArrowLeftRight className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            Todavía no hay transferencias oficiales en este mercado.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Cuando la liga confirme el primer pase, va a aparecer acá.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pases.map((p) => (
            <article
              key={p.transfer_id}
              className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#F97316]/40 transition overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.foto_url ? `${urlFotos}${p.foto_url}` : "/jugador-default.png"}
                  alt={`Foto de ${p.jugador}`}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="font-black text-sm text-[#1A2A44] truncate">{p.jugador}</h2>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{p.club_origen}</span>
                    <ArrowRight className="w-3 h-3 text-[#F97316] shrink-0" />
                    <span className="font-bold text-[#1A2A44] truncate">{p.club_destino}</span>
                  </p>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {p.tipo_pase === "prestamo" && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">
                      Préstamo
                    </span>
                  )}
                  <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Oficial
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">
                  {p.numero_pase && (
                    <span className="font-mono text-[#F97316] mr-2">{p.numero_pase}</span>
                  )}
                  {new Date(p.oficializado_en).toLocaleDateString("es-AR")}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 text-center">
        Últimos {pases.length} movimientos oficiales · Los montos y condiciones son privados entre
        los clubes y la liga.
      </p>
    </div>
  );
}
