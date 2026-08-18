-- =====================================================================
-- PLATAFORMA LFS — HOTFIX DE SEGURIDAD (agosto 2026)
-- Cierra 4 agujeros encontrados en la auditoría:
--
--   🔴 1. CLUBS: la lectura pública exponía DNI y teléfonos de
--         presidentes y tesoreros a CUALQUIERA (la clave anónima viaja
--         en el navegador). Ahora: solo la federación y el propio club.
--   🔴 2. PLAYERS: la política vieja tenía un bug ("club_id IN (select
--         id from clubs)" es siempre verdadero) → cualquier usuario
--         logueado leía TODOS los jugadores con DNI. Ahora: cada club
--         solo su plantel; el árbitro designado solo los clubes de su
--         partido; la federación todo.
--   🟠 3. AUDIT_LOGS: cualquier usuario logueado podía escribir
--         registros falsos de auditoría. Ahora: solo la federación.
--   🟡 4. TRANSFERS: tenía RLS activado sin políticas (todo bloqueado).
--         Políticas mínimas para el futuro módulo de pases.
--
-- Este script se ejecuta UNA sola vez en el SQL Editor de Supabase.
-- Es seguro volver a correrlo (usa drop if exists / create or replace).
-- =====================================================================

-- Helper del Paso 7A (lo recreamos por las dudas: es idempotente)
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
-- 1. CLUBS — cerrar la lectura pública
--    La web pública no necesita leer clubs (muestra nombres de EQUIPOS,
--    que siguen públicos). Datos de dirigentes solo para federación
--    y el propio club.
-- ---------------------------------------------------------------------
drop policy if exists "Permitir lectura publica de clubes" on public.clubs;

create policy "clubs: admin o el propio club"
  on public.clubs for select to authenticated
  using (
    public.is_admin()
    or id = public.mi_club_id()
  );

-- ---------------------------------------------------------------------
-- 2. PLAYERS — corregir la política bugueada
--    (agregamos además políticas de respaldo para escritura admin y
--    para player_categories: si RLS estaba desactivado no cambia nada,
--    y si estaba activado queda todo cubierto para admin/club/árbitro)
-- ---------------------------------------------------------------------
drop policy if exists "Lectura de jugadores para administradores y su club" on public.players;

create policy "players: admin, su club o arbitro designado"
  on public.players for select to authenticated
  using (
    public.is_admin()
    -- el club ve su propio plantel
    or id in (
      select pc.player_id
      from public.player_categories pc
      where pc.club_id = public.mi_club_id()
    )
    -- el árbitro designado ve los jugadores de los clubes de su partido
    -- (los necesita para editar la planilla: bajas, altas y eventos)
    or id in (
      select pc2.player_id
      from public.player_categories pc2
      join public.teams t on t.club_id = pc2.club_id
      join public.matches m
        on m.home_team_id = t.id or m.away_team_id = t.id
      where m.referee_id = auth.uid()
    )
  );

-- Respaldo: la federación gestiona jugadores (alta/edición de plantel)
drop policy if exists "players: admin gestiona" on public.players;
create policy "players: admin gestiona"
  on public.players for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- PLAYER_CATEGORIES: lectura coherente con players + escritura admin
drop policy if exists "player_categories: lectura admin, su club o arbitro" on public.player_categories;
create policy "player_categories: lectura admin, su club o arbitro"
  on public.player_categories for select to authenticated
  using (
    public.is_admin()
    or club_id = public.mi_club_id()
    or club_id in (
      select t.club_id from public.teams t
      join public.matches m
        on m.home_team_id = t.id or m.away_team_id = t.id
      where m.referee_id = auth.uid()
    )
  );

drop policy if exists "player_categories: admin gestiona" on public.player_categories;
create policy "player_categories: admin gestiona"
  on public.player_categories for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. AUDIT_LOGS — solo la federación escribe
--    (la lectura ya era solo admin; queda igual)
-- ---------------------------------------------------------------------
drop policy if exists "Cualquier usuario puede insertar logs de auditoria" on public.audit_logs;

create policy "Solo la federacion escribe auditoria"
  on public.audit_logs for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. TRANSFERS — políticas mínimas (módulo de pases, futuro)
-- ---------------------------------------------------------------------
create policy "transfers: admin todo"
  on public.transfers for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "transfers: club origen o destino lee"
  on public.transfers for select to authenticated
  using (
    from_club_id = public.mi_club_id()
    or to_club_id = public.mi_club_id()
  );

-- ---------------------------------------------------------------------
-- FIN. Verificación rápida (deben devolver estas cantidades):
--   select policyname from pg_policies where tablename = 'clubs';
--     → 2 filas (lectura nueva + escritura admin)
--   select policyname from pg_policies where tablename = 'players';
--     → la nueva política (y las de escritura que ya hubiera)
--   select policyname from pg_policies where tablename = 'audit_logs';
--     → 2 filas (lectura admin + escritura admin)
--   select policyname from pg_policies where tablename = 'transfers';
--     → 2 filas
-- ---------------------------------------------------------------------
