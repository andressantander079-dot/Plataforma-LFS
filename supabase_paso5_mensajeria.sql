-- =============================================================================
-- PLATAFORMA LFS — PASO 5: MENSAJERÍA PREMIUM
-- Chat privado Federación ↔ cada club, en tiempo real.
-- Incluye: tablas, índices, RLS (seguridad), Realtime y bucket de adjuntos.
-- Ejecutar en: Supabase → SQL Editor → Run
-- Requiere haber ejecutado antes los pasos 1 al 4 (usa is_admin() y profiles.club_id)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA: conversations (una conversación por club)
-- -----------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

-- -----------------------------------------------------------------------------
-- 2. TABLA: messages
--    read_at NULL = no leído → alimenta el contador y el doble tilde.
--    Un mensaje puede ser solo texto, solo adjunto, o ambos.
-- -----------------------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  attachment_path text,
  attachment_name text,
  attachment_type text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint mensaje_con_contenido check (body is not null or attachment_path is not null)
);

create index if not exists messages_conversation_fecha_idx
  on public.messages(conversation_id, created_at);

create index if not exists messages_no_leidos_idx
  on public.messages(conversation_id) where read_at is null;

-- -----------------------------------------------------------------------------
-- 3. TRIGGER: actualizar last_message_at de la conversación
-- -----------------------------------------------------------------------------
create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists trg_touch_conversation on public.messages;
create trigger trg_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_last_message();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
--    Admin (federación): acceso total.
--    Club: solo su propia conversación y sus mensajes.
-- -----------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations
drop policy if exists "admin conversaciones" on public.conversations;
create policy "admin conversaciones"
  on public.conversations for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "club ve su conversacion" on public.conversations;
create policy "club ve su conversacion"
  on public.conversations for select
  using (club_id = (select club_id from public.profiles where id = auth.uid()));

drop policy if exists "club crea su conversacion" on public.conversations;
create policy "club crea su conversacion"
  on public.conversations for insert
  with check (club_id = (select club_id from public.profiles where id = auth.uid()));

-- messages
drop policy if exists "admin mensajes" on public.messages;
create policy "admin mensajes"
  on public.messages for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "club ve mensajes de su conversacion" on public.messages;
create policy "club ve mensajes de su conversacion"
  on public.messages for select
  using (conversation_id in (
    select id from public.conversations
     where club_id = (select club_id from public.profiles where id = auth.uid())
  ));

drop policy if exists "club envia mensajes en su conversacion" on public.messages;
create policy "club envia mensajes en su conversacion"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and conversation_id in (
      select id from public.conversations
       where club_id = (select club_id from public.profiles where id = auth.uid())
    )
  );

-- El club puede marcar como leídos los mensajes de su conversación
-- (solo actualiza read_at de mensajes que NO envió él; la lógica está en la app)
drop policy if exists "club marca leidos en su conversacion" on public.messages;
create policy "club marca leidos en su conversacion"
  on public.messages for update
  using (conversation_id in (
    select id from public.conversations
     where club_id = (select club_id from public.profiles where id = auth.uid())
  ));

-- -----------------------------------------------------------------------------
-- 5. REALTIME: habilitar la tabla messages para recibir eventos en vivo
--    (si el aviso dice que ya está habilitada, no pasa nada)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
    ) then
      alter publication supabase_realtime add table public.messages;
    end if;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. STORAGE: bucket privado para adjuntos del chat (fotos y PDF, máx. 10 MB)
--    Convención de ruta: {club_id}/{mensaje}-{nombre-archivo}
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mensajeria-adjuntos',
  'mensajeria-adjuntos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- Admin: control total del bucket
drop policy if exists "admin adjuntos mensajeria" on storage.objects;
create policy "admin adjuntos mensajeria"
  on storage.objects for all
  using (bucket_id = 'mensajeria-adjuntos' and public.is_admin())
  with check (bucket_id = 'mensajeria-adjuntos' and public.is_admin());

-- Club: solo puede subir y leer archivos dentro de la carpeta de su club
drop policy if exists "club sube adjuntos de su carpeta" on storage.objects;
create policy "club sube adjuntos de su carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'mensajeria-adjuntos'
    and (storage.foldername(name))[1] = (
      select club_id::text from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "club lee adjuntos de su carpeta" on storage.objects;
create policy "club lee adjuntos de su carpeta"
  on storage.objects for select
  using (
    bucket_id = 'mensajeria-adjuntos'
    and (storage.foldername(name))[1] = (
      select club_id::text from public.profiles where id = auth.uid()
    )
  );

-- =============================================================================
-- FIN. Verificación rápida (opcional): ejecutá esto y deben aparecer 2 tablas:
--   select tablename from pg_tables where schemaname = 'public'
--     and tablename in ('conversations', 'messages');
-- =============================================================================
