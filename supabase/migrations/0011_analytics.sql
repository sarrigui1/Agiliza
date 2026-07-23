-- =====================================================================================
-- FLOWQ — Módulo de Analytics Ejecutivo
-- Índice de soporte + 4 RPCs de agregación (se calculan en Postgres, no trayendo todas
-- las filas al cliente, para que el rango "Este Mes" siga siendo rápido a medida que
-- crece `turnos`).
-- =====================================================================================

create index if not exists idx_turnos_hora_llegada on public.turnos (hora_llegada);

-- -------------------------------------------------------------------------------------
-- fn_metricas_ejecutivas: una fila con los KPIs top-line para [p_desde, p_hasta).
-- SLA = % de turnos llamados dentro de p_sla_minutos desde su hora_llegada (default 15,
-- ver ejemplo del requerimiento original).
-- -------------------------------------------------------------------------------------
create or replace function public.fn_metricas_ejecutivas(
  p_desde timestamptz,
  p_hasta timestamptz,
  p_sla_minutos int default 15
)
returns table (
  total_generados int,
  total_atendidos int,
  total_ausentes int,
  tasa_ausentismo numeric,
  tpe_global_minutos numeric,
  tpa_global_minutos numeric,
  cumplimiento_sla numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int as total_generados,
    count(*) filter (where estado = 'finalizado')::int as total_atendidos,
    count(*) filter (where estado in ('ausente', 'cancelado'))::int as total_ausentes,
    round(
      (count(*) filter (where estado in ('ausente', 'cancelado'))::numeric
        / nullif(count(*), 0)) * 100, 1
    ) as tasa_ausentismo,
    round(
      (avg(extract(epoch from (hora_llamado - hora_llegada)))
        filter (where hora_llamado is not null)) / 60, 1
    ) as tpe_global_minutos,
    round(
      (avg(extract(epoch from (hora_finalizacion - hora_atencion)))
        filter (where hora_atencion is not null and hora_finalizacion is not null)) / 60, 1
    ) as tpa_global_minutos,
    round(
      (count(*) filter (
        where hora_llamado is not null
          and extract(epoch from (hora_llamado - hora_llegada)) <= p_sla_minutos * 60
      )::numeric / nullif(count(*) filter (where hora_llamado is not null), 0)) * 100, 1
    ) as cumplimiento_sla
  from public.turnos
  where hora_llegada >= p_desde and hora_llegada < p_hasta;
$$;

grant execute on function public.fn_metricas_ejecutivas(timestamptz, timestamptz, int) to authenticated;

-- -------------------------------------------------------------------------------------
-- fn_heatmap_demanda: volumen de turnos por día ISO de semana (1=lunes..7=domingo) y
-- hora del día, para el mapa de calor de horas pico.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_heatmap_demanda(p_desde timestamptz, p_hasta timestamptz)
returns table (dia_semana int, hora int, cantidad int)
language sql
stable
security definer
set search_path = public
as $$
  select
    extract(isodow from hora_llegada)::int as dia_semana,
    extract(hour from hora_llegada)::int as hora,
    count(*)::int as cantidad
  from public.turnos
  where hora_llegada >= p_desde and hora_llegada < p_hasta
  group by 1, 2
  order by 1, 2;
$$;

grant execute on function public.fn_heatmap_demanda(timestamptz, timestamptz) to authenticated;

-- -------------------------------------------------------------------------------------
-- fn_tendencia_diaria: no estaba en la lista original de 3 Server Actions, pero el
-- Dashboard pide explícitamente un "Gráfico de Tendencia de Demanda" día a día, y
-- `fn_heatmap_demanda` agrupa por día-de-semana (lunes..domingo), no por fecha
-- calendario — no alcanza para reconstruir una serie diaria real. Se agrega aquí por
-- transparencia, mismo patrón que el resto de RPCs de este archivo.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_tendencia_diaria(p_desde timestamptz, p_hasta timestamptz)
returns table (fecha date, cantidad int)
language sql
stable
security definer
set search_path = public
as $$
  select
    date_trunc('day', hora_llegada)::date as fecha,
    count(*)::int as cantidad
  from public.turnos
  where hora_llegada >= p_desde and hora_llegada < p_hasta
  group by 1
  order by 1;
$$;

grant execute on function public.fn_tendencia_diaria(timestamptz, timestamptz) to authenticated;

-- -------------------------------------------------------------------------------------
-- fn_rendimiento_por_servicio: volumen/TPE/TPA agrupado por especialidad.
-- LEFT JOIN para incluir especialidades sin turnos en el rango (0 en vez de desaparecer).
-- -------------------------------------------------------------------------------------
create or replace function public.fn_rendimiento_por_servicio(p_desde timestamptz, p_hasta timestamptz)
returns table (
  especialidad_id uuid,
  nombre_servicio text,
  total_atenciones int,
  tpe_minutos numeric,
  tpa_minutos numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.nombre,
    count(t.id) filter (where t.estado = 'finalizado')::int as total_atenciones,
    round(
      (avg(extract(epoch from (t.hora_llamado - t.hora_llegada)))
        filter (where t.hora_llamado is not null)) / 60, 1
    ) as tpe_minutos,
    round(
      (avg(extract(epoch from (t.hora_finalizacion - t.hora_atencion)))
        filter (where t.hora_atencion is not null and t.hora_finalizacion is not null)) / 60, 1
    ) as tpa_minutos
  from public.especialidades e
  left join public.turnos t
    on t.especialidad_id = e.id
    and t.hora_llegada >= p_desde and t.hora_llegada < p_hasta
  group by e.id, e.nombre
  order by total_atenciones desc nulls last;
$$;

grant execute on function public.fn_rendimiento_por_servicio(timestamptz, timestamptz) to authenticated;

-- -------------------------------------------------------------------------------------
-- fn_rendimiento_por_agente: volumen/TPA agrupado por agente.
--
-- Limitación conocida: `turnos` no guarda quién atendió cada ticket, solo
-- `punto_atencion_id`. La atribución usa la asignación ACTUAL en
-- `agentes_puntos_atencion`, no un histórico por turno — si un agente cambió de punto
-- a mitad del rango consultado, el reparto no será perfectamente preciso. Suficiente
-- para una vista ejecutiva agregada; no para auditoría individual exacta.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_rendimiento_por_agente(p_desde timestamptz, p_hasta timestamptz)
returns table (
  agente_id uuid,
  nombre_agente text,
  total_atenciones int,
  tpa_minutos numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nombre_completo,
    count(t.id) filter (where t.estado = 'finalizado')::int as total_atenciones,
    round(
      (avg(extract(epoch from (t.hora_finalizacion - t.hora_atencion)))
        filter (where t.estado = 'finalizado' and t.hora_atencion is not null and t.hora_finalizacion is not null)) / 60, 1
    ) as tpa_minutos
  from public.perfiles p
  left join public.agentes_puntos_atencion apa on apa.perfil_id = p.id
  left join public.turnos t
    on t.punto_atencion_id = apa.punto_atencion_id
    and t.hora_llegada >= p_desde and t.hora_llegada < p_hasta
  where p.rol = 'agente'
  group by p.id, p.nombre_completo
  order by total_atenciones desc nulls last;
$$;

grant execute on function public.fn_rendimiento_por_agente(timestamptz, timestamptz) to authenticated;
