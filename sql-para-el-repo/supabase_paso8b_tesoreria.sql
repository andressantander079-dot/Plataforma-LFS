-- ============================================================================
-- PLATAFORMA LFS · PASO 8B — TESORERÍA (gastos, reportes y cierre de caja)
-- Complemento del 8A: las tablas ya existen; acá solo se agrega la
-- referencia al club en los gastos (para registrar DEVOLUCIONES).
-- Idempotente: se puede ejecutar más de una vez.
-- ============================================================================

alter table public.treasury_expenses
  add column if not exists club_id uuid references public.clubs(id);

create index if not exists expenses_fecha_idx on public.treasury_expenses (fecha);
