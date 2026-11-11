-- =====================================================================
-- PLATAFORMA LFS — NÚMERO DE CAMISETA EN JUGADORES Y CONVOCATORIAS
-- =====================================================================
-- Permite que cada jugador tenga su número de camiseta predeterminado
-- en su ficha y planteles, el cual se transfiere automáticamente a cada
-- convocatoria y planilla de juego, y puede ser modificado por:
--   1) Los profesores/delegados al convocar para cada partido.
--   2) Los árbitros en la mesa de control / planilla en vivo.
-- =====================================================================

BEGIN;

-- 1. Agregar columna numero_camiseta a la tabla public.players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS numero_camiseta INT
    CHECK (numero_camiseta BETWEEN 1 AND 99);

COMMENT ON COLUMN public.players.numero_camiseta IS
  'Número de camiseta oficial del jugador (1 a 99) para convocatorias y planillas de juego.';

-- 2. Asegurar que match_sheet_players tenga la columna numero_camiseta
ALTER TABLE public.match_sheet_players
  ADD COLUMN IF NOT EXISTS numero_camiseta INT
    CHECK (numero_camiseta BETWEEN 1 AND 99);

-- 3. Actualizar procedimiento RPC inscribir_jugador_club para aceptar p_numero_camiseta
CREATE OR REPLACE FUNCTION public.inscribir_jugador_club(
  p_player_id UUID,
  p_dni TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_fecha_nacimiento DATE,
  p_foto_path TEXT,
  p_category_ids UUID[],
  p_numero_camiseta INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id UUID;
  v_player_id UUID;
  v_cat_id UUID;
  v_existing_club_id UUID;
  v_existing_club_name TEXT;
  v_birth_year INT;
  v_cat RECORD;
  v_sugerida_id UUID;
  v_sugerida_name TEXT;
  v_sugerida_hierarchy INT;
BEGIN
  -- 1. Verificar sesión y obtener el club_id del usuario autenticado
  SELECT club_id INTO v_club_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_club_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No autorizado: usuario sin club asignado o sesión inválida.'
    );
  END IF;

  -- 2. Validaciones básicas de entrada
  IF p_dni IS NULL OR trim(p_dni) = '' OR NOT (trim(p_dni) ~ '^[0-9]{6,10}$') THEN
    RETURN jsonb_build_object('success', false, 'error', 'El DNI debe tener entre 6 y 10 dígitos numéricos.');
  END IF;

  IF p_first_name IS NULL OR trim(p_first_name) = '' OR p_last_name IS NULL OR trim(p_last_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nombre y apellido son obligatorios.');
  END IF;

  IF p_fecha_nacimiento IS NULL OR p_fecha_nacimiento > CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'La fecha de nacimiento no es válida o es futura.');
  END IF;

  IF array_length(p_category_ids, 1) IS NULL OR array_length(p_category_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Debe seleccionar al menos una categoría.');
  END IF;

  IF p_numero_camiseta IS NOT NULL AND (p_numero_camiseta < 1 OR p_numero_camiseta > 99) THEN
    RETURN jsonb_build_object('success', false, 'error', 'El número de camiseta debe estar entre 1 y 99.');
  END IF;

  -- 3. Validar si el DNI ya existe en el sistema
  SELECT id INTO v_player_id
  FROM public.players
  WHERE dni = trim(p_dni);

  IF v_player_id IS NOT NULL THEN
    SELECT pc.club_id, c.name INTO v_existing_club_id, v_existing_club_name
    FROM public.player_categories pc
    JOIN public.clubs c ON c.id = pc.club_id
    WHERE pc.player_id = v_player_id
    LIMIT 1;

    IF v_existing_club_id IS NOT NULL THEN
      IF v_existing_club_id = v_club_id THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'El jugador con DNI ' || p_dni || ' ya se encuentra inscripto en tu club.'
        );
      ELSE
        RETURN jsonb_build_object(
          'success', false,
          'code', 'REQUIRES_TRANSFER',
          'existing_club_id', v_existing_club_id,
          'existing_club_name', v_existing_club_name,
          'error', 'El jugador pertenece a ' || v_existing_club_name || '. Debe iniciarse un trámite de pase.'
        );
      END IF;
    END IF;
  END IF;

  -- 4. Validación de jerarquía y edad (por año de nacimiento)
  v_birth_year := EXTRACT(YEAR FROM p_fecha_nacimiento)::INT;

  SELECT id, name, level_hierarchy INTO v_sugerida_id, v_sugerida_name, v_sugerida_hierarchy
  FROM public.categories
  WHERE anio_desde IS NOT NULL 
    AND anio_hasta IS NOT NULL
    AND v_birth_year BETWEEN anio_desde AND anio_hasta
  LIMIT 1;

  IF v_sugerida_id IS NOT NULL THEN
    FOR v_cat IN 
      SELECT id, name, level_hierarchy 
      FROM public.categories 
      WHERE id = ANY(p_category_ids)
    LOOP
      IF v_cat.level_hierarchy < v_sugerida_hierarchy THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Por su año de nacimiento (' || v_birth_year || '), el jugador no puede competir en ' || v_cat.name || '. Su categoría base es ' || v_sugerida_name || '.'
        );
      END IF;
    END LOOP;

    IF NOT (p_category_ids @> ARRAY[v_sugerida_id]) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Por su año de nacimiento (' || v_birth_year || '), debe inscribirlo obligatoriamente en ' || v_sugerida_name || ' como categoría base.'
      );
    END IF;
  END IF;

  -- 5. Creación o actualización del jugador (quedando en estado 'pendiente')
  IF v_player_id IS NULL THEN
    v_player_id := COALESCE(p_player_id, gen_random_uuid());
    
    INSERT INTO public.players (
      id,
      dni,
      first_name,
      last_name,
      fecha_nacimiento,
      foto_path,
      numero_camiseta,
      status,
      created_at
    ) VALUES (
      v_player_id,
      trim(p_dni),
      trim(p_first_name),
      trim(p_last_name),
      p_fecha_nacimiento,
      p_foto_path,
      p_numero_camiseta,
      'pendiente',
      now()
    );
  ELSE
    UPDATE public.players
    SET first_name = trim(p_first_name),
        last_name = trim(p_last_name),
        fecha_nacimiento = p_fecha_nacimiento,
        foto_path = COALESCE(p_foto_path, foto_path),
        numero_camiseta = COALESCE(p_numero_camiseta, numero_camiseta),
        status = 'pendiente'
    WHERE id = v_player_id;
  END IF;

  -- 6. Vinculación en player_categories
  FOREACH v_cat_id IN ARRAY p_category_ids
  LOOP
    INSERT INTO public.player_categories (player_id, category_id, club_id, created_at)
    VALUES (v_player_id, v_cat_id, v_club_id, now())
    ON CONFLICT (player_id, category_id) DO UPDATE
    SET club_id = v_club_id;
  END LOOP;

  -- 7. Registro de auditoría
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, module, new_data)
    VALUES (
      auth.uid(),
      'INSCRIPCION_JUGADOR_PENDIENTE',
      'planteles',
      jsonb_build_object('player_id', v_player_id, 'dni', p_dni, 'club_id', v_club_id, 'categories', p_category_ids, 'numero_camiseta', p_numero_camiseta, 'status', 'pendiente')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'status', 'pendiente',
    'numero_camiseta', p_numero_camiseta
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscribir_jugador_club(UUID, TEXT, TEXT, TEXT, DATE, TEXT, UUID[], INT) TO authenticated;

-- 4. Actualizar club_actualizar_jugador para permitir modificar el número de camiseta
CREATE OR REPLACE FUNCTION public.club_actualizar_jugador(
  p_player_id uuid,
  p_fecha_nacimiento date default null,
  p_foto_path text default null,
  p_documents jsonb default null,
  p_numero_camiseta int default null
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_es_duenio boolean;
BEGIN
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
    FROM public.player_categories pc
    WHERE pc.player_id = p_player_id
      AND pc.club_id = public.mi_club_id()
  ) INTO v_es_duenio;

  IF NOT v_es_duenio THEN
    SELECT public.is_admin() OR (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'club')
      AND NOT EXISTS (SELECT 1 FROM public.player_categories pc WHERE pc.player_id = p_player_id)
    ) INTO v_es_duenio;
  END IF;

  IF NOT v_es_duenio THEN
    RETURN '⛔ No tenés permiso para modificar este jugador.';
  END IF;

  UPDATE public.players
  SET fecha_nacimiento = COALESCE(p_fecha_nacimiento, fecha_nacimiento),
      foto_path = COALESCE(p_foto_path, foto_path),
      numero_camiseta = CASE 
        WHEN p_numero_camiseta IS NOT NULL THEN p_numero_camiseta 
        ELSE numero_camiseta 
      END,
      documents = CASE
        WHEN p_documents IS NULL THEN documents
        ELSE COALESCE(documents, '{}'::jsonb) || p_documents
      END
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN '⛔ El jugador no existe.';
  END IF;

  RETURN 'OK';
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_actualizar_jugador(uuid, date, text, jsonb, int) TO authenticated;

COMMIT;

