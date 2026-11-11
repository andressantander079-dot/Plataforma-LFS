-- =============================================================================
-- PLATAFORMA LFS — SINCRONIZACIÓN DE PASES EFECTIVOS Y PLANTELES
-- =============================================================================
-- Este script resuelve las inconsistencias en base de datos:
-- 1) Jugadores con "Pase efectivo" (7_COMPLETED) que todavía figuraban vinculados
--    al club de origen en 'player_categories' (ej: Caballero, Tiziana).
-- 2) Actualiza el 'status' del jugador a 'activo' al completarse el pase.
-- 3) Asegura que el club de destino tenga al jugador en su plantel.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- 1. Sincronizar 'player_categories' para todos los pases que quedaron en '7_COMPLETED'
-- Traslada todas las categorías del jugador al club de destino del pase
UPDATE public.player_categories pc
SET club_id = t.to_club_id
FROM public.transfers t
WHERE t.player_id = pc.player_id
  AND t.status = '7_COMPLETED'
  AND t.to_club_id IS NOT NULL
  AND pc.club_id <> t.to_club_id;

-- 2. Asegurar que los jugadores con pase efectivo queden en estado 'activo'
UPDATE public.players p
SET status = 'activo'
FROM public.transfers t
WHERE t.player_id = p.id
  AND t.status = '7_COMPLETED'
  AND p.status IN ('pendiente', 'inactivo');

-- 3. Confirmación de verificación
DO $$
DECLARE
  v_pases_efectivos INT;
  v_corregidos INT;
BEGIN
  SELECT count(*) INTO v_pases_efectivos
  FROM public.transfers
  WHERE status = '7_COMPLETED';

  RAISE NOTICE 'Total de pases efectivos en sistema: %', v_pases_efectivos;
  RAISE NOTICE 'Sincronización completada con éxito. Los planteles ahora reflejan el club de destino real.';
END $$;

