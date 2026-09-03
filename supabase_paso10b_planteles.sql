-- ============================================================================
-- PLATAFORMA LFS — PASO 10B: PLANTELES POR CATEGORÍA
-- ----------------------------------------------------------------------------
-- Nuevo flujo del plantel:
--   1. Primero el club CREA sus planteles (uno por categoría: "Primera",
--      "Sub-16", etc.). Sin plantel creado, no se puede inscribir jugadores
--      en esa categoría.
--   2. Después inscribe jugadores DENTRO de cada plantel.
-- Este script crea la tabla club_planteles con sus permisos (RLS) y
-- precarga planteles para los jugadores que ya estaban inscriptos.
-- Es idempotente: se puede ejecutar más de una vez sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABLA club_planteles — un plantel = un club + una categoría
-- ---------------------------------------------------------------------------
create table if not exists public.club_planteles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (club_id, category_id)
);

alter table public.club_planteles enable row level security;

-- Lectura: la liga ve todos; el club ve los suyos
drop policy if exists "club_planteles: lectura admin o su club" on public.club_planteles;
create policy "club_planteles: lectura admin o su club"
  on public.club_planteles for select to authenticated
  using (public.is_admin() or club_id = public.mi_club_id());

-- Crear: la liga en cualquier club; el club solo en el suyo
drop policy if exists "club_planteles: crear admin o su club" on public.club_planteles;
create policy "club_planteles: crear admin o su club"
  on public.club_planteles for insert to authenticated
  with check (public.is_admin() or club_id = public.mi_club_id());

-- Eliminar: la liga en cualquier club; el club solo el suyo
-- (la app además exige que el plantel esté vacío)
drop policy if exists "club_planteles: eliminar admin o su club" on public.club_planteles;
create policy "club_planteles: eliminar admin o su club"
  on public.club_planteles for delete to authenticated
  using (public.is_admin() or club_id = public.mi_club_id());

-- ---------------------------------------------------------------------------
-- 2. PRECARGA: planteles para los jugadores que ya estaban inscriptos
--    (así nadie queda "sin plantel" por datos viejos)
-- ---------------------------------------------------------------------------
insert into public.club_planteles (club_id, category_id)
select distinct pc.club_id, pc.category_id
from public.player_categories pc
on conflict (club_id, category_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. DOCUMENTOS DE INSCRIPCIÓN — el club sube los 4 requisitos a SU carpeta
--    del bucket privado "documentos-jugadores" (path: {club_id}/...).
--    (La liga conserva sus permisos de admin, que ya existen desde el Paso 3)
-- ---------------------------------------------------------------------------
drop policy if exists "Club sube documentos de su carpeta" on storage.objects;
create policy "Club sube documentos de su carpeta"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'documentos-jugadores'
  and (storage.foldername(name))[1] = public.mi_club_id()::text
);

drop policy if exists "Club lee documentos de su carpeta" on storage.objects;
create policy "Club lee documentos de su carpeta"
on storage.objects for select to authenticated
using (
  bucket_id = 'documentos-jugadores'
  and (storage.foldername(name))[1] = public.mi_club_id()::text
);

drop policy if exists "Club reemplaza documentos de su carpeta" on storage.objects;
create policy "Club reemplaza documentos de su carpeta"
on storage.objects for update to authenticated
using (
  bucket_id = 'documentos-jugadores'
  and (storage.foldername(name))[1] = public.mi_club_id()::text
)
with check (
  bucket_id = 'documentos-jugadores'
  and (storage.foldername(name))[1] = public.mi_club_id()::text
);

-- ---------------------------------------------------------------------------
-- 4. club_actualizar_jugador EXTENDIDA — además de fecha de nacimiento y
--    foto, ahora puede FUSIONAR documentos en la ficha (p_documents jsonb).
--    Misma seguridad: solo la liga o el club dueño actual del jugador.
-- ---------------------------------------------------------------------------
drop function if exists public.club_actualizar_jugador(uuid, date, text);

create or replace function public.club_actualizar_jugador(
  p_player_id uuid,
  p_fecha_nacimiento date default null,
  p_foto_path text default null,
  p_documents jsonb default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_es_duenio boolean;
begin
  -- ¿La liga o el club dueño actual del jugador?
  select public.is_admin() or exists (
    select 1
    from public.player_categories pc
    where pc.player_id = p_player_id
      and pc.club_id = public.mi_club_id()
  ) into v_es_duenio;

  -- También puede ser un ALTA nueva: el jugador todavía no tiene vínculos,
  -- y lo está inscribiendo el propio club (rol club) o la liga.
  if not v_es_duenio then
    select public.is_admin() or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'club')
      and not exists (select 1 from public.player_categories pc where pc.player_id = p_player_id)
    ) into v_es_duenio;
  end if;

  if not v_es_duenio then
    return '⛔ No tenés permiso para modificar este jugador.';
  end if;

  update public.players
  set fecha_nacimiento = coalesce(p_fecha_nacimiento, fecha_nacimiento),
      foto_path = coalesce(p_foto_path, foto_path),
      documents = case
        when p_documents is null then documents
        else coalesce(documents, '{}'::jsonb) || p_documents
      end
  where id = p_player_id;

  if not found then
    return '⛔ El jugador no existe.';
  end if;

  return 'OK';
end;
$$;

-- ============================================================================
-- VERIFICACIÓN FINAL — comparar con la guía:
--   "tabla club_planteles: 1 de 1"
--   "policies de planteles: 3 de 3"
--   "policies documentos del club: 3 de 3"
--   "función club_actualizar_jugador: 4 parámetros"
--   "planteles precargados: N" (N = cuántos se crearon con datos viejos;
--    si no había jugadores, 0 está perfecto)
-- ============================================================================
select 'tabla club_planteles' as chequeo,
       count(*)::text || ' de 1' as resultado
from information_schema.tables
where table_schema = 'public' and table_name = 'club_planteles'

union all

select 'policies de planteles',
       count(*)::text || ' de 3'
from pg_policies
where schemaname = 'public' and tablename = 'club_planteles'

union all

select 'policies documentos del club',
       count(*)::text || ' de 3'
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in (
    'Club sube documentos de su carpeta',
    'Club lee documentos de su carpeta',
    'Club reemplaza documentos de su carpeta'
  )

union all

select 'función club_actualizar_jugador',
       count(*)::text || ' de 1 con 4 parámetros'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'club_actualizar_jugador'
  and p.pronargs = 4

union all

select 'planteles precargados',
       count(*)::text
from public.club_planteles;
