import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { ConfigPasesForm, type PaseSettingsUI } from "@/components/pases/ConfigPasesForm";
import {
  RangosCategoriasForm,
  FeesPasesForm,
  type CategoriaRangoUI,
  type FeePaseUI,
} from "@/components/pases/ConfigCategoriasYFees";

export const dynamic = "force-dynamic";

/**
 * CONFIGURACIÓN DEL MERCADO DE PASES (solo la liga, Paso 11)
 *  · Reglas generales: tenencia, recargo por rescisión y tiempos automáticos.
 *  · Años de nacimiento por categoría (de acá salen las validaciones de
 *    inscripción y el cálculo de menor de edad en las firmas).
 *  · Derecho de pase que cobra la federación por categoría/tipo/torneo.
 */

interface FeeRow {
  id: string;
  category_id: string;
  competition_id: string | null;
  tipo: string;
  monto: number;
  categories: { name: string } | null;
  competitions: { name: string } | null;
}

export default async function ConfiguracionPasesPage() {
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

  const [{ data: settings }, { data: categorias }, { data: fees }, { data: torneos }] =
    await Promise.all([
      supabase
        .from("pase_settings")
        .select(
          "tenencia_anios, recargo_rescision, alerta_trabado_horas, cancelacion_trabado_horas, aviso_retorno_horas"
        )
        .eq("id", 1)
        .single(),
      supabase
        .from("categories")
        .select("id, name, level_hierarchy, anio_desde, anio_hasta")
        .order("level_hierarchy"),
      supabase
        .from("transfer_fees")
        .select("id, category_id, competition_id, tipo, monto, categories(name), competitions(name)")
        .order("monto", { ascending: false }),
      supabase.from("competitions").select("id, name").order("name"),
    ]);

  const settingsUI: PaseSettingsUI = {
    tenencia_anios: Number(settings?.tenencia_anios ?? 1),
    recargo_rescision: Number(settings?.recargo_rescision ?? 0),
    alerta_trabado_horas: Number(settings?.alerta_trabado_horas ?? 48),
    cancelacion_trabado_horas: Number(settings?.cancelacion_trabado_horas ?? 72),
    aviso_retorno_horas: Number(settings?.aviso_retorno_horas ?? 72),
  };

  const feesUI: FeePaseUI[] = ((fees ?? []) as unknown as FeeRow[]).map((f) => ({
    id: f.id,
    category_id: f.category_id,
    competition_id: f.competition_id,
    tipo: f.tipo,
    monto: Number(f.monto),
    categoria: f.categories?.name ?? "—",
    torneo: f.competitions?.name ?? null,
  }));

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="border-b border-slate-200 pb-4 flex flex-col gap-3">
        <Link
          href="/admin/tramites"
          className="text-xs font-bold text-slate-500 hover:text-[#F97316] transition flex items-center gap-1.5 w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Trámites
        </Link>
        <div>
          <h1 className="font-serif text-2xl font-black text-[#1A2A44] flex items-center gap-2">
            <Settings2 className="w-7 h-7 text-[#F97316]" />
            Configuración del mercado de pases
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Las reglas que la plataforma aplica sola: inscripciones por año, plazos de los
            trámites y cuánto cobra la federación por cada pase.
          </p>
        </div>
      </div>

      <ConfigPasesForm settings={settingsUI} />

      <RangosCategoriasForm categorias={(categorias ?? []) as CategoriaRangoUI[]} />

      <FeesPasesForm
        fees={feesUI}
        categorias={(categorias ?? []) as CategoriaRangoUI[]}
        torneos={(torneos ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
