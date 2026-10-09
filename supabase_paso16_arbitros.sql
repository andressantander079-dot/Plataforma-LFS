-- ============================================================================
-- PLATAFORMA LFS · PASO 16 — MÓDULO ÁRBITRO REAL + DESIGNACIONES + COLEGIO
-- ============================================================================
-- Qué crea/ajusta (todo idempotente, se puede correr mil veces):
--   1. referee_levels: categorías arbitrales (A/B/C) con tarifa por partido.
--   2. referee_profiles: datos EXTRA del árbitro (nivel, estado, teléfono,
--      foto y firma digital). Los datos básicos siguen en profiles.
--   3. referee_unavailability: días que el árbitro NO puede dirigir.
--   4. referee_events: capacitaciones/congresos que carga la liga.
--   5. matches: modo y estado de la designación (+ referee2_id a futuro).
--   6. referee_payments: liquidaciones mensuales (vinculadas a tesorería).
--   7. RPCs seguros para que el árbitro edite SOLO lo suyo.
--   8. Bucket público perfiles-arbitros (foto + firma, carpeta = su id).
--   9. Realtime en las tablas del módulo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CATEGORÍAS ARBITRALES (nivel + tarifa por partido)
-- ---------------------------------------------------------------------------
create table if not exists public.referee_levels (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  orden int not null unique check (orden between 1 and 99),
  tarifa_partido numeric(12,2) not null default 0 check (tarifa_partido >= 0),
  created_at timestamptz not null default now()
);

insert into public.referee_levels (nombre, orden, tarifa_partido)
select v.nombre, v.orden, 0
from (values ('Categoría A', 1), ('Categoría B', 2), ('Categoría C', 3)) as v(nombre, orden)
where not exists (select 1 from public.referee_levels);

alter table public.referee_levels enable row level security;

drop policy if exists "niveles lectura usuarios" on public.referee_levels;
create policy "niveles lectura usuarios"
  on public.referee_levels for select to authenticated using (true);

drop policy if exists "niveles admin escribe" on public.referee_levels;
create policy "niveles admin escribe"
  on public.referee_levels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. PERFIL EXTENDIDO DEL ÁRBITRO (nivel y estado los fija SOLO la liga)
-- ---------------------------------------------------------------------------
create table if not exists public.referee_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  level_id uuid references public.referee_levels(id) on delete set null,
  estado text not null default 'activo' check (estado in ('activo', 'suspendido')),
  telefono text,
  foto_path text,
  firma_path text,
  tarifa_override numeric(12,2) check (tarifa_override is null or tarifa_override >= 0),
  updated_at timestamptz not null default now()
);

alter table public.referee_profiles enable row level security;

drop policy if exists "refperfil lectura admin y propio" on public.referee_profiles;
create policy "refperfil lectura admin y propio"
  on public.referee_profiles for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "refperfil admin gestiona" on public.referee_profiles;
create policy "refperfil admin gestiona"
  on public.referee_profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- El árbitro edita SOLO teléfono/foto/firma vía RPC seguro (abajo).

-- ---------------------------------------------------------------------------
-- 3. DISPONIBILIDAD: días que el árbitro NO puede dirigir
-- ---------------------------------------------------------------------------
create table if not exists public.referee_unavailability (
  id uuid primary key default gen_random_uuid(),
  referee_id uuid not null references public.profiles(id) on delete cascade,
  desde date not null,
  hasta date not null check (hasta >= desde),
  motivo text,
  created_at timestamptz not null default now()
);

create index if not exists refunavail_ref_idx on public.referee_unavailability (referee_id, desde);

alter table public.referee_unavailability enable row level security;

drop policy if exists "unavail lectura admin y propio" on public.referee_unavailability;
create policy "unavail lectura admin y propio"
  on public.referee_unavailability for select to authenticated
  using (public.is_admin() or referee_id = auth.uid());

drop policy if exists "unavail arbitro gestiona lo suyo" on public.referee_unavailability;
create policy "unavail arbitro gestiona lo suyo"
  on public.referee_unavailability for all to authenticated
  using (referee_id = auth.uid()) with check (referee_id = auth.uid());

drop policy if exists "unavail admin borra" on public.referee_unavailability;
create policy "unavail admin borra"
  on public.referee_unavailability for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. EVENTOS ARBITRALES (capacitaciones, congresos — los carga la liga)
-- ---------------------------------------------------------------------------
create table if not exists public.referee_events (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  hora text,
  titulo text not null,
  descripcion text,
  obligatorio boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.referee_events enable row level security;

drop policy if exists "refeventos lectura usuarios" on public.referee_events;
create policy "refeventos lectura usuarios"
  on public.referee_events for select to authenticated using (true);

drop policy if exists "refeventos admin gestiona" on public.referee_events;
create policy "refeventos admin gestiona"
  on public.referee_events for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. DESIGNACIÓN EN MATCHES (modo + estado; referee2 queda para el futuro)
-- ---------------------------------------------------------------------------
alter table public.matches add column if not exists referee2_id uuid references public.profiles(id) on delete set null;
alter table public.matches add column if not exists designacion_modo text check (designacion_modo in ('directa', 'propuesta'));
alter table public.matches add column if not exists designacion_estado text check (designacion_estado in ('pendiente', 'aceptada', 'rechazada'));
alter table public.matches add column if not exists designacion_rechazo_motivo text;
alter table public.matches add column if not exists designado_at timestamptz;
alter table public.matches add column if not exists designado_por uuid references public.profiles(id);

-- ---------------------------------------------------------------------------
-- 6. LIQUIDACIONES MENSUALES DE HONORARIOS (vinculadas a tesorería)
-- ---------------------------------------------------------------------------
create table if not exists public.referee_payments (
  id uuid primary key default gen_random_uuid(),
  referee_id uuid not null references public.profiles(id) on delete cascade,
  periodo char(7) not null check (periodo ~ '^[0-9]{4}-[0-9]{2}$'), -- 'YYYY-MM'
  partidos int not null default 0 check (partidos >= 0),
  tarifa numeric(12,2) not null default 0 check (tarifa >= 0),
  monto numeric(12,2) not null default 0 check (monto >= 0),
  status text not null default 'pendiente' check (status in ('pendiente', 'pagado')),
  treasury_expense_id uuid references public.treasury_expenses(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (referee_id, periodo)
);

alter table public.referee_payments enable row level security;

drop policy if exists "refpagos lectura admin y propio" on public.referee_payments;
create policy "refpagos lectura admin y propio"
  on public.referee_payments for select to authenticated
  using (public.is_admin() or referee_id = auth.uid());

drop policy if exists "refpagos admin gestiona" on public.referee_payments;
create policy "refpagos admin gestiona"
  on public.referee_payments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. RPCs SEGUROS (el árbitro toca SOLO lo suyo, sin abrir policies de más)
-- ---------------------------------------------------------------------------

-- 7a. El árbitro actualiza su teléfono/foto/firma (nunca nivel ni estado)
create or replace function public.arbitro_actualizar_perfil(
  p_telefono text,
  p_foto_path text,
  p_firma_path text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol text;
begin
  select role into v_rol from public.profiles where id = auth.uid();
  if v_rol is null or v_rol not in ('arbitro', 'arbitro_asistente') then
    raise exception 'Solo los árbitros pueden editar este perfil.';
  end if;

  insert into public.referee_profiles (user_id, telefono, foto_path, firma_path, updated_at)
  values (auth.uid(), p_telefono, p_foto_path, p_firma_path, now())
  on conflict (user_id) do update
    set telefono = excluded.telefono,
        foto_path = coalesce(excluded.foto_path, public.referee_profiles.foto_path),
        firma_path = coalesce(excluded.firma_path, public.referee_profiles.firma_path),
        updated_at = now();
end;
$$;

-- 7b. El árbitro acepta o rechaza una designación en modo "propuesta"
create or replace function public.arbitro_responder_designacion(
  p_match_id uuid,
  p_aceptar boolean,
  p_motivo text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    raise exception 'El partido no existe.';
  end if;
  if v_match.referee_id is distinct from auth.uid() then
    raise exception 'Este partido no está designado a tu nombre.';
  end if;
  if v_match.designacion_modo is distinct from 'propuesta'
     or v_match.designacion_estado is distinct from 'pendiente' then
    raise exception 'Esta designación no está esperando tu respuesta.';
  end if;

  if p_aceptar then
    update public.matches
      set designacion_estado = 'aceptada',
          designacion_rechazo_motivo = null
      where id = p_match_id;
  else
    -- Al rechazar, el partido queda SIN árbitro para que la liga reasigne
    update public.matches
      set designacion_estado = 'rechazada',
          designacion_rechazo_motivo = nullif(trim(coalesce(p_motivo, '')), ''),
          referee_id = null
      where id = p_match_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. STORAGE: bucket público perfiles-arbitros (foto + firma; carpeta = su id)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'perfiles-arbitros', 'perfiles-arbitros', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "perfiles-arbitros lectura publica" on storage.objects;
create policy "perfiles-arbitros lectura publica"
  on storage.objects for select
  using (bucket_id = 'perfiles-arbitros');

drop policy if exists "perfiles-arbitros sube su carpeta" on storage.objects;
create policy "perfiles-arbitros sube su carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'perfiles-arbitros'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "perfiles-arbitros actualiza su carpeta" on storage.objects;
create policy "perfiles-arbitros actualiza su carpeta"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'perfiles-arbitros'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "perfiles-arbitros admin borra" on storage.objects;
create policy "perfiles-arbitros admin borra"
  on storage.objects for delete to authenticated
  using (bucket_id = 'perfiles-arbitros' and public.is_admin());

-- ---------------------------------------------------------------------------
-- 9. REALTIME en las tablas del módulo
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'referee_events') then
      alter publication supabase_realtime add table public.referee_events;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'referee_unavailability') then
      alter publication supabase_realtime add table public.referee_unavailability;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'referee_payments') then
      alter publication supabase_realtime add table public.referee_payments;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and tablename = 'referee_profiles') then
      alter publication supabase_realtime add table public.referee_profiles;
    end if;
  end if;
exception when others then
  raise notice 'Realtime opcional no aplicado: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- VERIFICACIÓN FINAL (comparar con la guía)
-- ---------------------------------------------------------------------------
select 'tablas del módulo árbitro' as chequeo, count(*)::int as encontradas, 4 as esperadas
from information_schema.tables
where table_schema = 'public'
  and table_name in ('referee_levels', 'referee_profiles', 'referee_unavailability',
                     'referee_events', 'referee_payments')
  and table_type = 'BASE TABLE';

select 'niveles arbitrales semilla', count(*)::int, 3
from public.referee_levels;

select 'columnas nuevas en matches', count(*)::int, 6
from information_schema.columns
where table_schema = 'public' and table_name = 'matches'
  and column_name in ('referee2_id', 'designacion_modo', 'designacion_estado',
                      'designacion_rechazo_motivo', 'designado_at', 'designado_por');

select 'RPCs del árbitro', count(*)::int, 2
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('arbitro_actualizar_perfil', 'arbitro_responder_designacion');

select 'tablas árbitro con realtime', count(*)::int, 4
from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('referee_events', 'referee_unavailability', 'referee_payments', 'referee_profiles');

select 'bucket perfiles-arbitros', count(*)::int, 1
from storage.buckets where id = 'perfiles-arbitros';
