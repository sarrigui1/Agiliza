-- =====================================================================================
-- FLOWQ — Módulo de Citas Programadas opcional
--
-- `permitir_citas_programadas` decide si /checkin ofrece el flujo de "Tengo Cita
-- Programada" o entra directo al registro de turno espontáneo. Por defecto queda
-- desactivado (false): la mayoría de sedes operan solo por orden de llegada y el
-- selector de dos tarjetas es una fricción innecesaria si nunca hay citas que validar.
-- =====================================================================================

alter table public.configuraciones_globales
  add column if not exists permitir_citas_programadas boolean not null default false;
