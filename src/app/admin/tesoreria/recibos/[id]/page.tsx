import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ReciboDocumento } from "@/components/tesoreria/ReciboDocumento";
import { BotonImprimir } from "@/components/tesoreria/BotonImprimir";

/** RECIBO OFICIAL del pago aprobado (vista tesorería). */
export default async function ReciboTesoreria({
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

  const { data: pago } = await supabase
    .from("treasury_payments")
    .select("*, clubs(name), treasury_charges(descripcion, tipo)")
    .eq("id", id)
    .eq("status", "aprobado")
    .single();
  if (!pago || !pago.receipt_number) notFound();

  const { data: settings } = await supabase
    .from("treasury_settings")
    .select("league_legal_name, league_cuit, league_address")
    .eq("id", 1)
    .single();

  const cargo = pago.treasury_charges as unknown as {
    descripcion: string;
    tipo: string;
  } | null;

  return (
    <div className="flex flex-col gap-5 max-w-3xl mx-auto py-4">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/admin/tesoreria/movimientos"
          className="text-xs font-bold text-slate-400 hover:text-[#F97316] transition flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a Movimientos
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
          ligaNombre: settings?.league_legal_name ?? null,
          ligaCuit: settings?.league_cuit ?? null,
          ligaDomicilio: settings?.league_address ?? null,
        }}
      />
    </div>
  );
}
