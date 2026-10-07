-- =============================================================================
-- PLATAFORMA LFS — PASO 15: TRÁMITES — CONFIGURACIÓN UNIFICADA + PASES INTUITIVOS
-- 1) UNA SOLA fuente de verdad para la configuración del mercado de pases:
--    la tabla pase_settings (antes había DOBLE configuración desconectada:
--    pase_settings vs league_settings.data->transfers).
--    · Se editan desde Configuración LFS → Pases & Fichajes.
--    · Trámites → Configuración queda como vista de SOLO LECTURA en vivo.
-- 2) Nuevas reglas: recargo por rescisión con DOS modos (monto fijo $ o
--    multiplicador), cupo por plantel y firma del jugador obligatoria/opcional.
-- 3) Ventanas de mercado: UN solo control (transfer_windows con estado
--    automático). Si la tabla está vacía, se copia la ventana que estaba
--    cargada en league_settings para no cortar el circuito.
-- 4) Realtime: pase_settings / transfer_windows / transfer_fees / categories
--    entran a la publicación para que la vista de solo lectura se actualice
--    sola, sin recargar.
-- Ejecutar en: Supabase → SQL Editor → Run
-- Requiere: pasos 1 al 14.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PASE_SETTINGS: columnas nuevas (fuente única del mercado)
-- -----------------------------------------------------------------------------
alter table public.pase_settings
  add column if not exists recargo_modo text not null default 'fijo',
  add column if not exists cupo_plantel int not null default 25,
  add column if not exists firma_obligatoria boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pase_settings_recargo_modo_check') then
    alter table public.pase_settings
      add constraint pase_settings_recargo_modo_check
      check (recargo_modo in ('fijo', 'multiplicador'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'pase_settings_cupo_check') then
    alter table public.pase_settings
      add constraint pase_settings_cupo_check
      check (cupo_plantel between 10 and 50);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. BACKFILL: los valores que vivían en league_settings.data->transfers pasan
--    a pase_settings (gana lo que se veía en Configuración LFS → Pases & Fichajes)
-- -----------------------------------------------------------------------------
do $$
declare
  tr jsonb;
begin
  select data -> 'transfers' into tr
    from public.league_settings
   where id = 1;

  if tr is not null then
    update public.pase_settings set
      tenencia_anios = coalesce(nullif(tr ->> 'tenencia_anios', '')::int, tenencia_anios),
      alerta_trabado_horas = coalesce(nullif(tr ->> 'alerta_trabado_horas', '')::int, alerta_trabado_horas),
      cancelacion_trabado_horas = coalesce(nullif(tr ->> 'cancelacion_trabado_horas', '')::int, cancelacion_trabado_horas),
      cupo_plantel = coalesce(nullif(tr ->> 'max_players_per_roster', '')::int, cupo_plantel),
      firma_obligatoria = coalesce(nullif(tr ->> 'require_player_signature', '')::boolean, firma_obligatoria),
      -- El viejo "recargo_rescision" de league_settings era un MULTIPLICADOR (1 = sin recargo)
      recargo_modo = case
        when coalesce(nullif(tr ->> 'recargo_rescision', '')::numeric, 1) > 1 then 'multiplicador'
        else recargo_modo
      end,
      recargo_rescision = case
        when coalesce(nullif(tr ->> 'recargo_rescision', '')::numeric, 1) > 1
          then (tr ->> 'recargo_rescision')::numeric
        else recargo_rescision
      end,
      updated_at = now()
    where id = 1;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. VENTANAS: si transfer_windows está vacía pero había fechas cargadas en
--    league_settings, las copiamos (así el motor, que ahora mira SOLO
--    transfer_windows, no deja el mercado cerrado por accidente)
-- -----------------------------------------------------------------------------
do $$
declare
  tr jsonb;
  d_desde text;
  d_hasta text;
begin
  select data -> 'transfers' into tr
    from public.league_settings
   where id = 1;

  if tr is not null and not exists (select 1 from public.transfer_windows) then
    d_desde := nullif(tr ->> 'window_start_date', '');
    d_hasta := nullif(tr ->> 'window_end_date', '');
    if d_desde is not null and d_hasta is not null and d_hasta >= d_desde then
      insert into public.transfer_windows (nombre, fecha_desde, fecha_hasta)
      values ('Ventana ' || d_desde || ' a ' || d_hasta, d_desde::date, d_hasta::date);
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. REALTIME: la vista de solo lectura (Trámites → Configuración) se
--    actualiza en vivo cuando la federación guarda en Configuración LFS
-- -----------------------------------------------------------------------------
do $$
declare
  tablas text[] := array[
    'pase_settings',
    'transfer_windows',
    'transfer_fees',
    'categories'
  ];
  t text;
begin
  foreach t in array tablas loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. VERIFICACIÓN (compará con la guía)
-- -----------------------------------------------------------------------------
select 'columnas nuevas en pase_settings' as chequeo, count(*)::int as encontradas, 3 as esperadas
  from information_schema.columns
 where table_schema = 'public' and table_name = 'pase_settings'
   and column_name in ('recargo_modo', 'cupo_plantel', 'firma_obligatoria')
union all
select 'valores unificados (fila id=1)', count(*)::int, 1
  from public.pase_settings where id = 1
union all
select 'ventanas de mercado cargadas', count(*)::int, -1 -- -1 = tiene que ser 1 o más
  from public.transfer_windows
union all
select 'tablas config con realtime', count(*)::int, 4
  from pg_publication_tables
 where pubname = 'supabase_realtime' and schemaname = 'public'
   and tablename in ('pase_settings', 'transfer_windows', 'transfer_fees', 'categories');
