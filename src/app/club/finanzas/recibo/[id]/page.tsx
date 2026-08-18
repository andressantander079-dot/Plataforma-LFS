import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ReciboDocumento } from "@/components/tesoreria/ReciboDocumento";
import { BotonImprimir } from "@/components/tesoreria/BotonImprimir";

/** RECIBO OFICIAL del pago (vista del club: solo los de SU club). */
export default async function ReciboClub({
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  const { data: pago } = await supabase
    .from("treasury_payments")
    .select("*, clubs(name), treasury_charges(descripcion, tipo)")
    .eq("id", id)
    .eq("status", "aprobado")
    .single();

  // RLS ya filtra por club; doble chequeo por las dudas
  if (!pago || !pago.receipt_number || pago.club_id !== profile?.club_id) notFound();

  const cargo = pago.treasury_charges as unknown as {
    descripcion: string;
    tipo: string;
  } | null;

  // Datos fiscales de la liga: información del recibo (documento público)
  const { data: fiscalesRaw } = await supabase.rpc("datos_fiscales_recibo");
  const fiscales = (Array.isArray(fiscalesRaw) ? fiscalesRaw[0] : fiscalesRaw) as {
    nombre: string | null;
    cuit: string | null;
    domicilio: string | null;
  } | null;

  return (
    <main className="min-h-screen bg-slate-100 py-6">
      <div className="flex flex-col gap-5 max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/club/finanzas"
            className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a mi cuenta
          </Link>
          <BotonImprimir />
        </div>

        <ReciboDocumento
          r={{
            numero: pago.receipt_number,
            fecha: pago.resuelto_at ?? pago.created_at,
            clubNombre: (pago.clubs as unknown as { name: string } | null)?.name ?? "—",
            descripcionCargo: cargo?.descripcion ?? "—",
            tipoCargo: cargo?.tipo ?? "otro",
            monto: Number(pago.monto),
            metodo: pago.metodo,
            ligaNombre: fiscales?.nombre ?? "Liga de Fútsal de Ushuaia",
            ligaCuit: fiscales?.cuit ?? null,
            ligaDomicilio: fiscales?.domicilio ?? null,
          }}
        />
      </div>
    </main>
  );
}
