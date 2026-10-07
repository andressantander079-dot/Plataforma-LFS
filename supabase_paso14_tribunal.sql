-- =============================================================================
-- PLATAFORMA LFS — PASO 14: TRIBUNAL DE DISCIPLINA
-- Tribunal real sobre el motor automático del Paso 7B:
--   · Sanciones automáticas MODIFICABLES por el admin (fechas, motivo, anular)
--     con auditoría completa en audit_logs.
--   · Sanciones MANUALES: jugadores, cuerpo técnico (DT) y multas a clubes.
--   · Catálogo de infracciones editable (+ texto libre).
--   · Apelaciones del club con pruebas (plazo 72 hs, la sanción se cumple
--     igual hasta el fallo).
--   · Multas vinculadas a tesorería (cargo automático tipo multa_tribunal).
-- Ejecutar en: Supabase → SQL Editor → Run
-- Requiere: pasos 1 al 13 (usa is_admin(), mi_club_id(), player_suspensions,
--           treasury_charges y el bucket mensajeria-adjuntos para pruebas).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PLAYER_SUSPENSIONS: de "suspensión automática" a "sanción del tribunal"
-- -----------------------------------------------------------------------------

-- El motivo deja de ser un enum cerrado: ahora admite texto libre (catálogo o
-- redacción manual). Los valores viejos ('roja', 'acumulacion_amarillas')
-- siguen siendo válidos y la UI los muestra bonitos.
alter table public.player_suspensions
  drop constraint if exists player_suspensions_motivo_check;

-- Sanciones manuales: no siempre hay jugador/equipo/torneo de planilla
alter table public.player_suspensions alter column player_id drop not null;
alter table public.player_suspensions alter column team_id drop not null;
alter table public.player_suspensions alter column competition_id drop not null;

alter table public.player_suspensions
  add column if not exists origen text not null default 'automatica',
  add column if not exists sancionado_tipo text not null default 'jugador',
  add column if not exists sancionado_nombre text,
  add column if not exists club_id uuid references public.clubs(id) on delete cascade,
  add column if not exists monto_multa numeric(12,2),
  add column if not exists treasury_charge_id uuid references public.treasury_charges(id) on delete set null,
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_motivo text,
  add column if not exists anulada_por uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'suspension_origen_check') then
    alter table public.player_suspensions
      add constraint suspension_origen_check check (origen in ('automatica', 'manual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suspension_tipo_check') then
    alter table public.player_suspensions
      add constraint suspension_tipo_check
      check (sancionado_tipo in ('jugador', 'cuerpo_tecnico', 'club'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suspension_identidad_check') then
    alter table public.player_suspensions
      add constraint suspension_identidad_check
      check (player_id is not null or sancionado_nombre is not null or club_id is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'suspension_motivo_no_vacio') then
    alter table public.player_suspensions
      add constraint suspension_motivo_no_vacio check (length(trim(motivo)) > 0);
  end if;
end $$;

create index if not exists suspensiones_club_idx
  on public.player_suspensions(club_id) where club_id is not null;

-- -----------------------------------------------------------------------------
-- 2. TREASURY_CHARGES: nuevo tipo 'multa_tribunal' + vínculo con la sanción
-- -----------------------------------------------------------------------------
alter table public.treasury_charges
  drop constraint if exists treasury_charges_tipo_check;

alter table public.treasury_charges
  add constraint treasury_charges_tipo_check check (tipo in (
    'inscripcion_torneo',
    'cuota_mensual',
    'cuota_anual',
    'multa_roja',
    'multa_wo',
    'multa_acumulacion_amarillas',
    'multa_tribunal',
    'otro'
  ));

alter table public.treasury_charges
  add column if not exists suspension_id uuid references public.player_suspensions(id) on delete set null;

create index if not exists charges_suspension_idx
  on public.treasury_charges(suspension_id) where suspension_id is not null;

-- -----------------------------------------------------------------------------
-- 3. CATÁLOGO DE INFRACCIONES (editable por la federación)
-- -----------------------------------------------------------------------------
create table if not exists public.infraction_catalog (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text,
  aplica_a text not null default 'jugador'
    check (aplica_a in ('jugador', 'cuerpo_tecnico', 'club', 'todos')),
  fechas_default int not null default 0 check (fechas_default >= 0),
  multa_default numeric(12,2) not null default 0 check (multa_default >= 0),
  activo boolean not null default true,
  orden int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.infraction_catalog enable row level security;

drop policy if exists "catalogo lectura usuarios" on public.infraction_catalog;
create policy "catalogo lectura usuarios"
  on public.infraction_catalog for select to authenticated
  using (true);

drop policy if exists "catalogo admin gestiona" on public.infraction_catalog;
create policy "catalogo admin gestiona"
  on public.infraction_catalog for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Catálogo inicial (la federación lo edita a gusto desde el Tribunal)
insert into public.infraction_catalog (nombre, descripcion, aplica_a, fechas_default, multa_default, orden)
values
  ('Doble tarjeta amarilla', 'Expulsión por doble amonestación en un mismo partido.', 'jugador', 1, 0, 10),
  ('Roja directa', 'Expulsión directa durante el partido.', 'jugador', 1, 0, 20),
  ('Insultos a la terna arbitral', 'Ofensas verbales contra árbitros o planilleros.', 'todos', 2, 15000, 30),
  ('Agresión verbal a rival', 'Insultos o provocaciones graves a jugadores rivales.', 'todos', 2, 10000, 40),
  ('Agresión física', 'Contacto físico intencional contra rival, terna o público.', 'todos', 4, 25000, 50),
  ('Conducta antideportiva del banco', 'Cuerpo técnico o suplentes con conducta reiterada.', 'cuerpo_tecnico', 1, 10000, 60),
  ('Presentación incompleta / W.O.', 'El club no se presenta o presenta equipo incompleto.', 'club', 0, 20000, 70),
  ('Incidentes fuera de la cancha', 'Hechos de violencia o daños vinculados al club.', 'club', 0, 30000, 80)
on conflict (nombre) do nothing;

-- -----------------------------------------------------------------------------
-- 4. APELACIONES (una por sanción; plazo 72 hs validado en la app)
-- -----------------------------------------------------------------------------
create table if not exists public.sanction_appeals (
  id uuid primary key default gen_random_uuid(),
  suspension_id uuid not null unique references public.player_suspensions(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  motivo text not null,
  adjuntos jsonb not null default '[]'::jsonb, -- [{ "path": "...", "nombre": "..." }]
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aceptada', 'rechazada')),
  resolucion text,
  resuelto_por uuid,
  resuelto_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists appeals_pendientes_idx
  on public.sanction_appeals(estado) where estado = 'pendiente';

alter table public.sanction_appeals enable row level security;

drop policy if exists "apelaciones: club ve las suyas" on public.sanction_appeals;
create policy "apelaciones: club ve las suyas"
  on public.sanction_appeals for select to authenticated
  using (public.is_admin() or club_id = public.mi_club_id());

drop policy if exists "apelaciones: club apela las suyas" on public.sanction_appeals;
create policy "apelaciones: club apela las suyas"
  on public.sanction_appeals for insert to authenticated
  with check (club_id = public.mi_club_id());

drop policy if exists "apelaciones: admin resuelve" on public.sanction_appeals;
create policy "apelaciones: admin resuelve"
  on public.sanction_appeals for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. VERIFICACIÓN (deberías ver estos resultados)
-- -----------------------------------------------------------------------------
select 'columnas nuevas en sanciones' as chequeo, count(*)::int as encontradas, 9 as esperadas
  from information_schema.columns
 where table_schema = 'public' and table_name = 'player_suspensions'
   and column_name in ('origen','sancionado_tipo','sancionado_nombre','club_id',
                       'monto_multa','treasury_charge_id','anulada_at','anulada_motivo','anulada_por')
union all
select 'tipo multa_tribunal habilitado', count(*)::int, 1
  from pg_constraint where conname = 'treasury_charges_tipo_check'
union all
select 'catalogo de infracciones (filas)', count(*)::int, 8
  from public.infraction_catalog
union all
select 'tabla apelaciones', count(*)::int, 1
  from information_schema.tables
 where table_schema = 'public' and table_name = 'sanction_appeals';
