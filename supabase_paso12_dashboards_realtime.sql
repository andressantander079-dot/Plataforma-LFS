-- =============================================================================
-- PLATAFORMA LFS — PASO 12: DASHBOARDS REALES + TIEMPO REAL
-- Ejecutar en: Supabase Dashboard → SQL Editor → Run
-- Idempotente: se puede correr varias veces sin romper nada.
--
-- Qué hace: habilita la publicación Realtime (supabase_realtime) en las
-- tablas que alimentan los dashboards, para que los paneles y las burbujas
-- de la barra inferior se actualicen solos, sin recargar la página.
-- Realtime respeta las policies RLS existentes: cada usuario solo recibe
-- cambios de filas que tiene permiso de ver.
-- =============================================================================

DO $$
DECLARE
  tablas text[] := ARRAY[
    'matches',            -- partidos: próximos, resultados, sparkline
    'match_sheets',       -- planillas: confirmaciones de convocatoria
    'transfers',          -- pases: pendientes, trabados, dictámenes
    'treasury_charges',   -- cargos: deudas del club
    'treasury_payments',  -- pagos: por aprobar (admin) / aprobados (club)
    'players',            -- jugadores: altas y documentación
    'clubs',              -- clubes: habilitaciones
    'audit_logs',         -- feed de actividad (solo admin lo recibe, por RLS)
    'player_suspensions'  -- sanciones activas
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tablas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- =============================================================================
-- VERIFICACIÓN — Debe listar las 9 tablas del paso
-- (pueden aparecer otras de pasos anteriores, no pasa nada)
-- =============================================================================
SELECT tablename AS "tabla con realtime"
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
  AND tablename IN (
    'matches','match_sheets','transfers','treasury_charges','treasury_payments',
    'players','clubs','audit_logs','player_suspensions'
  )
ORDER BY tablename;
-- Esperado: 9 filas (audit_logs, clubs, match_sheets, matches, players,
--           player_suspensions, transfers, treasury_charges, treasury_payments)
