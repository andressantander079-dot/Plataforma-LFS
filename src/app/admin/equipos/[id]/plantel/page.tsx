import { notFound } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import {
  PlantelInteractivo,
  type JugadorPlantel,
  type UsuarioClub,
} from "@/components/admin/PlantelInteractivo";
import { FormularioPaseHistorico } from "@/components/pases/FormularioPaseHistorico";

/**
 * PLANTEL DE UN CLUB (server component)
 * Trae club, jugadores (con documentos), categorías y usuarios
 * con acceso desde Supabase y se los pasa al componente interactivo.
 */

interface PlayerRow {
  player_id: string;
  players: {
    id: string;
    dni: string;
    first_name: string;
    last_name: string;
    status: "activo" | "inactivo";
    documents: Record<string, string> | null;
  } | null;
  categories: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  level_hierarchy: number;
}

export default async function ClubPlantelAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  const supabase = await createLfsServerClient();

  // 1. Datos del club
  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", id)
    .single();

  if (!club) notFound();

  // 2. Categorías de la liga (para el formulario del panel)
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, level_hierarchy")
    .order("level_hierarchy");

  // 3. Jugadores del club con sus categorías
  const { data: rows } = await supabase
    .from("player_categories")
    .select(
      "player_id, players ( id, dni, first_name, last_name, status, documents ), categories ( id, name )"
    )
    .eq("club_id", id);

  // 4. Usuarios con acceso al panel del club
  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, full_name, email, created_at")
    .eq("club_id", id)
    .order("created_at");

  // 5. Agrupar: un jugador puede aparecer en varias filas (una por categoría)
  const mapa = new Map<string, JugadorPlantel>();
  for (const row of (rows ?? []) as unknown as PlayerRow[]) {
    if (!row.players) continue;
    const existente = mapa.get(row.player_id);
    const categoria = row.categories?.name;
    if (existente) {
      if (categoria && !existente.categories.includes(categoria)) {
        existente.categories.push(categoria);
      }
    } else {
      mapa.set(row.player_id, {
        id: row.players.id,
        dni: row.players.dni,
        fullName: `${row.players.last_name}, ${row.players.first_name}`,
        status: row.players.status,
        categories: categoria ? [categoria] : [],
        documents: (row.players.documents as Record<string, string>) ?? {},
      });
    }
  }

  const jugadores = Array.from(mapa.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  // 6. Todos los clubes (para la carga de pases históricos en papel)
  const { data: todosLosClubes } = await supabase
    .from("clubs")
    .select("id, name")
    .order("name");

  return (
    <div className="flex flex-col gap-6">
      <PlantelInteractivo
        clubId={club.id}
        clubName={club.name}
        jugadores={jugadores}
        categories={(categories ?? []) as Category[]}
        usuarios={(usuarios ?? []) as UsuarioClub[]}
        abrirPanelInicial={nuevo === "1"}
      />

      {/* Paso 9B: registro de pases históricos en papel (solo carga, no altera nada) */}
      <FormularioPaseHistorico clubes={(todosLosClubes ?? []) as { id: string; name: string }[]} />
    </div>
  );
}
