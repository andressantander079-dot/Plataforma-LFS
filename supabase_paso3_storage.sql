-- =====================================================================
-- PASO 3: DOCUMENTOS DE JUGADORES - SUPABASE STORAGE
-- =====================================================================
-- Ejecutar DESPUÉS de los scripts de los Pasos 1 y 2.
--
-- ¿Qué hace?
-- 1. Crea el bucket (contenedor de archivos) "documentos-jugadores",
--    PRIVADO: solo el admin puede subir y ver archivos.
-- 2. Limita el tamaño a 5MB y los formatos a PDF/JPG/PNG.
-- 3. Crea las políticas de seguridad del bucket.
-- =====================================================================

-- 1. BUCKET PRIVADO
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos-jugadores',
  'documentos-jugadores',
  false,
  5242880, -- 5 MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DEL BUCKET (solo admin)

DROP POLICY IF EXISTS "Admin sube documentos de jugadores" ON storage.objects;
CREATE POLICY "Admin sube documentos de jugadores"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos-jugadores' AND public.is_admin());

DROP POLICY IF EXISTS "Admin lee documentos de jugadores" ON storage.objects;
CREATE POLICY "Admin lee documentos de jugadores"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos-jugadores' AND public.is_admin());

DROP POLICY IF EXISTS "Admin reemplaza documentos de jugadores" ON storage.objects;
CREATE POLICY "Admin reemplaza documentos de jugadores"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos-jugadores' AND public.is_admin())
WITH CHECK (bucket_id = 'documentos-jugadores' AND public.is_admin());

-- =====================================================================
-- Verificación: en Supabase → Storage tiene que aparecer el bucket
-- "documentos-jugadores" con el candado de privado.
-- =====================================================================
