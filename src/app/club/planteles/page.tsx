import { redirect } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  PlantelClubInteractivo,
  type PlantelUI,
  type JugadorFila,
  type CategoriaConRangoUI,
} from "@/components/club/PlantelClubInteractivo";
import { BotonCerrarSesion } from "@/components/auth/BotonCerrarSesion";

/**
 * PLANTELES DEL CLUB (rol club) — Paso 10B.
 * Flujo: 1) el club CREA sus planteles (uno por categoría) →
 * 2) inscribe jugadores DENTRO de cada plantel (DNI único, fecha de
 * nacimiento y foto obligatorias; la categoría tiene que ser la de su año).
 */

interface PlayerRow {
  player_id: string;
  category_id: string;
  players: {
    id: string;
    dni: string;
    first_name: string;
    last_name: string;
    status: "activo" | "inactivo";
    fecha_nacimiento: string | null;
    foto_path: string | null;
    documents: Record<string, string> | null;
  } | null;
}

interface PlantelRow {
  id: string;
  category_id: string;
  categories: {
    id: string;
    name: string;
    level_hierarchy: number;
    anio_desde: number | null;
    anio_hasta: number | null;
  } | null;
}

export default async function ClubPlanteles() {
  const supabase = await createLfsServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Perfil del usuario logueado: a qué club pertenece
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md text-center flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-orange-500" />
          <h1 className="font-serif text-xl font-bold text-[#1A2A44]">
            Usuario sin club asignado
          </h1>
          <p className="text-slate-500 text-sm">
            Tu usuario todavía no está vinculado a ningún club. Pedile a la
            federación que asigne tu cuenta desde el panel de administración.
          </p>
          <div className="w-40">
            <BotonCerrarSesion />
          </div>
        </div>
      </main>
    );
  }

  const clubId = profile.club_id;

  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", clubId)
    .single();

  if (!club) redirect("/login");

  // 1. Todas las categorías de la liga (con sus rangos de años)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, level_hierarchy, anio_desde, anio_hasta")
    .order("level_hierarchy");

  const todasLasCategorias = (categories ?? []) as CategoriaConRangoUI[];

  // 2. Planteles creados por el club
  const { data: plantelesRows } = await supabase
    .from("club_planteles")
    .select("id, category_id, categories ( id, name, level_hierarchy, anio_desde, anio_hasta )")
    .eq("club_id", clubId);

  // 3. Jugadores del club (con su categoría para repartirlos por plantel)
  const { data: rows } = await supabase
    .from("player_categories")
    .select(
      "player_id, category_id, players ( id, dni, first_name, last_name, status, fecha_nacimiento, foto_path, documents )"
    )
    .eq("club_id", clubId);

  // URL pública del bucket de fotos (carpeta = club)
  const urlFotos = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fotos-jugadores/`;

  // Repartir jugadores por categoría
  const jugadoresPorCategoria = new Map<string, JugadorFila[]>();
  for (const row of (rows ?? []) as unknown as PlayerRow[]) {
    if (!row.players) continue;
    const lista = jugadoresPorCategoria.get(row.category_id) ?? [];
    lista.push({
      id: row.players.id,
      dni: row.players.dni,
      fullName: `${row.players.last_name}, ${row.players.first_name}`,
      status: row.players.status,
      fechaNacimiento: row.players.fecha_nacimiento,
      fotoUrl: row.players.foto_path ? `${urlFotos}${row.players.foto_path}` : null,
      documentosCargados: Object.keys(
        (row.players.documents as Record<string, string>) ?? {}
      ),
    });
    jugadoresPorCategoria.set(row.category_id, lista);
  }

  const planteles: PlantelUI[] = ((plantelesRows ?? []) as unknown as PlantelRow[])
    .filter((p) => p.categories)
    .map((p) => ({
      plantelId: p.id,
      categoria: p.categories as CategoriaConRangoUI,
      jugadores: (jugadoresPorCategoria.get(p.category_id) ?? []).sort((a, b) =>
        a.fullName.localeCompare(b.fullName)
      ),
    }))
    .sort((a, b) => a.categoria.level_hierarchy - b.categoria.level_hierarchy);

  const idsConPlantel = new Set(planteles.map((p) => p.categoria.id));
  const categoriasSinPlantel = todasLasCategorias.filter((c) => !idsConPlantel.has(c.id));

  return (
    <PlantelClubInteractivo
      clubId={club.id}
      clubName={club.name}
      planteles={planteles}
      categoriasSinPlantel={categoriasSinPlantel}
    />
  );
}
