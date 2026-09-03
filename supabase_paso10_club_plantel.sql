-- ============================================================================
-- PLATAFORMA LFS — PASO 10: EL CLUB SE AUTOGESTIONA (plantel propio)
-- ----------------------------------------------------------------------------
-- Hasta acá, SOLO la federación podía dar de alta jugadores. Con este script
-- el club también puede inscribir jugadores en SU propio plantel:
--   1. players: el rol club puede INSERTAR jugadores (el DNI es único en la
--      liga; si ya existe, la app avisa que corresponde un pase).
--   2. player_categories: el club solo puede vincular jugadores a SU club
--      (club_id = mi_club_id()). No puede tocar otros clubes.
-- La lectura ya estaba habilitada (hotfix de seguridad) y la edición de
-- fecha de nacimiento/foto sigue pasando por la función club_actualizar_jugador.
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. PLAYERS — inserción para el rol club
--    (la edición/baja sigue siendo solo de la liga; el club usa las funciones)
-- ---------------------------------------------------------------------------
drop policy if exists "players: club inserta" on public.players;

create policy "players: club inserta"
  on public.players for insert to authenticated
  with check (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'club'
    )
  );

-- ---------------------------------------------------------------------------
-- 2. PLAYER_CATEGORIES — el club vincula jugadores SOLO a su propio club
-- ---------------------------------------------------------------------------
drop policy if exists "player_categories: club vincula su club" on public.player_categories;

create policy "player_categories: club vincula su club"
  on public.player_categories for insert to authenticated
  with check (
    club_id = public.mi_club_id()
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'club'
    )
  );

-- ============================================================================
-- VERIFICACIÓN FINAL — comparar con la guía:
--   "policies nuevas del club: 2 de 2"
-- ============================================================================
select
  'policies nuevas del club' as chequeo,
  count(*)::text || ' de 2' as resultado
from pg_policies
where schemaname = 'public'
  and policyname in (
    'players: club inserta',
    'player_categories: club vincula su club'
  );
