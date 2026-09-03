-- ============================================================================
-- PLATAFORMA LFS · PASO 9B — PASES PREMIUM
-- Re trabajo completo del módulo de pases según las reglas de la federación:
--
--   JUGADORES
--   · Fecha de nacimiento OBLIGATORIA (define su categoría por año).
--   · Foto OBLIGATORIA (la sube el club desde su panel; la ven liga,
--     clubes y público). Sin foto se muestra un ícono 3D por defecto.
--
--   CATEGORÍAS POR AÑO DE NACIMIENTO
--   · Cada categoría tiene rango anio_desde / anio_hasta (editable cada
--     año por la liga desde Trámites → Configuración).
--   · Al inscribir, si el año de nacimiento no coincide con la categoría
--     elegida, la inscripción se BLOQUEA sugiriendo la categoría correcta.
--   · Un jugador tiene UNA categoría base (la de su año) y puede jugar
--     TAMBIÉN en categorías mayores (jugar "para arriba").
--
--   PASES
--   · Dos tipos: DEFINITIVO y PRÉSTAMO (con fecha de retorno obligatoria
--     y futura; si es préstamo de torneo, se anota el torneo).
--   · El préstamo VUELVE SOLO al club de origen al llegar la fecha de
--     retorno (proceso automático). 72 hs antes, aviso al club destino.
--   · Rescisión anticipada del préstamo: SOLO la hace el club destino
--     y paga un RECARGO configurable a la federación.
--   · Nadie inicia pases fuera de ventana: NI clubes NI la liga.
--   · Suspensiones: ya son por torneo (competition_id) desde el Paso 7B.
--
--   DEUDA CON EL CLUB DE ORIGEN (se declara en el dictamen)
--   · Modo "cobrar": el club destino paga la deuda junto con el pase
--     (se genera el cargo automático en Tesorería).
--   · Modo "bloqueante": el pase NO se puede completar hasta que la liga
--     marque la deuda como saldada (el jugador puede pagarla por fuera
--     del sistema y la liga lo registra).
--
--   DERECHO DE PASE (lo fija la FEDERACIÓN)
--   · Por CATEGORÍA y por TIPO de pase (definitivo / préstamo).
--   · Para préstamos puede haber un monto especial por TORNEO.
--   · La plata es de la federación: se cobra como cargo de Tesorería.
--
--   FIRMA PROFESIONAL DEL JUGADOR (pública, sin login)
--   · Documento de conformidad que el jugador lee y acepta.
--   · Firma DIBUJADA en pantalla (dedo o mouse) + foto del DNI sacada
--     en el momento con la cámara frontal.
--   · Si es MENOR de 18: bloque completo del tutor (parentesco, nombre,
--     apellido, DNI, firma dibujada y foto del DNI del tutor).
--   · El jugador también puede RECHAZAR el pase con un motivo, que ven
--     todas las partes.
--
--   TRABADOS
--   · 48 hs sin dictamen del club de origen → alerta a la federación.
--   · 72 hs sin dictamen → el pase se CANCELA SOLO y el jugador queda
--     disponible de nuevo (las horas son configurables).
--
--   TENENCIA
--   · Un jugador no se puede dar de baja hasta cumplir 1 año calendario
--     en el club (desde el 1° de enero del alta; configurable).
--
--   HISTÓRICOS EN PAPEL
--   · Solo del año anterior, los carga la liga desde el ícono del club.
--   · Queda el registro sin tocar nada de lo actual (no mueve jugadores
--     ni genera cargos).
--
-- Idempotente: se puede ejecutar más de una vez sin error.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) JUGADORES: fecha de nacimiento + foto
-- ---------------------------------------------------------------------------
alter table public.players add column if not exists fecha_nacimiento date;
alter table public.players add column if not exists foto_path text;

-- ---------------------------------------------------------------------------
-- 2) CATEGORÍAS: rango de años de nacimiento (editable por la liga)
-- ---------------------------------------------------------------------------
alter table public.categories add column if not exists anio_desde int;
alter table public.categories add column if not exists anio_hasta int;

-- La tabla categories no tenía políticas propias: lectura para todos los
-- usuarios con sesión (los paneles de club y admin la necesitan) y
-- gestión exclusiva de la liga.
drop policy if exists "categories: lectura autenticada" on public.categories;
create policy "categories: lectura autenticada"
  on public.categories for select to authenticated
  using (true);

drop policy if exists "categories: admin gestiona" on public.categories;
create policy "categories: admin gestiona"
  on public.categories for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 3) CONFIGURACIÓN DEL MÓDULO DE PASES (una sola fila, id = 1)
-- ---------------------------------------------------------------------------
create table if not exists public.pase_settings (
  id int primary key default 1 check (id = 1),
  tenencia_anios int not null default 1,          -- años calendario antes de poder dar de baja
  recargo_rescision numeric(12,2) not null default 0, -- cargo por rescindir un préstamo
  alerta_trabado_horas int not null default 48,   -- aviso a la federación
  cancelacion_trabado_horas int not null default 72, -- cancelación automática
  aviso_retorno_horas int not null default 72,    -- aviso previo al retorno de préstamo
  updated_at timestamptz not null default now()
);

alter table public.pase_settings enable row level security;

drop policy if exists "pase_settings: lectura autenticada" on public.pase_settings;
create policy "pase_settings: lectura autenticada"
  on public.pase_settings for select to authenticated
  using (true);

drop policy if exists "pase_settings: admin gestiona" on public.pase_settings;
create policy "pase_settings: admin gestiona"
  on public.pase_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

insert into public.pase_settings (id) values (1)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 4) DERECHO DE PASE: lo fija la federación por CATEGORÍA y TIPO.
--    competition_id NULL = regla general de la categoría;
--    con torneo = regla especial (pensado para préstamos por torneo).
-- ---------------------------------------------------------------------------
create table if not exists public.transfer_fees (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  competition_id uuid references public.competitions(id) on delete cascade,
  tipo text not null check (tipo in ('definitivo', 'prestamo')),
  monto numeric(12,2) not null default 0 check (monto >= 0),
  created_at timestamptz not null default now()
);

alter table public.transfer_fees enable row level security;

drop policy if exists "transfer_fees: lectura autenticada" on public.transfer_fees;
create policy "transfer_fees: lectura autenticada"
  on public.transfer_fees for select to authenticated
  using (true);

drop policy if exists "transfer_fees: admin gestiona" on public.transfer_fees;
create policy "transfer_fees: admin gestiona"
  on public.transfer_fees for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Una sola regla por (categoría, torneo-o-general, tipo)
create unique index if not exists transfer_fees_uniq
  on public.transfer_fees (category_id, coalesce(competition_id, '00000000-0000-0000-0000-000000000000'::uuid), tipo);

-- ---------------------------------------------------------------------------
-- 5) PASES: tipo (definitivo/préstamo), retorno, torneo y deuda declarada
-- ---------------------------------------------------------------------------
alter table public.transfers
  add column if not exists tipo_pase text not null default 'definitivo';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transfers'::regclass
      and conname = 'transfers_tipo_pase_check'
  ) then
    alter table public.transfers
      add constraint transfers_tipo_pase_check
      check (tipo_pase in ('definitivo', 'prestamo'));
  end if;
end $$;

alter table public.transfers add column if not exists fecha_retorno date;
alter table public.transfers add column if not exists competition_id uuid references public.competitions(id) on delete set null;

-- El préstamo EXIGE fecha de retorno
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transfers'::regclass
      and conname = 'transfers_prestamo_retorno_check'
  ) then
    alter table public.transfers
      add constraint transfers_prestamo_retorno_check
      check (tipo_pase <> 'prestamo' or fecha_retorno is not null);
  end if;
end $$;

-- Deuda declarada por el club de origen en el dictamen
alter table public.transfers add column if not exists deuda_monto numeric(12,2);
alter table public.transfers add column if not exists deuda_modo text;
alter table public.transfers add column if not exists deuda_descripcion text;
alter table public.transfers add column if not exists deuda_saldada boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.transfers'::regclass
      and conname = 'transfers_deuda_modo_check'
  ) then
    alter table public.transfers
      add constraint transfers_deuda_modo_check
      check (deuda_modo is null or deuda_modo in ('cobrar', 'bloqueante'));
  end if;
end $$;

-- Préstamos pendientes de retorno (para el proceso automático)
create index if not exists transfers_prestamos_idx
  on public.transfers (fecha_retorno)
  where tipo_pase = 'prestamo' and status = '7_COMPLETED';

-- ---------------------------------------------------------------------------
-- 6) FIRMA PROFESIONAL: datos para la pantalla pública de firma
--    (reemplaza a la función del Paso 9: devuelve más datos y nunca el
--    DNI completo — solo los últimos 3 números para que el jugador confirme)
-- ---------------------------------------------------------------------------
drop function if exists public.obtener_pase_firma(text);

create function public.obtener_pase_firma(p_token text)
returns table(
  transfer_id uuid,
  jugador text,
  jugador_dni_ultimos3 text,
  es_menor boolean,
  club_origen text,
  club_destino text,
  tipo_pase text,
  fecha_retorno date,
  torneo text,
  aprobado_en timestamptz,
  habilitada boolean,
  motivo text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    p.last_name || ', ' || p.first_name,
    right(p.dni, 3),
    (
      p.fecha_nacimiento is not null
      and p.fecha_nacimiento > (current_date - interval '18 years')::date
    ) as es_menor,
    coalesce(co.name, 'Jugador libre'),
    cd.name,
    t.tipo_pase,
    t.fecha_retorno,
    comp.name as torneo,
    t.approved_at,
    (
      t.status = '5_PLAYER_SIGNATURE'
      and t.approved_at is not null
      and now() <= t.approved_at + interval '72 hours'
    ) as habilitada,
    case
      when t.status in ('6_FINAL_AUDIT', '7_COMPLETED') then 'firmado'
      when t.status = '8_RECHAZADO' then 'rechazado'
      when t.status = '9_CANCELADO' then 'cancelado'
      else null
    end as motivo
  from public.transfers t
  join public.players p on p.id = t.player_id
  left join public.clubs co on co.id = t.from_club_id
  join public.clubs cd on cd.id = t.to_club_id
  left join public.competitions comp on comp.id = t.competition_id
  where t.metadata ->> 'firma_token' = p_token
    and t.status in ('5_PLAYER_SIGNATURE', '6_FINAL_AUDIT', '7_COMPLETED', '8_RECHAZADO', '9_CANCELADO')
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 7) FIRMAR (versión 9B): valida token + DNI + 72 hs y guarda las
--    evidencias (firma dibujada + foto DNI; si es menor, las del tutor).
--    Las imágenes ya están subidas al bucket privado documentos-pases;
--    acá solo quedan registradas las rutas en la metadata del pase.
-- ---------------------------------------------------------------------------
create or replace function public.firmar_pase_9b(
  p_token text,
  p_dni text,
  p_firma_path text,
  p_foto_dni_path text,
  p_tutor_parentesco text default null,
  p_tutor_nombre text default null,
  p_tutor_apellido text default null,
  p_tutor_dni text default null,
  p_tutor_firma_path text default null,
  p_tutor_foto_path text default null
)
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

  select p.dni, p.fecha_nacimiento into jugador
    from public.players p where p.id = pase.player_id;

  if jugador.dni <> p_dni then
    return 'El DNI no coincide con el jugador del pase. Revisalo y probá de nuevo.';
  end if;

  if p_firma_path is null or p_foto_dni_path is null then
    return 'Faltan la firma dibujada o la foto del DNI.';
  end if;

  -- Si es menor de 18, el bloque del tutor es OBLIGATORIO y completo
  if jugador.fecha_nacimiento is not null
     and jugador.fecha_nacimiento > (current_date - interval '18 years')::date then
    if p_tutor_parentesco is null or p_tutor_nombre is null
       or p_tutor_apellido is null or p_tutor_dni is null
       or p_tutor_firma_path is null or p_tutor_foto_path is null then
      return 'El jugador es menor de 18: faltan datos, firma o foto del DNI de la madre, padre o tutor/a.';
    end if;
  end if;

  update public.transfers
     set status = '6_FINAL_AUDIT',
         metadata = metadata || jsonb_build_object(
           'firmado_at', now(),
           'firma_token', null,
           'firma_jugador_path', p_firma_path,
           'foto_dni_jugador_path', p_foto_dni_path,
           'tutor', case
             when p_tutor_dni is null then null
             else jsonb_build_object(
               'parentesco', p_tutor_parentesco,
               'nombre', p_tutor_nombre,
               'apellido', p_tutor_apellido,
               'dni', p_tutor_dni,
               'firma_path', p_tutor_firma_path,
               'foto_path', p_tutor_foto_path
             )
           end
         )
   where id = pase.id;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) RECHAZO DEL JUGADOR: no acepta el pase y deja el motivo (lo ven todas
--    las partes). Mismo esquema de validación que la firma.
-- ---------------------------------------------------------------------------
create or replace function public.rechazar_pase_jugador(
  p_token text,
  p_dni text,
  p_motivo text
)
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

  if p_motivo is null or length(trim(p_motivo)) < 10 then
    return 'Contanos el motivo del rechazo (mínimo 10 letras).';
  end if;

  update public.transfers
     set status = '8_RECHAZADO',
         metadata = metadata || jsonb_build_object(
           'rechazado_at', now(),
           'rechazado_por', 'jugador',
           'rechazo_motivo', trim(p_motivo),
           'firma_token', null
         )
   where id = pase.id;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9) PROCESO AUTOMÁTICO DE PASES (se engancha a pg_cron y, de yapa, se
--    llama solo cada vez que alguien abre la pantalla de Trámites):
--      A) Cancela pases TRABADOS (sin dictamen en X horas)
--      B) Avisa 72 hs antes del retorno de un préstamo
--      C) Devuelve los préstamos vencidos al club de origen
-- ---------------------------------------------------------------------------
create or replace function public.procesar_pases_automaticos()
returns table(
  accion text,
  transfer_id uuid,
  club_origen_id uuid,
  club_destino_id uuid,
  jugador text,
  detalle text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  cfg record;
  fila record;
  horas int;
begin
  select * into cfg from public.pase_settings where id = 1;
  if cfg is null then
    cfg := row(1, 1, 0::numeric, 48, 72, 72, now())::public.pase_settings;
  end if;

  -- A) Pases trabados: el club de origen no dictaminó a tiempo → se cancelan
  for fila in
    select t.id, t.from_club_id, t.to_club_id,
           p.last_name || ', ' || p.first_name as nombre,
           (t.metadata ->> 'notificado_at')::timestamptz as notificado
      from public.transfers t
      join public.players p on p.id = t.player_id
     where t.status = '4_CLUB_B_DECISION'
       and (t.metadata ->> 'notificado_at') is not null
       and (t.metadata ->> 'notificado_at')::timestamptz
           <= now() - make_interval(hours => cfg.cancelacion_trabado_horas)
  loop
    update public.transfers
       set status = '9_CANCELADO',
           metadata = metadata || jsonb_build_object(
             'cancelado_at', now(),
             'cancelado_auto', true,
             'cancelacion_motivo', 'El club de origen no dictaminó a tiempo (trabado). El jugador vuelve a estar disponible.'
           )
     where id = fila.id;

    horas := floor(extract(epoch from (now() - fila.notificado)) / 3600);
    accion := 'cancelado_trabado';
    transfer_id := fila.id;
    club_origen_id := fila.from_club_id;
    club_destino_id := fila.to_club_id;
    jugador := fila.nombre;
    detalle := 'Sin dictamen por ' || horas || ' hs: el pase se canceló solo y el jugador quedó disponible.';
    return next;
  end loop;

  -- B) Aviso previo al retorno de préstamos que vencen pronto
  for fila in
    select t.id, t.from_club_id, t.to_club_id, t.fecha_retorno,
           p.last_name || ', ' || p.first_name as nombre
      from public.transfers t
      join public.players p on p.id = t.player_id
     where t.status = '7_COMPLETED'
       and t.tipo_pase = 'prestamo'
       and t.fecha_retorno is not null
       and (t.metadata ->> 'aviso_retorno_at') is null
       and (t.metadata ->> 'devuelto_at') is null
       and t.fecha_retorno > current_date
       and t.fecha_retorno <= current_date + make_interval(hours => cfg.aviso_retorno_horas)
  loop
    update public.transfers
       set metadata = metadata || jsonb_build_object('aviso_retorno_at', now())
     where id = fila.id;

    accion := 'aviso_retorno';
    transfer_id := fila.id;
    club_origen_id := fila.from_club_id;
    club_destino_id := fila.to_club_id;
    jugador := fila.nombre;
    detalle := 'A ' || fila.nombre || ' le quedan menos de ' || cfg.aviso_retorno_horas
               || ' hs de préstamo: volverá a su club de origen el día '
               || to_char(fila.fecha_retorno, 'DD/MM/YYYY') || '.';
    return next;
  end loop;

  -- C) Préstamos vencidos: el jugador vuelve SOLO al club de origen
  for fila in
    select t.id, t.player_id, t.from_club_id, t.to_club_id, t.fecha_retorno,
           p.last_name || ', ' || p.first_name as nombre
      from public.transfers t
      join public.players p on p.id = t.player_id
     where t.status = '7_COMPLETED'
       and t.tipo_pase = 'prestamo'
       and t.fecha_retorno is not null
       and (t.metadata ->> 'devuelto_at') is null
       and t.fecha_retorno <= current_date
  loop
    if fila.from_club_id is not null and fila.to_club_id is not null then
      update public.player_categories
         set club_id = fila.from_club_id
       where player_id = fila.player_id
         and club_id = fila.to_club_id;
    end if;

    update public.transfers
       set metadata = metadata || jsonb_build_object(
             'devuelto_at', now(),
             'devolucion', 'automatica'
           )
     where id = fila.id;

    accion := 'retorno_prestamo';
    transfer_id := fila.id;
    club_origen_id := fila.from_club_id;
    club_destino_id := fila.to_club_id;
    jugador := fila.nombre;
    detalle := 'Terminó el préstamo (' || to_char(fila.fecha_retorno, 'DD/MM/YYYY')
               || '): el jugador volvió automáticamente a su club de origen.';
    return next;
  end loop;

  return;
end;
$$;

-- Enganche con pg_cron si la extensión está disponible (cada 15 minutos).
-- Si no está, no pasa nada: la pantalla de Trámites dispara el mismo proceso.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('lfs-pases-automaticos');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'lfs-pases-automaticos',
      '*/15 * * * *',
      $cron$select * from public.procesar_pases_automaticos();$cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron no disponible: el proceso automático corre al abrir Trámites.';
end $$;

-- ---------------------------------------------------------------------------
-- 10) BAJA DE JUGADOR con TENENCIA (reemplaza a la del Paso 9, misma firma):
--     no se puede dar de baja hasta cumplir X años calendario en el club
--     (cuentan desde el 1° de enero del año del alta; configurable).
-- ---------------------------------------------------------------------------
create or replace function public.dar_baja_jugador(p_player_id uuid, p_motivo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club uuid;
  v_pases_activos int;
  v_alta timestamptz;
  v_tenencia int;
  v_anio_alta int;
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

  -- TENENCIA: X años calendario desde el 1° de enero del alta en ESTE club
  select coalesce(tenencia_anios, 1) into v_tenencia
    from public.pase_settings where id = 1;
  v_tenencia := coalesce(v_tenencia, 1);

  select min(pc.created_at) into v_alta
    from public.player_categories pc
   where pc.player_id = p_player_id and pc.club_id = v_club;

  if v_alta is not null and v_tenencia > 0 then
    v_anio_alta := extract(year from v_alta)::int;
    if (extract(year from current_date)::int - v_anio_alta) < v_tenencia then
      return 'Este jugador todavía no cumplió la tenencia mínima de ' || v_tenencia
             || ' año(s) calendario en el club. Recién se podrá dar de baja a partir del 01/01/'
             || (v_anio_alta + v_tenencia)::text || '. Si se va a otro club, corresponde un pase.';
    end if;
  end if;

  insert into public.player_bajas (player_id, club_id, motivo, creado_por)
  values (p_player_id, v_club, nullif(trim(p_motivo), ''), auth.uid());

  delete from public.player_categories
   where player_id = p_player_id and club_id = v_club;

  return 'OK';
end;
$$;

-- ---------------------------------------------------------------------------
-- 11) PÁGINA PÚBLICA DE TRANSFERENCIAS (sin login):
--     solo pases EFECTIVOS, con foto, origen → destino y tipo.
--     NUNCA montos. Los históricos en papel tampoco se muestran.
-- ---------------------------------------------------------------------------
create or replace function public.pases_publicos()
returns table(
  transfer_id uuid,
  jugador text,
  foto_url text,
  club_origen text,
  club_destino text,
  tipo_pase text,
  numero_pase text,
  oficializado_en timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.id,
    p.last_name || ', ' || p.first_name,
    p.foto_path,
    coalesce(co.name, 'Jugador libre'),
    cd.name,
    t.tipo_pase,
    t.numero_pase,
    coalesce(
      (t.metadata ->> 'completado_at')::timestamptz,
      t.approved_at,
      t.created_at
    ) as oficializado_en
  from public.transfers t
  join public.players p on p.id = t.player_id
  left join public.clubs co on co.id = t.from_club_id
  join public.clubs cd on cd.id = t.to_club_id
  where t.status = '7_COMPLETED'
    and coalesce((t.metadata ->> 'historico')::boolean, false) = false
  order by oficializado_en desc
  limit 100;
$$;

-- ---------------------------------------------------------------------------
-- 12) FOTOS DE JUGADORES: bucket PÚBLICO (la foto se ve en la página
--     pública de transferencias). Carpeta = club dueño del jugador:
--     fotos-jugadores/<club_id>/<player_id>.<ext>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-jugadores',
  'fotos-jugadores',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "fotos: lectura pública" on storage.objects;
create policy "fotos: lectura pública"
  on storage.objects for select to public
  using (bucket_id = 'fotos-jugadores');

drop policy if exists "fotos: admin o su club suben" on storage.objects;
create policy "fotos: admin o su club suben"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos-jugadores'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.mi_club_id()::text
    )
  );

drop policy if exists "fotos: admin o su club actualizan" on storage.objects;
create policy "fotos: admin o su club actualizan"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'fotos-jugadores'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = public.mi_club_id()::text
    )
  );

-- El club (o la liga) actualiza SOLO fecha de nacimiento y foto de SUS
-- jugadores. Los demás datos del jugador los toca únicamente la liga.
create or replace function public.club_actualizar_jugador(
  p_player_id uuid,
  p_fecha_nacimiento date default null,
  p_foto_path text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if not exists (
      select 1 from public.player_categories pc
      where pc.player_id = p_player_id
        and pc.club_id = public.mi_club_id()
    ) then
      return 'Ese jugador no pertenece a tu club.';
    end if;
  end if;

  update public.players
     set fecha_nacimiento = coalesce(p_fecha_nacimiento, fecha_nacimiento),
         foto_path = coalesce(p_foto_path, foto_path)
   where id = p_player_id;

  if not found then
    return 'El jugador no existe.';
  end if;

  return 'OK';
end;
$$;

-- ============================================================================
-- VERIFICACIÓN (ejecutar después del script: tiene que dar todo OK)
-- ============================================================================
select
  case when (select count(*) from information_schema.columns
             where table_schema = 'public' and table_name = 'players'
               and column_name in ('fecha_nacimiento', 'foto_path')) = 2
       then '✅ players: 2 de 2 columnas nuevas' else '❌ players' end as players,
  case when (select count(*) from information_schema.columns
             where table_schema = 'public' and table_name = 'categories'
               and column_name in ('anio_desde', 'anio_hasta')) = 2
       then '✅ categories: 2 de 2 columnas nuevas' else '❌ categories' end as categories,
  case when (select count(*) from information_schema.columns
             where table_schema = 'public' and table_name = 'transfers'
               and column_name in ('tipo_pase', 'fecha_retorno', 'competition_id',
                                   'deuda_monto', 'deuda_modo', 'deuda_saldada')) = 6
       then '✅ transfers: 6 de 6 columnas nuevas' else '❌ transfers' end as transfers,
  case when (select count(*) from information_schema.tables
             where table_schema = 'public'
               and table_name in ('pase_settings', 'transfer_fees')) = 2
       then '✅ tablas: 2 de 2 (pase_settings, transfer_fees)' else '❌ tablas' end as tablas,
  case when (select count(*) from pg_proc p
             join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('obtener_pase_firma', 'firmar_pase_9b',
                                 'rechazar_pase_jugador', 'procesar_pases_automaticos',
                                 'pases_publicos', 'club_actualizar_jugador')) = 6
       then '✅ funciones: 6 de 6' else '❌ funciones' end as funciones,
  case when exists (select 1 from storage.buckets where id = 'fotos-jugadores' and public = true)
       then '✅ bucket fotos-jugadores (público)' else '❌ bucket' end as bucket;
