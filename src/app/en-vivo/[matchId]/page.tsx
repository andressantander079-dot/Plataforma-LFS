import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { obtenerTransmision } from "@/lib/actions/planilla-en-vivo.actions";
import { TransmisionEnVivo } from "@/components/transmision/TransmisionEnVivo";

export const dynamic = "force-dynamic";

/**
 * TRANSMISIÓN DEL PARTIDO — Paso 17C
 * Vista pública (sin login): marcador al instante, papelitos en los
 * goles, sonido, minuto a minuto, reacciones y figura del partido.
 */
export default async function TransmisionPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const res = await obtenerTransmision(matchId);

  if (!res.data) {
    return (
      <main className="min-h-screen bg-[#0d1526] text-white flex items-center justify-center px-4">
        <div className="text-center flex flex-col gap-4 max-w-md">
          <p className="text-5xl">🏟️</p>
          <h1 className="font-serif text-2xl font-black">Este partido todavía no arrancó</h1>
          <p className="text-slate-400 text-sm">
            Cuando el árbitro lo inicie, la transmisión se activa sola. Volvé en un rato.
          </p>
          <Link
            href="/en-vivo"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#F97316] hover:bg-[#ea6a0a] text-white font-bold text-sm px-6 py-3 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Ver partidos en vivo
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <Link
        href="/en-vivo"
        className="fixed top-4 left-4 z-50 inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-bold px-3.5 py-2 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> En vivo
      </Link>
      <TransmisionEnVivo
        matchId={matchId}
        datosIniciales={
          res.data as unknown as Parameters<typeof TransmisionEnVivo>[0]["datosIniciales"]
        }
      />
    </>
  );
}
