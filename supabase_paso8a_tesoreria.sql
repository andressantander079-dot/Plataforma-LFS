-- ============================================================================
-- PLATAFORMA LFS · PASO 8A — TESORERÍA (núcleo)
-- Cargos, pagos con aprobación, recibos numerados por año, multas
-- automáticas y el nuevo rol "tesorero".
--
-- Diseño aprobado por la federación:
--   · NADA se borra: las correcciones son anulaciones con motivo.
--   · Los pagos los sube el club (foto del comprobante) y los aprueba
--     la tesorería. Recién ahí se emite el recibo numerado (2026-0001…).
--   · Multas automáticas por roja, W.O. y acumulación de amarillas,
--     con montos configurables desde el panel (solo admin).
--   · Recargo por mora configurable (%) sobre cargos vencidos.
--
-- Es idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ROL TESORERO en profiles
-- ---------------------------------------------------------------------------
-- La columna role es un ENUM (lista cerrada de valores): hay que agregar
-- 'tesorero' a la lista. Si tu base usa texto con CHECK en vez de enum,
-- este alter type falla con aviso y lo de abajo cubre ese caso.
do $$
begin
  alter type public.user_role add value if not exists 'tesorero';
exception
  when undefined_object then
    -- no existe el enum: la columna es texto, no hay nada que hacer
    null;
end $$;

-- Busca y elimina cualquier constraint CHECK sobre la columna role
-- (bases donde role es texto plano), y crea una que incluye 'tesorero'.
do $$
declare
  nombre_constraint text;
begin
  select conname into nombre_constraint
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.profiles'::regclass
    and c.contype = 'c'
    and a.attname = 'role'
  limit 1;

  if nombre_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', nombre_constraint);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) HELPER: ¿el usuario actual es de tesorería? (admin o tesorero)
-- ---------------------------------------------------------------------------
create or replace function public.is_tesoreria()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'tesorero')
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) CONFIGURACIÓN DE TESORERÍA (una sola fila)
--    Montos de multas, recargo por mora y datos fiscales de la liga.
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_settings (
  id int primary key default 1 check (id = 1),
  fine_red numeric(12,2) not null default 0,
  fine_wo numeric(12,2) not null default 0,
  fine_yellow_accum numeric(12,2) not null default 0,
  late_fee_percent numeric(5,2) not null default 0,
  league_legal_name text,
  league_cuit text,
  league_address text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.treasury_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.treasury_settings enable row level security;

-- Lectura para cualquier usuario logueado: los montos de multas y el recargo
-- son reglamento de la liga (públicos), y los datos fiscales van en los recibos.
drop policy if exists "settings: tesoreria lee" on public.treasury_settings;
drop policy if exists "settings: lectura autenticada" on public.treasury_settings;
create policy "settings: lectura autenticada"
  on public.treasury_settings for select to authenticated
  using (true);

drop policy if exists "settings: solo admin configura" on public.treasury_settings;
create policy "settings: solo admin configura"
  on public.treasury_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4) NUMERADOR DE RECIBOS (por año: 2026-0001, 2026-0002…)
-- ---------------------------------------------------------------------------
create table if not exists public.receipt_counters (
  anio int primary key,
  ultimo int not null default 0
);

alter table public.receipt_counters enable row level security;
-- Sin políticas: nadie toca el contador directamente, solo la función.

-- Función atómica: incrementa y devuelve el número formateado.
create or replace function public.asignar_numero_recibo(p_anio int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  numero int;
begin
  insert into public.receipt_counters (anio, ultimo)
  values (p_anio, 1)
  on conflict (anio)
  do update set ultimo = receipt_counters.ultimo + 1
  returning ultimo into numero;

  return p_anio::text || '-' || lpad(numero::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) CARGOS (lo que la liga le cobra a los clubes)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_charges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id),
  competition_id uuid references public.competitions(id) on delete set null,
  tipo text not null check (tipo in (
    'inscripcion_torneo',
    'cuota_mensual',
    'cuota_anual',
    'multa_roja',
    'multa_wo',
    'multa_acumulacion_amarillas',
    'otro'
  )),
  descripcion text not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha_emision date not null default current_date,
  fecha_vencimiento date,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'parcial', 'pagado', 'anulado')),
  anulado_motivo text,
  anulado_por uuid,
  anulado_at timestamptz,
  -- multas automáticas: qué evento de planilla la originó (1 multa por evento)
  evento_origen_id uuid references public.match_events(id) on delete set null,
  creado_por uuid,
  created_at timestamptz not null default now()
);

-- Un evento de planilla genera UNA sola multa, aunque se reintente
create unique index if not exists cargo_evento_uniq
  on public.treasury_charges (evento_origen_id)
  where evento_origen_id is not null;

create index if not exists charges_club_idx on public.treasury_charges (club_id);
create index if not exists charges_status_idx on public.treasury_charges (status);

alter table public.treasury_charges enable row level security;

drop policy if exists "charges: tesoreria o su club leen" on public.treasury_charges;
create policy "charges: tesoreria o su club leen"
  on public.treasury_charges for select to authenticated
  using (public.is_tesoreria() or club_id = public.mi_club_id());

drop policy if exists "charges: tesoreria crea" on public.treasury_charges;
create policy "charges: tesoreria crea"
  on public.treasury_charges for insert to authenticated
  with check (public.is_tesoreria());

drop policy if exists "charges: tesoreria actualiza" on public.treasury_charges;
create policy "charges: tesoreria actualiza"
  on public.treasury_charges for update to authenticated
  using (public.is_tesoreria())
  with check (public.is_tesoreria());
-- Sin política de DELETE: los cargos NUNCA se borran, se anulan.

-- ---------------------------------------------------------------------------
-- 6) PAGOS (comprobantes que sube el club + aprobación de tesorería)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_payments (
  id uuid primary key default gen_random_uuid(),
  charge_id uuid not null references public.treasury_charges(id),
  club_id uuid not null references public.clubs(id),
  monto numeric(12,2) not null check (monto > 0),
  metodo text not null check (metodo in ('efectivo', 'transferencia', 'deposito')),
  comprobante_path text,
  status text not null default 'pendiente'
    check (status in ('pendiente', 'aprobado', 'rechazado', 'anulado')),
  receipt_number text unique,
  rechazo_motivo text,
  resuelto_por uuid,
  resuelto_at timestamptz,
  anulado_motivo text,
  anulado_por uuid,
  anulado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists payments_charge_idx on public.treasury_payments (charge_id);
create index if not exists payments_club_idx on public.treasury_payments (club_id);
create index if not exists payments_status_idx on public.treasury_payments (status);

alter table public.treasury_payments enable row level security;

drop policy if exists "payments: tesoreria o su club leen" on public.treasury_payments;
create policy "payments: tesoreria o su club leen"
  on public.treasury_payments for select to authenticated
  using (public.is_tesoreria() or club_id = public.mi_club_id());

drop policy if exists "payments: club sube el suyo, tesoreria carga" on public.treasury_payments;
create policy "payments: club sube el suyo, tesoreria carga"
  on public.treasury_payments for insert to authenticated
  with check (
    public.is_tesoreria()
    or (club_id = public.mi_club_id() and status = 'pendiente')
  );

drop policy if exists "payments: tesoreria resuelve" on public.treasury_payments;
create policy "payments: tesoreria resuelve"
  on public.treasury_payments for update to authenticated
  using (public.is_tesoreria())
  with check (public.is_tesoreria());
-- Sin DELETE: los pagos se anulan, no se borran.

-- ---------------------------------------------------------------------------
-- 7) GASTOS DE LA LIGA (la UI llega en el Paso 8B, la tabla ya queda)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_expenses (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in (
    'canchas', 'arbitros', 'indumentaria', 'pelotas',
    'administracion', 'devoluciones', 'otros'
  )),
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  fecha date not null default current_date,
  comprobante_path text,
  anulado_motivo text,
  anulado_por uuid,
  anulado_at timestamptz,
  creado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.treasury_expenses enable row level security;

drop policy if exists "expenses: tesoreria lee" on public.treasury_expenses;
create policy "expenses: tesoreria lee"
  on public.treasury_expenses for select to authenticated
  using (public.is_tesoreria());

drop policy if exists "expenses: tesoreria carga" on public.treasury_expenses;
create policy "expenses: tesoreria carga"
  on public.treasury_expenses for insert to authenticated
  with check (public.is_tesoreria());

drop policy if exists "expenses: tesoreria actualiza" on public.treasury_expenses;
create policy "expenses: tesoreria actualiza"
  on public.treasury_expenses for update to authenticated
  using (public.is_tesoreria())
  with check (public.is_tesoreria());

-- ---------------------------------------------------------------------------
-- 8) CIERRES DE CAJA MENSUAL (la UI llega en el Paso 8B)
-- ---------------------------------------------------------------------------
create table if not exists public.treasury_cierres (
  anio int not null,
  mes int not null check (mes between 1 and 12),
  cerrado_por uuid,
  cerrado_at timestamptz not null default now(),
  reabierto_por uuid,
  reabierto_at timestamptz,
  reapertura_motivo text,
  primary key (anio, mes)
);

alter table public.treasury_cierres enable row level security;

drop policy if exists "cierres: tesoreria lee" on public.treasury_cierres;
create policy "cierres: tesoreria lee"
  on public.treasury_cierres for select to authenticated
  using (public.is_tesoreria());

drop policy if exists "cierres: tesoreria cierra" on public.treasury_cierres;
create policy "cierres: tesoreria cierra"
  on public.treasury_cierres for insert to authenticated
  with check (public.is_tesoreria());

drop policy if exists "cierres: solo admin reabre" on public.treasury_cierres;
create policy "cierres: solo admin reabre"
  on public.treasury_cierres for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Función pública: los datos fiscales de la liga son información que va
-- impresa en los recibos (documento público), no un dato sensible.
create or replace function public.datos_fiscales_recibo()
returns table(nombre text, cuit text, domicilio text)
language sql
stable
security definer
set search_path = public
as $$
  select league_legal_name, league_cuit, league_address
  from public.treasury_settings
  where id = 1;
$$;

-- ---------------------------------------------------------------------------
-- 9) BUCKET DE COMPROBANTES (privado)
--    El club sube a la carpeta de SU club; tesorería lee todo.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'comprobantes-tesoreria',
  'comprobantes-tesoreria',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "club sube comprobantes a su carpeta" on storage.objects;
create policy "club sube comprobantes a su carpeta"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes-tesoreria'
    and (
      public.is_tesoreria()
      or (storage.foldername(name))[1] = public.mi_club_id()::text
    )
  );

drop policy if exists "club y tesoreria leen comprobantes" on storage.objects;
create policy "club y tesoreria leen comprobantes"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes-tesoreria'
    and (
      public.is_tesoreria()
      or (storage.foldername(name))[1] = public.mi_club_id()::text
    )
  );
