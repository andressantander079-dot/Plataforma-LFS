-- =====================================================================
-- PLATAFORMA LFS — PASO 7B: GOLEADORES Y DISCIPLINA AUTOMÁTICA
-- Tabla de suspensiones + funciones públicas de estadísticas.
--
-- Las tablas de goleadores y disciplina se calculan SOLAS desde los
-- eventos que carga el árbitro en la planilla (Paso 7A):
--   · 1 roja directa                    → 1 fecha de suspensión
--   · N amarillas en el mismo torneo    → 1 fecha de suspensión
--     (N lo define el torneo: competitions.yellow_cards_suspension)
-- La suspensión se descuenta sola cuando el equipo juega su siguiente
-- partido (resultado confirmado o W.O.) y el jugador no se puede
-- convocar mientras le queden fechas pendientes.
--
-- Este script se ejecuta UNA sola vez en el SQL Editor de Supabase.
-- Si lo volvés a correr y dice "already exists", significa que ya estaba.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SUSPENSIONES DE JUGADORES (una fila = una sanción de N fechas)
-- ---------------------------------------------------------------------
create table public.player_suspensions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  motivo text not null
    check (motivo in ('acumulacion_amarillas', 'roja')),
  partidos_pendientes int not null default 1 check (partidos_pendientes >= 0),
  -- evento de planilla que originó la sanción (trazabilidad)
  evento_origen_id uuid references public.match_events(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Una sanción por evento (evita duplicados si se reintenta)
create unique index suspension_evento_uniq
  on public.player_suspensions(evento_origen_id)
  where evento_origen_id is not null;

create index suspension_activas_idx
  on public.player_suspensions(competition_id, player_id)
  where partidos_pendientes > 0;

alter table public.player_suspensions enable row level security;

-- Lectura PÚBLICA: las sanciones de la liga se publican en /estadisticas
create policy "suspensiones lectura publica"
  on public.player_suspensions for select to anon, authenticated
  using (true);

-- Carga: la crea el sistema desde registrarEvento (árbitro del partido)
-- o la federación (admin)
create policy "suspensiones inserta arbitro origen o admin"
  on public.player_suspensions for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.match_events e
      join public.matches m on m.id = e.match_id
      where e.id = evento_origen_id
        and m.referee_id = auth.uid()
    )
  );

-- Descontar fechas cumplidas / corregir: solo la federación
create policy "suspensiones admin actualiza"
  on public.player_suspensions for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Borrar (cuando se borra el evento que la originó, o corrección admin)
create policy "suspensiones borra arbitro origen o admin"
  on public.player_suspensions for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.match_events e
      join public.matches m on m.id = e.match_id
      where e.id = player_suspensions.evento_origen_id
        and m.referee_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 2. ESTADÍSTICAS PÚBLICAS (funciones security definer)
--    La web /estadisticas es pública, pero la tabla players tiene DNI y
--    no se expone. Estas funciones devuelven SOLO nombre y equipo.
-- ---------------------------------------------------------------------

-- Goleadores del torneo (los goles en contra NO suman al jugador)
create or replace function public.goleadores_publicos(p_competition uuid)
returns table (player_id uuid, jugador text, equipo text, goles bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.player_id,
    p.last_name || ', ' || p.first_name as jugador,
    t.name as equipo,
    count(*) as goles
  from public.match_events e
  join public.matches m on m.id = e.match_id
  join public.players p on p.id = e.player_id
  join public.teams t on t.id = e.team_id
  where m.competition_id = p_competition
    and e.tipo = 'gol'
  group by e.player_id, e.team_id, p.last_name, p.first_name, t.name
  order by goles desc, jugador asc
  limit 50
$$;

-- Disciplina del torneo: amarillas y rojas por jugador
create or replace function public.disciplina_publica(p_competition uuid)
returns table (player_id uuid, jugador text, equipo text, amarillas bigint, rojas bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.player_id,
    p.last_name || ', ' || p.first_name as jugador,
    t.name as equipo,
    count(*) filter (where e.tipo = 'amarilla') as amarillas,
    count(*) filter (where e.tipo = 'roja') as rojas
  from public.match_events e
  join public.matches m on m.id = e.match_id
  join public.players p on p.id = e.player_id
  join public.teams t on t.id = e.team_id
  where m.competition_id = p_competition
    and e.tipo in ('amarilla', 'roja')
  group by e.player_id, e.team_id, p.last_name, p.first_name, t.name
  order by rojas desc, amarillas desc, jugador asc
  limit 50
$$;

-- Suspensiones activas del torneo (le quedan fechas por cumplir)
create or replace function public.suspensiones_publicas(p_competition uuid)
returns table (player_id uuid, jugador text, equipo text, motivo text, partidos_pendientes int)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.player_id,
    p.last_name || ', ' || p.first_name as jugador,
    t.name as equipo,
    s.motivo,
    s.partidos_pendientes
  from public.player_suspensions s
  join public.players p on p.id = s.player_id
  join public.teams t on t.id = s.team_id
  where s.competition_id = p_competition
    and s.partidos_pendientes > 0
  order by s.partidos_pendientes desc, jugador asc
$$;

-- ---------------------------------------------------------------------
-- FIN. Verificación rápida:
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename = 'player_suspensions';
--   select proname from pg_proc where proname in
--     ('goleadores_publicos','disciplina_publica','suspensiones_publicas');
-- Deben aparecer la tabla y las 3 funciones.
-- ---------------------------------------------------------------------
