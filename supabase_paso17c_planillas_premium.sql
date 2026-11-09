-- =====================================================================
-- PLATAFORMA LFS — PASO 17C: PLANILLAS PREMIUM + TRANSMISIÓN EN VIVO
-- =====================================================================
-- Qué agrega:
--   1. match_officials: 2do árbitro y planillero de mesa por partido
--      (el árbitro principal sigue en matches.referee_id, nada se rompe).
--   2. Reloj en vivo en matches (fase, cuenta regresiva, pausa manual).
--   3. Colores de camiseta, motivo de suspensión/ausencia, figura del
--      partido y avisos automáticos en matches.
--   4. match_sheets: observaciones, cuerpo técnico (DT/ayudante),
--      firmas digitales, votos de la figura y capitanes.
--   5. match_sheet_players: número de camiseta por partido.
--   6. match_events: nuevos tipos 'falta' y 'tiempo_muerto', tiempo
--      (PT/ST), minuto total y asistencia en los goles.
--   7. Bucket privado 'firmas-planillas' para las firmas.
--   8. Lectura PÚBLICA de eventos/planilla SOLO de partidos en vivo
--      o finalizados (la transmisión no pide login).
--   9. RPC público obtener_transmision_publica(match_id) con los datos
--      mínimos para la página /en-vivo (security definer).
--  10. Realtime: matches, match_events, match_sheets, match_officials.
--
-- IDEMPOTENTE: se puede correr más de una vez sin romper nada.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. OFICIALES DEL PARTIDO (2do árbitro + planillero de mesa)
--    El principal NO vive acá: sigue en matches.referee_id para no
--    romper designaciones, liquidaciones y calendario (Paso 16).
-- ---------------------------------------------------------------------
create table if not exists public.match_officials (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rol text not null check (rol in ('segundo_arbitro', 'planillero')),
  designacion_modo text not null default 'directa'
    check (designacion_modo in ('directa', 'propuesta')),
  designacion_estado text not null default 'aceptada'
    check (designacion_estado in ('pendiente', 'aceptada', 'rechazada')),
  propuesto_por uuid references public.profiles(id) on delete set null,
  respondido_at timestamptz,
  created_at timestamptz not null default now(),
  unique (match_id, user_id, rol)
);

create index if not exists match_officials_match_idx on public.match_officials(match_id);
create index if not exists match_officials_user_idx on public.match_officials(user_id);

alter table public.match_officials enable row level security;

-- Lectura: admin, el oficial mismo, el árbitro principal del partido
-- y los clubes que juegan ese partido.
drop policy if exists "oficiales lectura involucrados" on public.match_officials;
create policy "oficiales lectura involucrados"
  on public.match_officials for select to authenticated
  using (
    public.is_admin()
    or user_id = auth.uid()
    or exists (
      select 1
      from public.matches m
      join public.teams ht on ht.id = m.home_team_id
      join public.teams at on at.id = m.away_team_id
      where m.id = match_officials.match_id
        and (
          m.referee_id = auth.uid()
          or ht.club_id = public.mi_club_id()
          or at.club_id = public.mi_club_id()
        )
    )
  );

-- Escritura: solo la federación
drop policy if exists "oficiales admin todo" on public.match_officials;
create policy "oficiales admin todo"
  on public.match_officials for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- El oficial responde su propia propuesta (aceptar / rechazar)
drop policy if exists "oficiales responde propuesta" on public.match_officials;
create policy "oficiales responde propuesta"
  on public.match_officials for update to authenticated
  using (user_id = auth.uid() and designacion_modo = 'propuesta')
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. MATCHES: reloj en vivo, colores, ausencia, figura y avisos
-- ---------------------------------------------------------------------
alter table public.matches
  add column if not exists live_status text not null default 'sin_iniciar',
  add column if not exists duracion_tiempo_min int not null default 25,
  add column if not exists duracion_entretiempo_min int not null default 10,
  add column if not exists reloj_iniciado_at timestamptz,
  add column if not exists reloj_segundos_base int not null default 0,
  add column if not exists reloj_corriendo boolean not null default false,
  add column if not exists motivo_estado text,
  add column if not exists ausente_team_id uuid references public.teams(id) on delete set null,
  add column if not exists color_local text,
  add column if not exists color_visitante text,
  add column if not exists figura_player_id uuid references public.players(id) on delete set null,
  add column if not exists en_vivo_desde timestamptz,
  add column if not exists avisos jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_live_status_check'
  ) then
    alter table public.matches
      add constraint matches_live_status_check
      check (live_status in ('sin_iniciar','pre_partido','primer_tiempo','entretiempo','segundo_tiempo','finalizado'));
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. MATCH_SHEETS: observaciones, cuerpo técnico, firmas, votos,
--    capitanes y cierre premium
-- ---------------------------------------------------------------------
alter table public.match_sheets
  add column if not exists observaciones text,
  add column if not exists cuerpo_tecnico jsonb not null default '{}'::jsonb,
  add column if not exists staff_confirmado boolean not null default false,
  add column if not exists firmas jsonb not null default '{}'::jsonb,
  add column if not exists votos_figura jsonb not null default '[]'::jsonb,
  add column if not exists capitan_local_id uuid references public.players(id) on delete set null,
  add column if not exists capitan_visitante_id uuid references public.players(id) on delete set null,
  add column if not exists cerrada_por uuid references public.profiles(id) on delete set null,
  add column if not exists cerrada_at timestamptz;

-- ---------------------------------------------------------------------
-- 4. MATCH_SHEET_PLAYERS: número de camiseta por partido
-- ---------------------------------------------------------------------
alter table public.match_sheet_players
  add column if not exists numero_camiseta int
    check (numero_camiseta between 1 and 99);

-- ---------------------------------------------------------------------
-- 5. MATCH_EVENTS: faltas, tiempos muertos, PT/ST, minuto total y
--    asistencia. player_id pasa a admitir NULL (un tiempo muerto es
--    del equipo, no de un jugador).
-- ---------------------------------------------------------------------
alter table public.match_events
  drop constraint if exists match_events_tipo_check;
alter table public.match_events
  add constraint match_events_tipo_check
  check (tipo in ('gol','gol_en_contra','amarilla','roja','cambio','falta','tiempo_muerto'));

alter table public.match_events
  alter column player_id drop not null;

alter table public.match_events
  add column if not exists tiempo text check (tiempo in ('PT','ST')),
  add column if not exists minuto_total int,
  add column if not exists asistente_id uuid references public.players(id) on delete set null;

-- ---------------------------------------------------------------------
-- 6. BUCKET PRIVADO PARA LAS FIRMAS
--    Ruta: {match_id}/{rol}.png  (rol = principal, segundo_arbitro, ...)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('firmas-planillas', 'firmas-planillas', false)
on conflict (id) do nothing;

drop policy if exists "firmas sube oficial o admin" on storage.objects;
create policy "firmas sube oficial o admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'firmas-planillas'
    and (
      public.is_admin()
      or exists (
        select 1 from public.matches m
        where m.id::text = (storage.foldername(objects.name))[1]
          and (
            m.referee_id = auth.uid()
            or exists (
              select 1 from public.match_officials mo
              where mo.match_id = m.id
                and mo.user_id = auth.uid()
                and mo.designacion_estado = 'aceptada'
            )
          )
      )
    )
  );

drop policy if exists "firmas lee involucrados" on storage.objects;
create policy "firmas lee involucrados"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'firmas-planillas'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.matches m
        join public.teams ht on ht.id = m.home_team_id
        join public.teams at on at.id = m.away_team_id
        where m.id::text = (storage.foldername(objects.name))[1]
          and (
            m.referee_id = auth.uid()
            or ht.club_id = public.mi_club_id()
            or at.club_id = public.mi_club_id()
            or exists (
              select 1 from public.match_officials mo
              where mo.match_id = m.id and mo.user_id = auth.uid()
            )
          )
      )
    )
  );

drop policy if exists "firmas borra oficial o admin" on storage.objects;
create policy "firmas borra oficial o admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'firmas-planillas'
    and (
      public.is_admin()
      or exists (
        select 1 from public.matches m
        where m.id::text = (storage.foldername(objects.name))[1]
          and m.referee_id = auth.uid()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 7. LECTURA PÚBLICA PARA LA TRANSMISIÓN EN VIVO
--    Solo partidos que arrancaron (live_status <> 'sin_iniciar').
--    matches ya tiene lectura pública desde el Paso 6.
-- ---------------------------------------------------------------------
drop policy if exists "eventos lectura publica en vivo" on public.match_events;
create policy "eventos lectura publica en vivo"
  on public.match_events for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and m.live_status <> 'sin_iniciar'
    )
  );

drop policy if exists "planilla lectura publica en vivo" on public.match_sheets;
create policy "planilla lectura publica en vivo"
  on public.match_sheets for select
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_sheets.match_id
        and m.live_status <> 'sin_iniciar'
    )
  );

drop policy if exists "convocados lectura publica en vivo" on public.match_sheet_players;
create policy "convocados lectura publica en vivo"
  on public.match_sheet_players for select
  using (
    exists (
      select 1
      from public.match_sheets ms
      join public.matches m on m.id = ms.match_id
      where ms.id = match_sheet_players.sheet_id
        and m.live_status <> 'sin_iniciar'
    )
  );

-- Oficiales: carga/borra eventos el principal o el 2do aceptado
drop policy if exists "eventos oficiales cargan" on public.match_events;
create policy "eventos oficiales cargan"
  on public.match_events for insert to authenticated
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.referee_id = auth.uid()
    )
    or exists (
      select 1 from public.match_officials mo
      where mo.match_id = match_events.match_id
        and mo.user_id = auth.uid()
        and mo.rol = 'segundo_arbitro'
        and mo.designacion_estado = 'aceptada'
    )
  );

drop policy if exists "eventos oficiales borran" on public.match_events;
create policy "eventos oficiales borran"
  on public.match_events for delete to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and m.referee_id = auth.uid()
    )
    or exists (
      select 1 from public.match_officials mo
      where mo.match_id = match_events.match_id
        and mo.user_id = auth.uid()
        and mo.rol = 'segundo_arbitro'
        and mo.designacion_estado = 'aceptada'
    )
  );

-- El principal cierra su planilla (update acotado; el admin ya tiene "todo")
drop policy if exists "planilla principal actualiza" on public.match_sheets;
create policy "planilla principal actualiza"
  on public.match_sheets for update to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_sheets.match_id and m.referee_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.matches m
      where m.id = match_sheets.match_id and m.referee_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 8. RPC PÚBLICO: datos mínimos para /en-vivo (sin login)
--    Devuelve NULL si el partido no arrancó (no expone nada).
-- ---------------------------------------------------------------------
create or replace function public.obtener_transmision_publica(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches%rowtype;
  v_result jsonb;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found or v_match.live_status = 'sin_iniciar' then
    return null;
  end if;

  select jsonb_build_object(
    'partido', jsonb_build_object(
      'id', v_match.id,
      'estado', v_match.status,
      'liveStatus', v_match.live_status,
      'relojCorriendo', v_match.reloj_corriendo,
      'relojIniciadoAt', v_match.reloj_iniciado_at,
      'relojSegundosBase', v_match.reloj_segundos_base,
      'duracionTiempoMin', v_match.duracion_tiempo_min,
      'duracionEntretiempoMin', v_match.duracion_entretiempo_min,
      'homeScore', v_match.home_score,
      'awayScore', v_match.away_score,
      'scheduledAt', v_match.scheduled_at,
      'colorLocal', v_match.color_local,
      'colorVisitante', v_match.color_visitante,
      'figuraPlayerId', v_match.figura_player_id,
      'motivoEstado', v_match.motivo_estado,
      'local', (select t.name from public.teams t where t.id = v_match.home_team_id),
      'visitante', (select t.name from public.teams t where t.id = v_match.away_team_id),
      'categoria', (
        select c.name from public.competitions comp
        join public.categories c on c.id = comp.category_id
        where comp.id = v_match.competition_id
      ),
      'torneo', (select comp.name from public.competitions comp where comp.id = v_match.competition_id),
      'cancha', (select v.name from public.venues v where v.id = v_match.venue_id),
      'arbitroPrincipal', (select p.full_name from public.profiles p where p.id = v_match.referee_id),
      'oficiales', (
        select coalesce(jsonb_agg(jsonb_build_object('rol', mo.rol, 'nombre', p.full_name)), '[]'::jsonb)
        from public.match_officials mo
        join public.profiles p on p.id = mo.user_id
        where mo.match_id = v_match.id and mo.designacion_estado = 'aceptada'
      )
    ),
    'eventos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', e.id,
        'tipo', e.tipo,
        'minuto', e.minuto,
        'tiempo', e.tiempo,
        'minutoTotal', e.minuto_total,
        'teamId', e.team_id,
        'jugador', (p.first_name || ' ' || p.last_name),
        'relacionado', (pr.first_name || ' ' || pr.last_name),
        'asistente', (pa.first_name || ' ' || pa.last_name),
        'createdAt', e.created_at
      ) order by e.created_at), '[]'::jsonb)
      from public.match_events e
      left join public.players p on p.id = e.player_id
      left join public.players pr on pr.id = e.jugador_relacionado_id
      left join public.players pa on pa.id = e.asistente_id
      where e.match_id = v_match.id
    ),
    'convocados', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'playerId', msp.player_id,
        'nombre', (p.first_name || ' ' || p.last_name),
        'teamId', msp.team_id,
        'esTitular', msp.es_titular,
        'numero', msp.numero_camiseta
      )), '[]'::jsonb)
      from public.match_sheet_players msp
      join public.match_sheets ms on ms.id = msp.sheet_id
      join public.players p on p.id = msp.player_id
      where ms.match_id = v_match.id
    ),
    'cuerpoTecnico', (
      select coalesce(ms.cuerpo_tecnico, '{}'::jsonb)
      from public.match_sheets ms where ms.match_id = v_match.id
    ),
    'figura', (
      select (p.first_name || ' ' || p.last_name)
      from public.players p where p.id = v_match.figura_player_id
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.obtener_transmision_publica(uuid) from public;
grant execute on function public.obtener_transmision_publica(uuid) to anon, authenticated;

-- RPC: partidos en vivo / de hoy / últimos resultados para la home
create or replace function public.obtener_partidos_en_vivo()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with base as (
    select
      m.id, m.status, m.live_status, m.scheduled_at,
      m.home_score, m.away_score,
      (select t.name from public.teams t where t.id = m.home_team_id) as local,
      (select t.name from public.teams t where t.id = m.away_team_id) as visitante,
      (select c.name from public.competitions comp join public.categories c on c.id = comp.category_id
        where comp.id = m.competition_id) as categoria,
      (select comp.name from public.competitions comp where comp.id = m.competition_id) as torneo,
      (select v.name from public.venues v where v.id = m.venue_id) as cancha,
      (select p.full_name from public.profiles p where p.id = m.referee_id) as arbitro
    from public.matches m
  )
  select jsonb_build_object(
    'enVivo', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.scheduled_at), '[]'::jsonb)
      from base b where b.live_status in ('pre_partido','primer_tiempo','entretiempo','segundo_tiempo')
    ),
    'proximosHoy', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.scheduled_at), '[]'::jsonb)
      from base b
      where b.live_status = 'sin_iniciar' and b.status = 'programado'
        and b.scheduled_at is not null
        and (b.scheduled_at at time zone 'America/Argentina/Ushuaia')::date
            = (now() at time zone 'America/Argentina/Ushuaia')::date
    ),
    'ultimosResultados', (
      select coalesce(jsonb_agg(to_jsonb(b) order by b.scheduled_at desc), '[]'::jsonb)
      from (
        select * from base
        where live_status = 'finalizado' or status in ('jugado','wo')
        order by scheduled_at desc nulls last
        limit 8
      ) b
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.obtener_partidos_en_vivo() from public;
grant execute on function public.obtener_partidos_en_vivo() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. REALTIME: sumar las tablas del vivo a la publicación
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches') then
      alter publication supabase_realtime add table public.matches;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events') then
      alter publication supabase_realtime add table public.match_events;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_sheets') then
      alter publication supabase_realtime add table public.match_sheets;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_officials') then
      alter publication supabase_realtime add table public.match_officials;
    end if;
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------
-- VERIFICACIÓN (compará con la guía)
-- ---------------------------------------------------------------------
select 'tablas nuevas' as chequeo, count(*)::int as esperado_1
from pg_tables
where schemaname = 'public' and tablename = 'match_officials'
union all
select 'columnas matches nuevas', count(*)::int
from information_schema.columns
where table_schema = 'public' and table_name = 'matches'
  and column_name in ('live_status','duracion_tiempo_min','duracion_entretiempo_min',
    'reloj_iniciado_at','reloj_segundos_base','reloj_corriendo','motivo_estado',
    'ausente_team_id','color_local','color_visitante','figura_player_id','en_vivo_desde','avisos')
union all
select 'columnas match_sheets nuevas', count(*)::int
from information_schema.columns
where table_schema = 'public' and table_name = 'match_sheets'
  and column_name in ('observaciones','cuerpo_tecnico','staff_confirmado','firmas',
    'votos_figura','capitan_local_id','capitan_visitante_id','cerrada_por','cerrada_at')
union all
select 'columnas match_events nuevas', count(*)::int
from information_schema.columns
where table_schema = 'public' and table_name = 'match_events'
  and column_name in ('tiempo','minuto_total','asistente_id')
union all
select 'bucket firmas', count(*)::int
from storage.buckets where id = 'firmas-planillas'
union all
select 'rpcs publicos', count(*)::int
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('obtener_transmision_publica','obtener_partidos_en_vivo');
-- Esperado: tablas nuevas=1 · matches=13 · sheets=9 · events=3 · bucket=1 · rpcs=2
