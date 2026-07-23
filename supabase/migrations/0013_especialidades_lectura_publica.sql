-- =====================================================================================
-- FLOWQ — Permite lectura pública (anon) de `especialidades`
--
-- Mismo bug real que 0010_zonas_lectura_publica.sql: /checkin corre sin sesión (rol
-- anon), pero la política `especialidades_lectura_autenticados` (0002_rls_policies.sql)
-- solo permitía rol `authenticated`. RLS no lanza error al bloquear — simplemente no
-- devuelve filas — así que el selector de especialidad en el tótem de auto-servicio
-- siempre aparecía vacío aunque las especialidades existieran y estuvieran activas.
--
-- Solo se exponen las especialidades activas al público (a diferencia de `zonas`, cuyo
-- código de zona ya viaja en la URL); el catálogo completo sigue restringido a personal
-- autenticado vía `especialidades_admin_escribe`.
-- =====================================================================================

drop policy if exists "especialidades_lectura_autenticados" on public.especialidades;

create policy "especialidades_lectura_autenticados"
  on public.especialidades for select
  to authenticated
  using (true);

create policy "especialidades_lectura_publica_activas"
  on public.especialidades for select
  to anon
  using (activo = true);

grant select on public.especialidades to anon;
