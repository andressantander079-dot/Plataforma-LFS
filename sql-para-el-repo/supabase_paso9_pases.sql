-- ============================================================================
-- PLATAFORMA LFS · PASO 9 — PASES Y TRANSFERENCIAS (módulo real)
-- Convierte las maquetas de Trámites en el circuito real de pases:
--
--   1_INIT_CLUB_A      El club destino (o la liga) inicia la solicitud
--   2_FVF_REVIEW       La liga revisa (queda en el mismo paso lógico)
--   4_CLUB_B_DECISION  El club de origen dictamina (aprueba o rechaza)
--   5_PLAYER_SIGNATURE El jugador firma online con su DNI (link de 72 hs)
--   6_FINAL_AUDIT      Auditoría final de la liga
--   7_COMPLETED        Pase efectivo: el jugador cambia de club y se
--                      genera el cargo de derecho de pase + comprobante
--   8_RECHAZADO / 9_CANCELADO  (nuevos) estados terminales con motivo
--
-- Diseño aprobado por la federación:
--   · Ventanas de mercado configurables; el admin puede excepciones.
--   · La deuda NO bloquea pases; las suspensiones viajan con el jugador.
--   · El pase mueve TODAS las categorías del jugador.
--   · Avisos automáticos por la mensajería interna.
--   · NADA de esto toca Comet/AFA: hay un campo opcional para anotar
--     el número federativo si la liga también lo carga allá.
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ENUM DE ESTADOS: agregar RECHAZADO y CANCELADO
--    (si el tipo no existe todavía, se crea completo)
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transfer_status') then
    create type public.transfer_status as enum (
      '1_INIT_CLUB_A', '2_FVF_REVIEW', '3_NOTIFY_CLUB_B', '4_CLUB_B_DECISION',
      '5_PLAYER_SIGNATURE', '6_FINAL_AUDIT', '7_COMPLETED',
      '8_RECHAZADO', '9_CANCELADO'
    );
  else
    alter type public.transfer_status add value if not exists '8_RECHAZADO';
    alter type public.transfer_status add value if not exists '9_CANCELADO';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2) TABLA DE PASES (ya existe en el esquema base; create por las dudas)
-- ---------------------------------------------------------------------------
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  from_club_id uuid references public.clubs(id) on delete set null,
  to_club_id uuid references public.clubs(id) on delete set null,
  status public.transfer_status not null default '1_INIT_CLUB_A',
  approved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Número de comprobante del pase (PASE-2026-0001…) y referencia AFA opcional
alter table public.transfers add column if not exists numero_pase text unique;
alter table public.transfers add column if not exists nro_federativo text;

create index if not exists transfers_player_idx on public.transfers (player_id);
create index if not exists transfers_status_idx on public.transfers (status);
create index if not exists transfers_clubes_idx
  on public.transfers (from_club_id, to_club_id);

-- Un jugador NO puede tener dos pases en curso a la vez
create unique index if not exists transfer_activo_por_jugador_uniq
  on public.transfers (player_id)
  where status not in ('7_COMPLETED', '8_RECHAZADO', '9_CANCELADO');

alter table public.transfers enable row level security;

drop policy if exists "transfers: admin y clubes involucrados leen" on public.transfers;
create policy "transfers: admin y clubes involucrados leen"
  on public.transfers for select to authenticated
  using (
    public.is_admin()
    or from_club_id = public.mi_club_id()
    or to_club_id = public.mi_club_id()
  );

drop policy if exists "transfers: club destino inicia, admin todo" on public.transfers;
create policy "transfers: club destino inicia, admin todo"
  on public.transfers for insert to authenticated
  with check (
    public.is_admin()
    or (to_club_id = public.mi_club_id() and status = '1_INIT_CLUB_A')
  );

-- El club de ORIGEN solo puede dictaminar (cuando le toca); el club destino
-- solo puede retirar su solicitud recién iniciada; el admin puede todo.
-- Las transiciones exactas las validan las acciones del servidor.
drop policy if exists "transfers: admin actualiza todo" on public.transfers;
create policy "transfers: admin actualiza todo"
  on public.transfers for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "transfers: club origen dictamina" on public.transfers;
create policy "transfers: club origen dictamina"
  on public.transfers for update to authenticated
  using (from_club_id = public.mi_club_id() and status = '4_CLUB_B_DECISION')
  with check (from_club_id = public.mi_club_id());

drop policy if exists "transfers: club destino retira" on public.transfers;
create policy "transfers: club destino retira"
  on public.transfers for update to authenticated
  using (to_club_id = public.mi_club_id() and status = '1_INIT_CLUB_A')
  with check (to_club_id = public.mi_club_id());
-- Sin DELETE: los pases se rechazan o cancelan, nunca se borran.

-- ---------------------------------------------------------------------------
-- 3) VENTANAS DE MERCADO (mercado de pases configurable)
-- ---------------------------------------------------------------------------
create table if not exists public.transfer_windows (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  fecha_desde date not null,
  fecha_hasta date not null,
  creado_por uuid,
  created_at timestamptz not null default now(),
  check (fecha_hasta >= fecha_desde)
);

alter table public.transfer_windows enable row level security;

-- Todos pueden CONSULTAR si hay mercado abierto (lo necesita el panel del club)
drop policy if exists "windows: lectura autenticada" on public.transfer_windows;
create policy "windows: lectura autenticada"
  on public.transfer_windows for select to authenticated
  using (true);

drop policy if exists "windows: admin gestiona" on public.transfer_windows;
create policy "windows: admin gestiona"
  on public.transfer_windows for insert to authenticated
  with check (public.is_admin());

drop policy if exists "windows: admin elimina" on public.transfer_windows;
create policy "windows: admin elimina"
  on public.transfer_windows for delete to authenticated
  using (public.is_admin());

-- ¿Hay una ventana abierta hoy?
create or replace function public.hay_ventana_pases()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transfer_windows
    where current_date between fecha_desde and fecha_hasta
  );
$$;

-- ---------------------------------------------------------------------------
-- 4) NUMERADOR DE COMPROBANTES DE PASE (PASE-2026-0001…)
-- ---------------------------------------------------------------------------
create table if not exists public.pase_counters (
  anio int primary key,
  ultimo int not null default 0
);

alter table public.pase_counters enable row level security;
-- Sin políticas: solo la función toca el contador.

create or replace function public.asignar_numero_pase(p_anio int)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  numero int;
begin
  insert into public.pase_counters (anio, ultimo)
  values (p_anio, 1)
  on conflict (anio)
  do update set ultimo = pase_counters.ultimo + 1
  returning ultimo into numero;

  return 'PASE-' || p_anio::text || '-' || lpad(numero::text, 4, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- 5) DOCUMENTOS ADJUNTOS DEL PASE (opcionales: carta de liberación, DNI…)
-- ---------------------------------------------------------------------------
create table if not exists public.transfer_documents (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.transfers(id) on delete cascade,
  path text not null,
  nombre text not null,
  subido_por uuid,
  created_at timestamptz not null default now()
);

alter table public.transfer_documents enable row level security;

drop policy if exists "pase_docs: admin y clubes involucrados leen" on public.transfer_documents;
create policy "pase_docs: admin y clubes involucrados leen"
  on public.transfer_documents for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.transfers t
      where t.id = transfer_id
        and (t.from_club_id = public.mi_club_id() or t.to_club_id = public.mi_club_id())
    )
  );

drop policy if exists "pase_docs: admin y clubes involucrados suben" on public.transfer_documents;
create policy "pase_docs: admin y clubes involucrados suben"
  on public.transfer_documents for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.transfers t
      where t.id = transfer_id
        and (t.from_club_id = public.mi_club_id() or t.to_club_id = public.mi_club_id())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-pases',
  'documentos-pases',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Carpeta por pase: documentos-pases/<transfer_id>/<archivo>
drop policy if exists "pases: admin y clubes involucrados suben" on storage.objects;
create policy "pases: admin y clubes involucrados suben"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documentos-pases'
    and (
      public.is_admin()
      or exists (
        select 1 from public.transfers t
        where t.id::text = (storage.foldername(name))[1]
          and (t.from_club_id = public.mi_club_id() or t.to_club_id = public.mi_club_id())
      )
    )
  );

drop policy if exists "pases: admin y clubes involucrados leen" on storage.objects;
create policy "pases: admin y clubes involucrados leen"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos-pases'
    and (
      public.is_admin()
      or exists (
        select 1 from public.transfers t
        where t.id::text = (storage.foldername(name))[1]
          and (t.from_club_id = public.mi_club_id() or t.to_club_id = public.mi_club_id())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 6) BÚSQUEDA DE JUGADOR POR DNI (para iniciar el pase)
--    El club solo ve su propio plantel por RLS; esta función devuelve lo
--    MÍNIMO necesario para pedir un pase (nombre, DNI y club actual).
-- ---------------------------------------------------------------------------
create or replace function public.buscar_jugador_pase(p_dni text)
returns table(
  player_id uuid,
  nombre text,
  apellido text,
  dni text,
  club_actual text,
  club_actual_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.first_name,
    p.last_name,
    p.dni,
    (
      select string_agg(distinct c.name, ' · ')
      from public.player_categories pc
      join public.clubs c on c.id = pc.club_id
      where pc.player_id = p.id
    ) as club_actual,
    (
      select pc.club_id
      from public.player_categories pc
      where pc.player_id = p.id
      order by pc.created_at desc
      limit 1
    ) as club_actual_id
  from public.players p
  where p.dni = p_dni
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 7) FIRMA ONLINE DEL JUGADOR (público, con token + DNI, válido 72 hs)
--    Son funciones SECURITY DEFINER porque el jugador NO tiene usuario:
--    el token secreto del link es la llave. Sin login.
-- ---------------------------------------------------------------------------

-- Datos mínimos para mostrar la pantalla de firma
create or replace function public.obtener_pase_firma(p_token text)
returns table(
  transfer_id uuid,
  jugador text,
  club_origen text,
  club_destino text,
  aprobado_en timestamptz,
  habilitada boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    p.last_name || ', ' || p.first_name,
    coalesce(co.name, 'Jugador libre'),
    cd.name,
    t.approved_at,
    (
      t.status = '5_PLAYER_SIGNATURE'
      and t.approved_at is not null
      and now() <= t.approved_at + interval '72 hours'
    ) as habilitada
  from public.transfers t
  join public.players p on p.id = t.player_id
  left join public.clubs co on co.id = t.from_club_id
  join public.clubs cd on cd.id = t.to_club_id
  where t.metadata ->> 'firma_token' = p_token
    and t.status in ('5_PLAYER_SIGNATURE', '6_FINAL_AUDIT', '7_COMPLETED')
  limit 1;
$$;

-- Firmar: valida token + DNI + ventana de 72 hs y avanza a auditoría final
create or replace function public.firmar_pase(p_token text, p_dni text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pase record;
  jugador record;
begin
  select t.id, t.player_id, t.status, t.approved_at
    into pase
    from public.transfers t
   where t.metadata ->> 'firma_token' = p_token
   limit 1;

  if pase is null then
    return 'El link no es válido. Pedile el link nuevo a tu club.';
  end if;
  if pase.status = '6_FINAL_AUDIT' or pase.status = '7_COMPLETED' then
    return 'Este pase ya fue firmado. No hace falta hacer nada más.';
  end if;
  if pase.status <> '5_PLAYER_SIGNATURE' then
    return 'Este pase no está esperando la firma del jugador.';
  end if;
  if pase.approved_at is null or now() > pase.approved_at + interval '72 hours' then
    return 'El link venció (dura 72 hs). Pedile a la liga que genere uno nuevo.';
  end if;

  select p.dni into jugador from public.players p where p.id = pase.player_id;
  if jugador.dni <> p_dni then
    return 'El DNI no coincide con el jugador del pase. Revisalo y probá de nuevo.';
  end if;

  update public.transfers
     set status = '6_FINAL_AUDIT',
         metadata = metadata || jsonb_build_object(
           'firmado_at', now(),
           'firma_token', null
         )
   where id = pase.id;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) BAJA DE JUGADOR (el club lo deja libre, queda el registro)
-- ---------------------------------------------------------------------------
create table if not exists public.player_bajas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  club_id uuid references public.clubs(id) on delete set null,
  motivo text,
  creado_por uuid,
  created_at timestamptz not null default now()
);

alter table public.player_bajas enable row level security;

drop policy if exists "bajas: admin y su club leen" on public.player_bajas;
create policy "bajas: admin y su club leen"
  on public.player_bajas for select to authenticated
  using (public.is_admin() or club_id = public.mi_club_id());
-- Sin INSERT/UPDATE/DELETE por API: la baja se hace SOLO por la función.

create or replace function public.dar_baja_jugador(p_player_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_pases_activos int;
begin
  -- ¿Quién llama? Admin o el club dueño actual del jugador
  if public.is_admin() then
    select pc.club_id into v_club
      from public.player_categories pc
     where pc.player_id = p_player_id
     order by pc.created_at desc
     limit 1;
  else
    v_club := public.mi_club_id();
    if not exists (
      select 1 from public.player_categories pc
      where pc.player_id = p_player_id and pc.club_id = v_club
    ) then
      return 'Ese jugador no pertenece a tu club.';
    end if;
  end if;

  if v_club is null then
    return 'El jugador no está en ningún club (ya está libre).';
  end if;

  -- No se puede dar de baja a alguien con un pase en curso
  select count(*) into v_pases_activos
    from public.transfers t
   where t.player_id = p_player_id
     and t.status not in ('7_COMPLETED', '8_RECHAZADO', '9_CANCELADO');
  if v_pases_activos > 0 then
    return 'El jugador tiene un pase en curso. Esperá a que termine o cancelalo.';
  end if;

  insert into public.player_bajas (player_id, club_id, motivo, creado_por)
  values (p_player_id, v_club, nullif(trim(p_motivo), ''), auth.uid());

  delete from public.player_categories
   where player_id = p_player_id and club_id = v_club;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) INTEGRACIÓN CON TESORERÍA: derecho de pase (cargo automático)
-- ---------------------------------------------------------------------------

-- Monto configurable del derecho de pase (0 = no cobra)
alter table public.treasury_settings
  add column if not exists transfer_fee numeric(12,2) not null default 0;

-- Nuevo tipo de cargo "derecho_pase": hay que rehacer el CHECK del campo tipo
do $$
declare
  nombre_constraint text;
begin
  select conname into nombre_constraint
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'public.treasury_charges'::regclass
    and c.contype = 'c'
    and a.attname = 'tipo'
  limit 1;

  if nombre_constraint is not null then
    execute format(
      'alter table public.treasury_charges drop constraint %I',
      nombre_constraint
    );
  end if;
end $$;

alter table public.treasury_charges
  add constraint treasury_charges_tipo_check check (tipo in (
    'inscripcion_torneo',
    'cuota_mensual',
    'cuota_anual',
    'multa_roja',
    'multa_wo',
    'multa_acumulacion_amarillas',
    'derecho_pase',
    'otro'
  ));

-- Vínculo cargo ↔ pase (un cargo de derecho de pase por pase)
alter table public.treasury_charges
  add column if not exists transfer_id uuid references public.transfers(id) on delete set null;

create unique index if not exists cargo_pase_uniq
  on public.treasury_charges (transfer_id)
  where transfer_id is not null;
