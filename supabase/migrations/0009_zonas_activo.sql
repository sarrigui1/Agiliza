-- =====================================================================================
-- FLOWQ — Módulo de Gestión de Infraestructura Operativa
-- `zonas` no tenía forma de desactivarse (a diferencia de `especialidades`, que ya
-- traía `activo` desde 0001). Se necesita para el toggle Activa/Inactiva del admin.
-- =====================================================================================

alter table public.zonas
  add column if not exists activo boolean not null default true;
