-- =====================================================================
-- PASO 4: REPRESENTANTES DE CLUBES + USUARIOS CON ACCESO
-- =====================================================================
-- Ejecutar DESPUÉS de los scripts de los Pasos 1, 2 y 3.
--
-- ¿Qué hace?
-- 1. Crea la tabla club_representatives: los representantes extra de
--    cada club (delegados, secretarios, etc.) que el admin carga con "+".
-- 2. Agrega a profiles: club_id (a qué club pertenece el usuario) y
--    email (para poder mostrarlo en los paneles).
-- 3. Actualiza el trigger de altas para guardar también el email.
-- =====================================================================

-- 1. TABLA DE REPRESENTANTES EXTRA DEL CLUB
CREATE TABLE IF NOT EXISTS public.club_representatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dni text NOT NULL,
  phone text NOT NULL,
  cargo text NOT NULL DEFAULT 'Delegado',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_representatives ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura representantes: admin o el propio club" ON public.club_representatives;
CREATE POLICY "Lectura representantes: admin o el propio club"
ON public.club_representatives FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR club_id = (SELECT club_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "Solo admin gestiona representantes" ON public.club_representatives;
CREATE POLICY "Solo admin gestiona representantes"
ON public.club_representatives FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 2. PROFILES: vínculo con club + email visible
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email text;

CREATE INDEX IF NOT EXISTS idx_profiles_club ON public.profiles(club_id);

-- 3. TRIGGER ACTUALIZADO: guarda también el email del usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Sin nombre'),
    'club',
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 4. BACKFILL: completa el email de los perfiles que ya existían
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- =====================================================================
-- Verificación:
--   SELECT id, full_name, role, email, club_id FROM public.profiles;
--   SELECT * FROM public.club_representatives;
-- =====================================================================
