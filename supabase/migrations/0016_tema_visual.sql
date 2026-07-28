-- =====================================================================================
-- FLOWQ — Modo claro (Light Mode) opcional, configurable a nivel de sede
--
-- `tema_visual` decide la paleta de TODA la aplicación (TV, check-in, workspace, panel
-- admin) — es una preferencia de sede, no de usuario individual, consistente con el
-- resto de `configuraciones_globales`. Por defecto queda 'oscuro' (el único modo que
-- existía hasta ahora) para no cambiar la apariencia de ningún despliegue existente sin
-- que un admin lo elija explícitamente.
-- =====================================================================================

create type tema_visual as enum ('oscuro', 'claro');

alter table public.configuraciones_globales
  add column if not exists tema_visual tema_visual not null default 'oscuro';
