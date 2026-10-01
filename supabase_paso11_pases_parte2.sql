-- ============================================================================
-- PLATAFORMA LFS — PASO 11 (Pases 9B Parte 2)
-- Permisos finales para las pantallas nuevas:
--   · /transferencias (pública) llama a la función pases_publicos() sin login
--   · la evidencia de firma usa obtenerUrlDocumentoPase (bucket documentos-pases)
-- Todo es idempotente: se puede correr más de una vez sin romper nada.
-- ============================================================================

-- 1) La página pública /transferencias (rol anon) y los paneles (authenticated)
--    tienen permiso explícito de ejecutar las funciones del mercado de pases.
grant execute on function public.pases_publicos() to anon, authenticated;
grant execute on function public.hay_ventana_pases() to anon, authenticated;

-- 2) El club dueño del pase y el admin ya leen documentos-pases por policies
--    del Paso 9. Refuerzo: el admin puede leer TODAS las carpetas de firma
--    (para abrir la evidencia desde el detalle del pase).
drop policy if exists "documentos-pases: admin lee todo" on storage.objects;
create policy "documentos-pases: admin lee todo"
on storage.objects for select to authenticated
using (bucket_id = 'documentos-pases' and public.is_admin());

-- ============================================================================
-- VERIFICACIÓN FINAL — comparar con la guía:
-- ============================================================================
select 'permiso pases_publicos' as chequeo,
  count(*) as total,
  '2 esperados (anon + authenticated)' as esperado
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'pases_publicos'
  and grantee in ('anon', 'authenticated');

select 'policy admin lee documentos-pases' as chequeo,
  count(*) as total,
  '1 esperada' as esperado
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname = 'documentos-pases: admin lee todo';

select 'funciones del mercado existen' as chequeo,
  count(*) as total,
  '2 esperadas' as esperado
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('pases_publicos', 'hay_ventana_pases');
