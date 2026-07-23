-- =====================================================================================
-- FLOWQ — Modo de audio del TV Display (Tono / Voz / Tono + Voz)
--
-- También abre `configuraciones_globales` a lectura pública (anon): el TV Display corre
-- sin sesión y necesita saber qué modo de audio usar. Nada en esta tabla es sensible
-- (algoritmo de cola, tolerancias, formato de privacidad, modo de audio) — mismo
-- criterio ya aplicado a `zonas` en 0010_zonas_lectura_publica.sql.
-- =====================================================================================

create type modo_audio_tv as enum ('tono', 'voz', 'tono_voz');

alter table public.configuraciones_globales
  add column if not exists modo_audio_tv modo_audio_tv not null default 'tono_voz';

drop policy if exists "config_lectura_autenticados" on public.configuraciones_globales;

create policy "config_lectura_publica"
  on public.configuraciones_globales for select
  using (true);

grant select on public.configuraciones_globales to anon;
