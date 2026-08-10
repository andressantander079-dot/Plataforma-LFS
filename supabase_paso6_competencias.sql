-- =============================================================================
-- PLATAFORMA LFS — PASO 6: MÓDULO DE COMPETENCIAS (NÚCLEO)
-- Torneos por categoría, equipos (varios por club), canchas, fixture
-- automático, designación de árbitros, resultados con confirmación y
-- tabla de posiciones automática. Páginas públicas sin login.
-- Ejecutar en: Supabase → SQL Editor → Run
-- Requiere los pasos 1 al 5 (usa is_admin(), clubs.status, profiles.club_id)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. LIMPIEZA: la tabla matches vieja (del scaffold, basada en clubes) se
--    reemplaza por el diseño nuevo basado en equipos. Estaba sin uso.
--    match_sheets se re-diseñará en la fase de planillas digitales.
-- -----------------------------------------------------------------------------
drop table if exists public.match_sheets cascade;
drop table if exists public.matches cascade;

-- -----------------------------------------------------------------------------
-- 1. CANCHAS (escenarios donde se juega)
-- -----------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. COMPETENCIAS (torneos). Un torneo = una categoría.
--    Nombre libre: "Apertura 2026", "Clausura", "Copa Verano", etc.
--    Puntos, desempate, ida/vuelta y W.O. configurables por torneo.
-- -----------------------------------------------------------------------------
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season text not null default '2026',
  category_id uuid not null references public.categories(id),
  format text not null default 'liga'
    check (format in ('liga', 'eliminacion', 'grupos_playoffs', 'liga_playoffs')),
  rounds int not null default 1 check (rounds in (1, 2)), -- 1: solo ida · 2: ida y vuelta
  points_win int not null default 3,
  points_draw int not null default 1,
  points_loss int not null default 0,
  tiebreaker text not null default 'diferencia_gol'
    check (tiebreaker in ('diferencia_gol', 'enfrentamiento_directo')),
  wo_home_goals int not null default 5,  -- marcador W.O. configurable
  wo_away_goals int not null default 0,
  yellow_cards_suspension int not null default 5, -- amarillas para suspensión (fase disciplina)
  status text not null default 'borrador'
    check (status in ('borrador', 'en_curso', 'finalizado')),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. EQUIPOS: un club puede tener VARIOS equipos en una misma categoría
--    (ej: "HAF A" y "HAF B" en Sub-16). Los partidos se juegan entre equipos.
-- -----------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (club_id, category_id, name)
);

-- -----------------------------------------------------------------------------
-- 4. INSCRIPCIONES: qué equipos juegan cada torneo
-- -----------------------------------------------------------------------------
create table public.competition_teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (competition_id, team_id)
);

-- -----------------------------------------------------------------------------
-- 5. PARTIDOS (diseño nuevo, entre equipos)
--    status: programado · suspendido · jugado · wo
--    result_confirmed: el árbitro carga el resultado y queda pendiente
--    hasta que la federación lo confirma. La tabla usa solo confirmados.
-- -----------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  matchday int,                    -- fecha (jornada). Editable por la federación
  round int not null default 1,    -- 1: ida · 2: vuelta
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  scheduled_at timestamptz,        -- día y hora (los asigna la federación)
  venue_id uuid references public.venues(id) on delete set null,
  referee_id uuid references public.profiles(id) on delete set null, -- árbitro designado
  status text not null default 'programado'
    check (status in ('programado', 'suspendido', 'jugado', 'wo')),
  home_score int,
  away_score int,
  result_confirmed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create index matches_competition_fecha_idx on public.matches(competition_id, matchday);
create index matches_referee_idx on public.matches(referee_id) where status = 'programado';
create index matches_teams_idx on public.matches(home_team_id, away_team_id);

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
--    Lectura PÚBLICA (la web /fixture y /posiciones no piden login).
--    Escritura: solo la federación, salvo el resultado que carga el árbitro.
-- -----------------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.competition_teams enable row level security;
alter table public.matches enable row level security;

-- Lectura pública (anon + authenticated)
create policy "lectura publica venues" on public.venues
  for select using (true);
create policy "lectura publica competitions" on public.competitions
  for select using (true);
create policy "lectura publica teams" on public.teams
  for select using (true);
create policy "lectura publica competition_teams" on public.competition_teams
  for select using (true);
create policy "lectura publica matches" on public.matches
  for select using (true);

-- Escritura solo federación
create policy "admin venues" on public.venues
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin competitions" on public.competitions
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin teams" on public.teams
  for all using (public.is_admin()) with check (public.is_admin());
create policy "admin competition_teams" on public.competition_teams
  for all using (public.is_admin()) with check (public.is_admin());

create policy "admin matches" on public.matches
  for all using (public.is_admin()) with check (public.is_admin());

-- El árbitro designado puede cargar el resultado de SUS partidos.
-- No puede cambiar la designación ni tocar partidos ajenos.
create policy "arbitro carga resultado de sus partidos" on public.matches
  for update
  using (
    referee_id = auth.uid()
    and (select role from public.profiles where id = auth.uid()) = 'arbitro'
  )
  with check (referee_id = auth.uid());

-- =============================================================================
-- FIN. Verificación rápida:
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename in ('venues','competitions','teams','competition_teams','matches');
-- Deben aparecer las 5 tablas.
-- =============================================================================
