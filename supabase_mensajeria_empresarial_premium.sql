-- =============================================================================
-- PLATAFORMA LFS — EVOLUCIÓN MÓDULO PREMIUM DE COMUNICACIONES Y MENSAJERÍA
-- Motor: PostgreSQL (Supabase)
-- Características: Idempotente, sin pérdida de datos, con políticas RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLA DE PLANTILLAS DE MENSAJES (message_templates)
--    Almacena plantillas reutilizables organizadas por categoría.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text NOT NULL DEFAULT 'Institucional',
  asunto_sugerido text NOT NULL DEFAULT '',
  cuerpo_html text NOT NULL,
  prioridad_sugerida text NOT NULL DEFAULT 'normal'
    CHECK (prioridad_sugerida IN ('normal', 'importante', 'urgente')),
  sin_respuestas_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_templates_categoria
  ON public.message_templates(categoria);

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gestiona plantillas de mensajes" ON public.message_templates;
CREATE POLICY "admin gestiona plantillas de mensajes"
  ON public.message_templates FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 2. TABLA DE BORRADORES DE MENSAJES (message_drafts)
--    Soporta guardado automático y manual con fecha de última modificación.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.message_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asunto text NOT NULL DEFAULT '',
  cuerpo_html text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'Institucional',
  prioridad text NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('normal', 'importante', 'urgente')),
  sin_respuestas boolean NOT NULL DEFAULT false,
  destinatarios jsonb NOT NULL DEFAULT '{"todosClubes": false, "todosArbitros": false, "clubes": [], "arbitros": []}'::jsonb,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  es_autoguardado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_drafts_author_updated
  ON public.message_drafts(author_id, updated_at DESC);

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gestiona sus borradores" ON public.message_drafts;
CREATE POLICY "admin gestiona sus borradores"
  ON public.message_drafts FOR ALL TO authenticated
  USING (public.is_admin() AND author_id = auth.uid())
  WITH CHECK (public.is_admin() AND author_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. TABLA DE MENSAJES PROGRAMADOS (scheduled_messages)
--    Permite programar envíos a futuro, editarlos o cancelarlos antes de salir.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asunto text NOT NULL,
  cuerpo_html text NOT NULL,
  categoria text NOT NULL DEFAULT 'Institucional',
  prioridad text NOT NULL DEFAULT 'normal'
    CHECK (prioridad IN ('normal', 'importante', 'urgente')),
  sin_respuestas boolean NOT NULL DEFAULT false,
  destinatarios jsonb NOT NULL,
  adjuntos jsonb NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Argentina/Ushuaia',
  estado text NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'enviado', 'cancelado', 'error')),
  anuncio_id uuid,
  enviado_at timestamptz,
  error_detalle text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pendientes
  ON public.scheduled_messages(scheduled_for)
  WHERE estado = 'pendiente';

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gestiona mensajes programados" ON public.scheduled_messages;
CREATE POLICY "admin gestiona mensajes programados"
  ON public.scheduled_messages FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- 4. ÍNDICES ADICIONALES SOBRE public.messages (SIN ALTERAR DATOS EXISTENTES)
--    Acelera filtros por prioridad y categoría en comunicados oficiales.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS messages_prioridad_idx
  ON public.messages((metadata->>'prioridad'))
  WHERE metadata->>'prioridad' IS NOT NULL;

CREATE INDEX IF NOT EXISTS messages_categoria_idx
  ON public.messages((metadata->>'categoria'))
  WHERE metadata->>'categoria' IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 5. ACTUALIZACIÓN DE BUCKET mensajeria-adjuntos (10 MB, JPG/JPEG/PNG/WEBP/PDF)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mensajeria-adjuntos',
  'mensajeria-adjuntos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];

-- -----------------------------------------------------------------------------
-- 6. SEMILLA INICIAL DE PLANTILLAS OFICIALES DE LA LIGA (Opcional e Idempotente)
-- -----------------------------------------------------------------------------
INSERT INTO public.message_templates (nombre, categoria, asunto_sugerido, cuerpo_html, prioridad_sugerida, sin_respuestas_default)
SELECT
  'Citación a Reunión de Delegados',
  'Institucional',
  'Citación Oficial — Reunión de Consejo de Delegados',
  '<p>Estimados delegados:</p><p>Por medio de la presente se convoca a los representantes de todos los clubes afiliados a la <strong>Reunión Ordinaria de Delegados</strong>.</p><ul><li><strong>Fecha y hora:</strong> [Completar fecha y hora]</li><li><strong>Lugar:</strong> Sede de la Liga de Fútsal de Ushuaia</li><li><strong>Temario:</strong> Programación de la fecha y asuntos reglamentarios.</li></ul><p>Se recuerda que la asistencia es de carácter obligatorio.</p>',
  'importante',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates WHERE nombre = 'Citación a Reunión de Delegados'
);

INSERT INTO public.message_templates (nombre, categoria, asunto_sugerido, cuerpo_html, prioridad_sugerida, sin_respuestas_default)
SELECT
  'Suspensión de Jornada por Clima / Fuerza Mayor',
  'Torneo y Fixture',
  'URGENTE: Suspensión de partidos programados',
  '<p><strong>COMUNICADO DE MESA DIRECTIVA</strong></p><p>Se informa a todos los clubes y cuerpo arbitral que la jornada programada para el día <strong>[Completar fecha]</strong> queda <strong>SUSPENDIDA</strong> debido a [motivo climático / operativo].</p><p>La reprogramación oficial será publicada a la brevedad en el módulo de Competencias.</p>',
  'urgente',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates WHERE nombre = 'Suspensión de Jornada por Clima / Fuerza Mayor'
);

INSERT INTO public.message_templates (nombre, categoria, asunto_sugerido, cuerpo_html, prioridad_sugerida, sin_respuestas_default)
SELECT
  'Recordatorio de Vencimiento de Tesorería',
  'Tesorería y Aranceles',
  'Aviso de vencimiento — Regularización de aranceles federativos',
  '<p>Estimada institución:</p><p>Les recordamos que el próximo <strong>[Completar fecha]</strong> opera el vencimiento para la regularización de cargos pendientes en Tesorería.</p><p>Pueden adjuntar los comprobantes de transferencia directamente desde el módulo de Finanzas o responder a este canal oficial.</p>',
  'normal',
  false
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates WHERE nombre = 'Recordatorio de Vencimiento de Tesorería'
);

