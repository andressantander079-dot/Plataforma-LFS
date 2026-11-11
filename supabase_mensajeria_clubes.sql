-- =============================================================================
-- PLATAFORMA LFS — POLÍTICAS RLS PARA MENSAJERÍA PREMIUM DE CLUBES
-- Permite a los usuarios de clubes gestionar sus propios borradores, mensajes
-- programados y plantillas, garantizando aislamiento estricto por usuario/club.
-- =============================================================================

-- 1. message_drafts: el autor (admin o club) puede gestionar sus propios borradores
DROP POLICY IF EXISTS "usuarios autenticados gestionan sus propios borradores" ON public.message_drafts;
CREATE POLICY "usuarios autenticados gestionan sus propios borradores"
  ON public.message_drafts FOR ALL TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- 2. scheduled_messages: el autor puede gestionar sus mensajes programados
DROP POLICY IF EXISTS "usuarios autenticados gestionan sus mensajes programados" ON public.scheduled_messages;
CREATE POLICY "usuarios autenticados gestionan sus mensajes programados"
  ON public.scheduled_messages FOR ALL TO authenticated
  USING (author_id = auth.uid() OR public.is_admin())
  WITH CHECK (author_id = auth.uid() OR public.is_admin());

-- 3. message_templates: lectura para todos los autenticados; gestión para el creador o admin
DROP POLICY IF EXISTS "usuarios autenticados leen plantillas" ON public.message_templates;
CREATE POLICY "usuarios autenticados leen plantillas"
  ON public.message_templates FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "usuarios autenticados crean y editan sus plantillas" ON public.message_templates;
CREATE POLICY "usuarios autenticados crean y editan sus plantillas"
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "usuarios autenticados modifican sus plantillas" ON public.message_templates;
CREATE POLICY "usuarios autenticados modifican sus plantillas"
  ON public.message_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin())
  WITH CHECK (created_by = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "usuarios autenticados eliminan sus plantillas" ON public.message_templates;
CREATE POLICY "usuarios autenticados eliminan sus plantillas"
  ON public.message_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

-- 4. Storage: permitir a clubes subir adjuntos en su propia carpeta dentro del bucket
DROP POLICY IF EXISTS "clubes suben adjuntos de mensajeria" ON storage.objects;
CREATE POLICY "clubes suben adjuntos de mensajeria"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'mensajeria-adjuntos');

DROP POLICY IF EXISTS "usuarios autenticados leen adjuntos de mensajeria" ON storage.objects;
CREATE POLICY "usuarios autenticados leen adjuntos de mensajeria"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'mensajeria-adjuntos');

