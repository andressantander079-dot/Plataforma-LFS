-- =============================================================================
-- PLATAFORMA LFS — PASO 13: MENSAJERÍA PREMIUM
-- Comunicados oficiales con asunto y editor enriquecido, chat con árbitros,
-- "quién lo leyó", buscador y buzón de emails (se activa con la clave Resend).
-- Ejecutar en: Supabase → SQL Editor → Run
-- Requiere haber ejecutado antes los pasos 1 al 12 (usa is_admin() y Paso 5).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CONVERSATIONS: ahora también una conversación por ÁRBITRO
--    Un árbitro es un profile con rol 'arbitro' / 'arbitro_asistente'.
--    Regla: cada conversación tiene UN club O UN árbitro (nunca ambos).
-- -----------------------------------------------------------------------------
alter table public.conversations
  alter column club_id drop not null;

alter table public.conversations
  add column if not exists arbitro_id uuid references public.profiles(id) on delete cascade;

-- Un árbitro = una sola conversación (índice único parcial)
create unique index if not exists conversations_arbitro_unico
  on public.conversations(arbitro_id)
  where arbitro_id is not null;

-- Un club = una sola conversación (la constraint unique original ya cubre NOT NULL,
-- este índice parcial refuerza el modelo mixto club/árbitro)
create unique index if not exists conversations_club_unico
  on public.conversations(club_id)
  where club_id is not null;

-- Exactamente un participante por conversación
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'conversations_un_participante'
  ) then
    alter table public.conversations
      add constraint conversations_un_participante
      check ((club_id is not null) <> (arbitro_id is not null));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 2. MESSAGES: metadata jsonb para comunicados
--    Claves: tipo ('chat'|'comunicado'), asunto, sin_respuestas, html,
--            anuncio_id (vincula las copias de un mismo comunicado masivo
--            para poder mostrar "quién lo leyó").
-- -----------------------------------------------------------------------------
alter table public.messages
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists messages_anuncio_idx
  on public.messages((metadata->>'anuncio_id'))
  where metadata->>'anuncio_id' is not null;

-- -----------------------------------------------------------------------------
-- 3. RLS: políticas del ÁRBITRO (espejo de las del club)
-- -----------------------------------------------------------------------------
drop policy if exists "arbitro ve su conversacion" on public.conversations;
create policy "arbitro ve su conversacion"
  on public.conversations for select
  using (arbitro_id = auth.uid());

drop policy if exists "arbitro crea su conversacion" on public.conversations;
create policy "arbitro crea su conversacion"
  on public.conversations for insert
  with check (arbitro_id = auth.uid());

drop policy if exists "arbitro ve mensajes de su conversacion" on public.messages;
create policy "arbitro ve mensajes de su conversacion"
  on public.messages for select
  using (conversation_id in (
    select id from public.conversations where arbitro_id = auth.uid()
  ));

drop policy if exists "arbitro envia mensajes en su conversacion" on public.messages;
create policy "arbitro envia mensajes en su conversacion"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and conversation_id in (
      select id from public.conversations where arbitro_id = auth.uid()
    )
  );

drop policy if exists "arbitro marca leidos en su conversacion" on public.messages;
create policy "arbitro marca leidos en su conversacion"
  on public.messages for update
  using (conversation_id in (
    select id from public.conversations where arbitro_id = auth.uid()
  ));

-- Adjuntos del árbitro: carpeta "arbitro-{su user id}" (mismo patrón que clubes)
drop policy if exists "arbitro sube adjuntos de su carpeta" on storage.objects;
create policy "arbitro sube adjuntos de su carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'mensajeria-adjuntos'
    and (storage.foldername(name))[1] = 'arbitro-' || auth.uid()::text
  );

drop policy if exists "arbitro lee adjuntos de su carpeta" on storage.objects;
create policy "arbitro lee adjuntos de su carpeta"
  on storage.objects for select
  using (
    bucket_id = 'mensajeria-adjuntos'
    and (storage.foldername(name))[1] = 'arbitro-' || auth.uid()::text
  );

-- Adjuntos de COMUNICADOS: la federación sube una sola copia a "federacion/"
-- y cualquier usuario logueado la puede abrir (son documentos oficiales).
drop policy if exists "federacion adjuntos legibles" on storage.objects;
create policy "federacion adjuntos legibles"
  on storage.objects for select
  using (
    bucket_id = 'mensajeria-adjuntos'
    and (storage.foldername(name))[1] = 'federacion'
    and auth.role() = 'authenticated'
  );

-- -----------------------------------------------------------------------------
-- 4. BUZÓN DE EMAILS (outbox)
--    Cada comunicado deja acá los emails pendientes. Cuando se configure la
--    clave de Resend (paso de emails automáticos), un proceso los envía y
--    marca enviado = true. Mientras tanto quedan registrados y auditables.
-- -----------------------------------------------------------------------------
create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  email text not null,
  asunto text not null,
  cuerpo_html text not null,
  tipo text not null default 'comunicado',
  enviado boolean not null default false,
  enviado_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_notifications_pendientes_idx
  on public.email_notifications(enviado, created_at)
  where enviado = false;

alter table public.email_notifications enable row level security;

drop policy if exists "admin email notifications" on public.email_notifications;
create policy "admin email notifications"
  on public.email_notifications for all
  using (public.is_admin())
  with check (public.is_admin());

-- -----------------------------------------------------------------------------
-- 5. VERIFICACIÓN (deberías ver estos resultados)
-- -----------------------------------------------------------------------------
select 'columnas conversations' as chequeo,
       count(*)::int as encontradas, 1 as esperadas
  from information_schema.columns
 where table_schema = 'public' and table_name = 'conversations'
   and column_name = 'arbitro_id'
union all
select 'columnas messages (metadata)',
       count(*)::int, 1
  from information_schema.columns
 where table_schema = 'public' and table_name = 'messages'
   and column_name = 'metadata'
union all
select 'policies de arbitro',
       count(*)::int, 7
  from pg_policies
 where schemaname in ('public', 'storage')
   and policyname like 'arbitro %'
union all
select 'tabla email_notifications',
       count(*)::int, 1
  from information_schema.tables
 where table_schema = 'public' and table_name = 'email_notifications';
