-- =====================================================================================
-- FLOWQ — Permite lectura pública (anon) de `zonas`
--
-- Bug real: /display?zone=piso2 corre sin sesión (rol anon), pero la política
-- `zonas_lectura_autenticados` (0002_rls_policies.sql) solo permitía rol `authenticated`.
-- RLS no lanza error al bloquear — simplemente no devuelve filas — así que la página
-- siempre mostraba "Zona no encontrada" aunque la zona sí existiera.
--
-- El contenido de `zonas` (nombres de piso/sala, ej. "Piso 2 - Consulta Externa") no es
-- sensible — el propio código de zona ya viaja expuesto en la URL pública del display —
-- así que se abre a lectura pública, igual que ya se hizo con `llamados`.
-- =====================================================================================

drop policy if exists "zonas_lectura_autenticados" on public.zonas;

create policy "zonas_lectura_publica"
  on public.zonas for select
  using (true);

grant select on public.zonas to anon;
