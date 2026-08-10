-- =====================================================================
-- PLATAFORMA LFS — PASO 7A: PLANILLA DIGITAL
-- Convocatoria del club ("Gestionar Plantel"), edición por el árbitro,
-- aprobación de la federación y eventos del partido (goles, tarjetas,
-- cambios) por jugador.
--
-- Este script se ejecuta UNA sola vez en el SQL Editor de Supabase.
-- Si lo volvés a correr y dice "already exists", significa que ya estaba.
-- =====================================================================

-- Helper: club del usuario logueado (si no tiene, devuelve null)
create or replace function public.mi_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- 1. PLANILLA DEL PARTIDO (una por partido)
--    borrador  → el club está cargando la convocatoria
--    confirmada→ el club confirmó; el árbitro puede editar (bajas/altas)
--    aprobada  → la federación la aprobó; el club puede verla/descargarla
-- ---------------------------------------------------------------------
create table public.match_sheets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  status text not null default 'borrador'
    check (status in ('borrador', 'confirmada', 'aprobada')),
  -- Cada club confirma su propia convocatoria por separado:
  confirmada_local timestamptz,   -- club del equipo local confirmó
  confirmada_visitante timestamptz, -- club del equipo visitante confirmó
  confirmed_at timestamptz,       -- ambos confirmaron → árbitro puede editar
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. JUGADORES CONVOCADOS EN LA PLANILLA
--    La regla de categorías (los más chicos pueden subir, nunca bajar)
--    se valida en la acción del servidor al momento de convocar.
-- ---------------------------------------------------------------------
create table public.match_sheet_players (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references public.match_sheets(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  es_titular boolean not null default true,
  agregado_por text not null default 'club'
    check (agregado_por in ('club', 'arbitro', 'admin')),
  created_at timestamptz not null default now(),
  unique (sheet_id, player_id)
);

-- ---------------------------------------------------------------------
-- 3. EVENTOS DEL PARTIDO (goles, tarjetas, cambios) por jugador
--    Para 'cambio': player_id = el que ENTRA,
--    jugador_relacionado_id = el que SALE.
-- ---------------------------------------------------------------------
create table public.match_events (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  jugador_relacionado_id uuid references public.players(id) on delete set null,
  tipo text not null
    check (tipo in ('gol', 'gol_en_contra', 'amarilla', 'roja', 'cambio')),
  minuto int check (minuto between 0 and 60),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.match_sheets enable row level security;
alter table public.match_sheet_players enable row level security;
alter table public.match_events enable row level security;

-- ---------------------------------------------------------------------
-- RLS — match_sheets
-- ---------------------------------------------------------------------

-- Lectura: admin, árbitro designado, o club que juega ese partido
create policy "planilla lectura involucrados"
  on public.match_sheets for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_sheets.match_id
        and (
          m.referee_id = auth.uid()
          or ht.club_id = public.mi_club_id()
          or at.club_id = public.mi_club_id()
        )
    )
  );

-- Admin: todo
create policy "planilla admin todo"
  on public.match_sheets for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Club: crea la planilla de un partido de su club y la edita en borrador
create policy "planilla club crea"
  on public.match_sheets for insert to authenticated
  with check (
    exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_id
        and (ht.club_id = public.mi_club_id() or at.club_id = public.mi_club_id())
    )
  );

create policy "planilla club edita borrador"
  on public.match_sheets for update to authenticated
  using (
    status = 'borrador'
    and exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_sheets.match_id
        and (ht.club_id = public.mi_club_id() or at.club_id = public.mi_club_id())
    )
  )
  with check (
    exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_id
        and (ht.club_id = public.mi_club_id() or at.club_id = public.mi_club_id())
    )
  );

-- Árbitro designado: edita cuando está confirmada (bajas/altas en el partido)
create policy "planilla arbitro edita confirmada"
  on public.match_sheets for update to authenticated
  using (
    status = 'confirmada'
    and exists (
      select 1 from public.matches m
      where m.id = match_sheets.match_id
        and m.referee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.referee_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RLS — match_sheet_players
-- ---------------------------------------------------------------------

create policy "convocados lectura involucrados"
  on public.match_sheet_players for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.match_sheets s
      join public.matches m on m.id = s.match_id
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where s.id = match_sheet_players.sheet_id
        and (
          m.referee_id = auth.uid()
          or ht.club_id = public.mi_club_id()
          or at.club_id = public.mi_club_id()
        )
    )
  );

create policy "convocados admin todo"
  on public.match_sheet_players for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Club: agrega/quita convocados de SU equipo mientras la planilla es borrador
create policy "convocados club gestiona en borrador"
  on public.match_sheet_players for insert to authenticated
  with check (
    exists (
      select 1
      from public.match_sheets s
      join public.teams t on t.id = match_sheet_players.team_id
      where s.id = sheet_id
        and s.status = 'borrador'
        and t.club_id = public.mi_club_id()
    )
  );

create policy "convocados club quita en borrador"
  on public.match_sheet_players for delete to authenticated
  using (
    exists (
      select 1
      from public.match_sheets s
      join public.teams t on t.id = match_sheet_players.team_id
      where s.id = sheet_id
        and s.status = 'borrador'
        and t.club_id = public.mi_club_id()
    )
  );

-- Árbitro: agrega/quita cuando está confirmada (bajas de último momento)
create policy "convocados arbitro gestiona confirmada"
  on public.match_sheet_players for insert to authenticated
  with check (
    exists (
      select 1
      from public.match_sheets s
      join public.matches m on m.id = s.match_id
      where s.id = sheet_id
        and s.status = 'confirmada'
        and m.referee_id = auth.uid()
    )
  );

create policy "convocados arbitro quita confirmada"
  on public.match_sheet_players for delete to authenticated
  using (
    exists (
      select 1
      from public.match_sheets s
      join public.matches m on m.id = s.match_id
      where s.id = sheet_id
        and s.status = 'confirmada'
        and m.referee_id = auth.uid()
    )
  );

-- Titular/suplente: club en borrador, árbitro en confirmada, admin todo
create policy "convocados club edita en borrador"
  on public.match_sheet_players for update to authenticated
  using (
    exists (
      select 1
      from public.match_sheets s
      join public.teams t on t.id = match_sheet_players.team_id
      where s.id = sheet_id
        and s.status = 'borrador'
        and t.club_id = public.mi_club_id()
    )
  )
  with check (
    exists (
      select 1
      from public.match_sheets s
      join public.teams t on t.id = match_sheet_players.team_id
      where s.id = sheet_id
        and t.club_id = public.mi_club_id()
    )
  );

create policy "convocados arbitro edita confirmada"
  on public.match_sheet_players for update to authenticated
  using (
    exists (
      select 1
      from public.match_sheets s
      join public.matches m on m.id = s.match_id
      where s.id = sheet_id
        and s.status = 'confirmada'
        and m.referee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.match_sheets s
      join public.matches m on m.id = s.match_id
      where s.id = sheet_id
        and m.referee_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RLS — match_events
-- ---------------------------------------------------------------------

create policy "eventos lectura involucrados"
  on public.match_events for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_events.match_id
        and (
          m.referee_id = auth.uid()
          or ht.club_id = public.mi_club_id()
          or at.club_id = public.mi_club_id()
        )
    )
  );

create policy "eventos admin todo"
  on public.match_events for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Árbitro designado: carga y borra eventos de su partido
create policy "eventos arbitro carga"
  on public.match_events for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.referee_id = auth.uid()
    )
  );

create policy "eventos arbitro borra"
  on public.match_events for delete to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.referee_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- FIN. Verificación rápida:
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename in ('match_sheets','match_sheet_players','match_events');
-- Deben aparecer las 3 tablas.
-- ---------------------------------------------------------------------
