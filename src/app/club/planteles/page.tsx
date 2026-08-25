import { redirect } from "next/navigation";
import { createLfsServerClient } from "@/lib/infrastructure/supabase/server";
import { PlantelClub, type JugadorPlantel } from "@/components/club/PlantelClub";

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

export default async function ClubPlantelesPage() {
  const supabase = await createLfsServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Obtener el club del delegado actual
  const { data: profile } = await supabase
    .from("profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  const clubId = profile?.club_id;
  if (!clubId) redirect("/club/dashboard");

  // 1. Datos del club
  const { data: club } = await supabase
    .from("clubs")
    .select("id, name")
    .eq("id", clubId)
    .single();

  if (!club) redirect("/club/dashboard");

  // 2. Categorías de la liga
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, level_hierarchy")
    .order("level_hierarchy");

  // 3. Jugadores del club con sus categorías asociadas
  const { data: rows } = await supabase
    .from("player_categories")
    .select(
      "player_id, players ( id, dni, first_name, last_name, status, documents ), categories ( id, name )"
    )
    .eq("club_id", clubId);

  // 4. Agrupar categorías por jugador (un jugador puede pertenecer a más de una categoría)
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

  return (
    <PlantelClub
      clubId={club.id}
      clubName={club.name}
      jugadores={jugadores}
      categories={(categories ?? []) as Category[]}
    />
  );
}
