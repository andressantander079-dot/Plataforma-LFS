-- =====================================================================
-- ESQUEMA FÍSICO DE BASE DE DATOS - PLATAFORMA LFS v3.0
-- =====================================================================
-- Copia y pega este script en el editor SQL de tu Supabase Dashboard
-- (https://supabase.com/dashboard/project/jojgamsslpqdqamdiuqo/sql/new)
-- =====================================================================

-- Habilitar extensión UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TIPOS ENUM
CREATE TYPE user_role AS ENUM ('admin', 'club', 'arbitro', 'arbitro_asistente');
CREATE TYPE club_status AS ENUM ('inhabilitado', 'en_revision', 'habilitado');
CREATE TYPE player_status AS ENUM ('activo', 'inactivo');
CREATE TYPE transfer_status AS ENUM (
  '1_INIT_CLUB_A', 
  '2_FVF_REVIEW', 
  '3_NOTIFY_CLUB_B', 
  '4_CLUB_B_DECISION', 
  '5_PLAYER_SIGNATURE', 
  '6_FINAL_AUDIT', 
  '7_COMPLETED'
);

-- 2. TABLA DE PERFILES (Vinculada a auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'club',
  full_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. TABLA DE CLUBES
CREATE TABLE clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  president_dni text NOT NULL,
  president_phone text NOT NULL,
  treasurer_dni text NOT NULL,
  treasurer_phone text NOT NULL,
  status club_status NOT NULL DEFAULT 'inhabilitado',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. TABLA DE JUGADORES (DNI ÚNICO)
CREATE TABLE players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dni text UNIQUE NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  status player_status NOT NULL DEFAULT 'activo',
  documents jsonb NOT NULL DEFAULT '{}'::jsonb, -- Checklist de documentos
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. TABLA DE CATEGORÍAS (JERARQUÍA NUMÉRICA)
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  level_hierarchy int4 UNIQUE NOT NULL, -- Nivel numérico jerárquico (1: Sub-14, 4: Primera)
  gender text NOT NULL, -- 'masculino', 'femenino', 'mixto'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. TABLA INTERMEDIA: JUGADORES Y CATEGORÍAS (Relación M:M)
CREATE TABLE player_categories (
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, category_id)
);

-- 7. TABLA DE PARTIDOS (MATCHES)
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL,
  date timestamptz NOT NULL,
  home_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL,
  away_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL,
  referee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  score_home int4 DEFAULT 0,
  score_away int4 DEFAULT 0,
  status text NOT NULL DEFAULT 'programado'
);

-- 8. TABLA DE PLANILLAS DE PARTIDO (CON CONTADORES DE TARJETAS INDEPENDIENTES)
CREATE TABLE match_sheets (
  id uuid PRIMARY KEY REFERENCES matches(id) ON DELETE CASCADE,
  yellow_cards int4 NOT NULL DEFAULT 0,
  red_cards int4 NOT NULL DEFAULT 0,
  double_yellows int4 NOT NULL DEFAULT 0,
  sheet_data jsonb NOT NULL DEFAULT '{}'::jsonb, -- courtPlayers, events, signatures
  validation_qr_code text,
  hash text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. TABLA DE TRANSFERENCIAS / PASES
CREATE TABLE transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  from_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL,
  to_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL,
  status transfer_status NOT NULL DEFAULT '1_INIT_CLUB_A',
  approved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 10. TABLA DE LOGS DE AUDITORÍA
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 12. POLÍTICAS RLS (EJEMPLOS BASE)

-- Profiles: Lectura para todos los autenticados.
CREATE POLICY "Permitir lectura de perfiles a usuarios autenticados" 
ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permitir actualizar perfil propio" 
ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Clubs: Lectura pública. Escritura solo Administrador.
CREATE POLICY "Permitir lectura publica de clubes" 
ON clubs FOR SELECT USING (true);

CREATE POLICY "Solo administradores pueden crear o modificar clubes" 
ON clubs FOR ALL TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- Players: Solo administradores y clubes pueden ver/crear jugadores de su propio club.
CREATE POLICY "Lectura de jugadores para administradores y su club" 
ON players FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ) OR 
  id IN (
    SELECT player_id FROM player_categories 
    WHERE club_id IN (
      -- Asumiendo mapeo en metadata de profile o similar. Ajustar segun convenga.
      SELECT id FROM clubs 
    )
  )
);

-- Audit Logs: Solo Administradores.
CREATE POLICY "Solo administradores pueden leer logs de auditoria" 
ON audit_logs FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

CREATE POLICY "Cualquier usuario puede insertar logs de auditoria" 
ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);
