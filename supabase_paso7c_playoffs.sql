-- ============================================================================
-- PLATAFORMA LFS · PASO 7C — LLAVES DE PLAYOFF
-- Habilita los formatos: eliminación directa, grupos + playoffs y liga + playoffs.
--
--   · matches.stage        → fase del partido (fase_regular / octavos / cuartos /
--                            semifinal / final). Los torneos viejos quedan en
--                            'fase_regular' por el default: no se rompe nada.
--   · matches.group_name   → letra del grupo ('A', 'B'…) en formato grupos.
--   · matches.stage_order  → posición del partido dentro de su llave, define
--                            qué ganadores se cruzan en la siguiente ronda.
--   · competitions.playoff_qualifiers → cuántos equipos clasifican al playoff.
--   · competitions.groups_count       → cantidad de grupos (formato grupos).
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================================

alter table public.matches
  add column if not exists stage text not null default 'fase_regular',
  add column if not exists group_name text,
  add column if not exists stage_order int;

-- La constraint es nueva; se crea una sola vez.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_stage_check'
  ) then
    alter table public.matches
      add constraint matches_stage_check
      check (stage in ('fase_regular', 'octavos', 'cuartos', 'semifinal', 'final'));
  end if;
end $$;

alter table public.competitions
  add column if not exists playoff_qualifiers int not null default 4,
  add column if not exists groups_count int not null default 2;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'competitions_playoff_qualifiers_check'
  ) then
    alter table public.competitions
      add constraint competitions_playoff_qualifiers_check
      check (playoff_qualifiers in (2, 4, 8));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'competitions_groups_count_check'
  ) then
    alter table public.competitions
      add constraint competitions_groups_count_check
      check (groups_count in (2, 4));
  end if;
end $$;
