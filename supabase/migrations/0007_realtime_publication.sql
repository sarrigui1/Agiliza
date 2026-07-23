-- =====================================================================================
-- FLOWQ — Habilita Supabase Realtime (WebSockets) sobre las tablas que lo necesitan.
--
-- Sin esto, los canales `postgres_changes` de useRealtimeCalls/useRealtimeTurnos se
-- suscriben correctamente pero Postgres nunca emite el evento lógico de replicación,
-- así que la UI solo se actualiza al recargar la página. Detectado probando el flujo
-- end-to-end: fn_llamar_siguiente_turno se ejecutaba bien, pero /workspace y /display
-- no reflejaban el cambio hasta refrescar.
-- =====================================================================================

alter publication supabase_realtime add table public.turnos;
alter publication supabase_realtime add table public.llamados;
