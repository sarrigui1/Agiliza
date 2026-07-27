-- =====================================================================================
-- FLOWQ — Lectura de cédula (PDF417) opcional en Check-In
--
-- `permitir_lectura_cedula` decide si /checkin muestra el aviso de "acerca el código de
-- barras..." y el botón de escaneo por cámara (además de escuchar un lector físico
-- USB/Bluetooth, que de todas formas solo hace algo si el sitio realmente tiene uno).
-- Por defecto queda desactivado (false) — mismo criterio que
-- `permitir_citas_programadas` (0014): la mayoría de sedes no tienen lector físico
-- todavía, y mostrar el aviso sin que haya nada que lo respalde es solo ruido visual.
-- =====================================================================================

alter table public.configuraciones_globales
  add column if not exists permitir_lectura_cedula boolean not null default false;
