-- ============================================================================
-- LFS PASO 9C: Inscribir Jugador desde el Panel del Club (Zero-Trust Security)
-- ============================================================================

-- 1. DDL Defensivo para asegurar columnas requeridas
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS level_hierarchy INT4 DEFAULT 1,
ADD COLUMN IF NOT EXISTS anio_desde INT4,
ADD COLUMN IF NOT EXISTS anio_hasta INT4;

ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS foto_path TEXT,
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

-- 2. Procedimiento Almacenado RPC
CREATE OR REPLACE FUNCTION public.inscribir_jugador_club(
  p_player_id UUID,
  p_dni TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_fecha_nacimiento DATE,
  p_foto_path TEXT,
  p_category_ids UUID[]
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

  -- 3. Validar si el DNI ya existe en el sistema
  SELECT id INTO v_player_id
  FROM public.players
  WHERE dni = trim(p_dni);

  IF v_player_id IS NOT NULL THEN
    -- Consultar si pertenece a otro club
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

  -- Buscar categoría base sugerida por rango de año
  SELECT id, name, level_hierarchy INTO v_sugerida_id, v_sugerida_name, v_sugerida_hierarchy
  FROM public.categories
  WHERE anio_desde IS NOT NULL 
    AND anio_hasta IS NOT NULL
    AND v_birth_year BETWEEN anio_desde AND anio_hasta
  LIMIT 1;

  -- Si existe una categoría correspondiente por edad
  IF v_sugerida_id IS NOT NULL THEN
    -- Validar que no se hayan seleccionado categorías menores a la sugerida
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

    -- Debe incluir obligatoriamente su categoría base
    IF NOT (p_category_ids @> ARRAY[v_sugerida_id]) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Por su año de nacimiento (' || v_birth_year || '), debe inscribirlo obligatoriamente en ' || v_sugerida_name || ' como categoría base.'
      );
    END IF;
  END IF;

  -- 5. Creación o actualización del jugador
  IF v_player_id IS NULL THEN
    v_player_id := COALESCE(p_player_id, gen_random_uuid());
    
    INSERT INTO public.players (
      id,
      dni,
      first_name,
      last_name,
      fecha_nacimiento,
      foto_path,
      status,
      created_at
    ) VALUES (
      v_player_id,
      trim(p_dni),
      trim(p_first_name),
      trim(p_last_name),
      p_fecha_nacimiento,
      p_foto_path,
      'activo',
      now()
    );
  ELSE
    -- Jugador libre preexistente: se actualizan datos y foto
    UPDATE public.players
    SET first_name = trim(p_first_name),
        last_name = trim(p_last_name),
        fecha_nacimiento = p_fecha_nacimiento,
        foto_path = COALESCE(p_foto_path, foto_path),
        status = 'activo'
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

  -- 7. Registro de auditoría (si existe la tabla audit_logs)
  BEGIN
    INSERT INTO public.audit_logs (user_id, action, module, new_data)
    VALUES (
      auth.uid(),
      'INSCRIPCION_JUGADOR_CLUB',
      'planteles',
      jsonb_build_object('player_id', v_player_id, 'dni', p_dni, 'club_id', v_club_id, 'categories', p_category_ids)
    );
  EXCEPTION WHEN OTHERS THEN
    -- Silencioso si audit_logs no está disponible
  END;

  RETURN jsonb_build_object(
    'success', true,
    'player_id', v_player_id,
    'message', 'Jugador inscripto correctamente en el plantel.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inscribir_jugador_club TO authenticated;
