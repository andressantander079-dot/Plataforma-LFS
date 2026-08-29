-- =============================================================================
-- PLATAFORMA LFS — PASO 10: PANEL DE CONFIGURACIÓN Y ASSETS (ENTERPRISE v4.0)
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Es completamente idempotente (seguro de correr múltiples veces)
-- =============================================================================

-- 1. TABLA DE AUDITORÍA (DDL Defensivo e Idempotente)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Solo administradores leen audit_logs" ON public.audit_logs;
CREATE POLICY "Solo administradores leen audit_logs" 
ON public.audit_logs FOR SELECT TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Usuarios autenticados insertan audit_logs" ON public.audit_logs;
CREATE POLICY "Usuarios autenticados insertan audit_logs" 
ON public.audit_logs FOR INSERT TO authenticated 
WITH CHECK (true);

-- 2. FUNCIÓN DE AUTORIZACIÓN IS_ADMIN (Idempotente & Security Definer)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 3. TABLA SINGLETON LEAGUE_SETTINGS
CREATE TABLE IF NOT EXISTS public.league_settings (
  id INT PRIMARY KEY DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{
    "identity": {
      "name": "Liga de Fútsal de Ushuaia",
      "short_name": "LFS",
      "season": "2026",
      "slogan": "Portal Oficial de Gestión Deportiva • Ushuaia, Tierra del Fuego",
      "logo_url": null,
      "address": "Gdor. Paz 742, Ushuaia, Tierra del Fuego",
      "phone": "+54 2901 445566",
      "email": "contacto@ligafutsalushuaia.com",
      "social_instagram": "@ligafutsalushuaia",
      "social_facebook": "Liga de Futsal Ushuaia",
      "social_youtube": "LFS Ushuaia Play"
    },
    "announcement": {
      "active": false,
      "message": "",
      "type": "info",
      "link_url": null
    },
    "discipline": {
      "currency": "ARS",
      "points_win": 3,
      "points_draw": 1,
      "points_loss": 0,
      "tiebreaker": "diferencia_gol",
      "wo_home_goals": 5,
      "wo_away_goals": 0,
      "yellow_cards_suspension": 5,
      "accumulated_fouls_limit": 5,
      "match_duration_minutes": 20,
      "timeouts_per_period": 1,
      "red_card_fine": 8500,
      "match_protest_fee": 15000,
      "interclub_transfer_fee": 12000
    },
    "transfers": {
      "window_status": "abierto",
      "window_start_date": "2026-02-01",
      "window_end_date": "2026-04-30",
      "max_players_per_roster": 25,
      "tenencia_anios": 2,
      "recargo_rescision": 1.5,
      "alerta_trabado_horas": 48,
      "cancelacion_trabado_horas": 120,
      "require_player_signature": true
    }
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row_check CHECK (id = 1)
);

-- Insertar la fila singleton 1 si aún no existe
INSERT INTO public.league_settings (id, updated_at)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.league_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lectura publica league_settings" ON public.league_settings;
CREATE POLICY "lectura publica league_settings" 
ON public.league_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin modifica league_settings" ON public.league_settings;
CREATE POLICY "admin modifica league_settings" 
ON public.league_settings FOR ALL TO authenticated 
USING (public.is_admin()) 
WITH CHECK (public.is_admin());

-- 4. PROCEDIMIENTO RPC CON p_path TEXT[] Y REGISTRO EN AUDIT_LOGS
CREATE OR REPLACE FUNCTION public.actualizar_configuracion_path(
  p_path TEXT[],
  p_valores JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado: solo administradores pueden modificar la configuración.';
  END IF;

  SELECT data INTO v_old_data FROM public.league_settings WHERE id = 1;

  -- Actualización atómica en la ruta exacta especificada
  UPDATE public.league_settings
  SET data = jsonb_set(COALESCE(data, '{}'::jsonb), p_path, p_valores, true),
      updated_at = now()
  WHERE id = 1
  RETURNING data INTO v_new_data;

  -- Registro en audit_logs
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, module, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE_CONFIG_PATH_' || array_to_string(p_path, '_'),
      'configuracion',
      jsonb_extract_path(v_old_data, VARIADIC p_path),
      p_valores
    );
  EXCEPTION WHEN OTHERS THEN
    -- Respaldo defensivo
  END;

  RETURN v_new_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.actualizar_configuracion_path TO authenticated;

-- 5. TABLA SPONSORS (Patrocinadores Comerciales)
CREATE TABLE IF NOT EXISTS public.sponsors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  website_url TEXT,
  tier TEXT NOT NULL DEFAULT 'oro' 
    CHECK (tier IN ('main', 'platino', 'oro', 'plata', 'bronce', 'partner')),
  display_locations TEXT[] NOT NULL DEFAULT ARRAY['home', 'fixture', 'footer']::TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lectura publica sponsors" ON public.sponsors;
CREATE POLICY "lectura publica sponsors" ON public.sponsors FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin modifica sponsors" ON public.sponsors;
CREATE POLICY "admin modifica sponsors" ON public.sponsors FOR ALL TO authenticated 
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. EXTENSIONES A CATEGORIES Y VENUES (Soft-Deactivate & Metadatos)
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS level_hierarchy INT4 DEFAULT 1,
ADD COLUMN IF NOT EXISTS anio_desde INT4,
ADD COLUMN IF NOT EXISTS anio_hasta INT4;

ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS capacity INT4 DEFAULT 500,
ADD COLUMN IF NOT EXISTS surface TEXT DEFAULT 'parquet';

-- 7. BUCKET PÚBLICO LEAGUE-ASSETS EN SUPABASE STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'league-assets',
  'league-assets',
  true,
  2097152, -- 2 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

DROP POLICY IF EXISTS "Lectura publica assets liga" ON storage.objects;
CREATE POLICY "Lectura publica assets liga" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'league-assets');

DROP POLICY IF EXISTS "Admin sube assets liga" ON storage.objects;
CREATE POLICY "Admin sube assets liga" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'league-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admin actualiza assets liga" ON storage.objects;
CREATE POLICY "Admin actualiza assets liga" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (bucket_id = 'league-assets' AND public.is_admin())
WITH CHECK (bucket_id = 'league-assets' AND public.is_admin());

DROP POLICY IF EXISTS "Admin elimina assets liga" ON storage.objects;
CREATE POLICY "Admin elimina assets liga" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (bucket_id = 'league-assets' AND public.is_admin());

-- =============================================================================
-- FIN PASO 10. Verificación en Supabase:
-- select * from public.league_settings;
-- select * from public.sponsors;
-- =============================================================================
