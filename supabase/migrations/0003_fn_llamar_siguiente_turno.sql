-- =====================================================================================
-- FLOWQ — RPC: fn_llamar_siguiente_turno
-- Requiere 0001_init_schema.sql y 0002_rls_policies.sql
--
-- Garantiza atomicidad mediante:
--   1) pg_advisory_xact_lock por (especialidad_id, zona_id) — la "cola" lógica —
--      de modo que dos agentes de la misma especialidad/zona nunca llamen al mismo turno.
--   2) FOR UPDATE SKIP LOCKED sobre la fila seleccionada, como segunda barrera.
-- El lock se libera automáticamente al finalizar la transacción (xact_lock).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Helper: enmascara los datos del paciente según configuraciones_globales.formato_privacidad_tv
-- Nunca debe filtrarse documento_paciente / nombre_paciente crudos a `llamados`.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_enmascarar_turno(
  p_turno public.turnos,
  p_formato formato_privacidad_tv
)
returns text
language plpgsql
immutable
as $$
begin
  return case p_formato
    when 'solo_codigo' then
      p_turno.codigo
    when 'iniciales_parcial' then
      (
        select string_agg(left(palabra, 1), '.') || '. (***' || right(p_turno.documento_paciente, 3) || ')'
        from unnest(string_to_array(p_turno.nombre_paciente, ' ')) as palabra
      )
    when 'nombre_completo' then
      p_turno.nombre_paciente
    else
      p_turno.codigo
  end;
end;
$$;


-- -------------------------------------------------------------------------------------
-- RPC principal
-- -------------------------------------------------------------------------------------
create or replace function public.fn_llamar_siguiente_turno(
  p_punto_atencion_id uuid,
  p_agente_id uuid
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_especialidad_id      uuid;
  v_zona_id               uuid;
  v_config                public.configuraciones_globales;
  v_turno                 public.turnos;
  v_etiqueta_publica       text;
  v_etiqueta_punto         text;

  v_ciclo_total            int;
  v_posicion_ciclo         int;
  v_llamados_hoy           int;
  v_debe_ser_preferencial  boolean;
begin
  -- 1) Resolver especialidad/zona del punto de atención (define la "cola" lógica)
  select pa.especialidad_id, pa.zona_id
    into v_especialidad_id, v_zona_id
  from public.puntos_atencion pa
  where pa.id = p_punto_atencion_id;

  if v_especialidad_id is null then
    raise exception 'El punto de atención % no existe o no tiene especialidad asignada', p_punto_atencion_id;
  end if;

  -- 2) Cargar configuración global vigente
  select * into v_config from public.configuraciones_globales where id = 1;

  -- 3) Lock exclusivo por cola (especialidad + zona) durante toda la transacción.
  --    hashtextextended combina ambos UUID en una sola clave de 64 bits.
  perform pg_advisory_xact_lock(
    hashtextextended(v_especialidad_id::text || ':' || v_zona_id::text, 0)
  );

  -- 4) Calcular si, según la proporción de intercalado configurada, el próximo
  --    llamado de esta cola debe ser preferencial o normal.
  --    Ej. intercalado 1:2 -> de cada 3 llamados, el primero del ciclo es preferencial.
  v_ciclo_total := greatest(v_config.intercalado_preferencial + v_config.intercalado_normal, 1);

  select count(*) into v_llamados_hoy
  from public.llamados l
  join public.turnos t on t.id = l.turno_id
  where t.especialidad_id = v_especialidad_id
    and t.zona_id = v_zona_id
    and l.created_at >= date_trunc('day', now());

  v_posicion_ciclo := v_llamados_hoy % v_ciclo_total;
  v_debe_ser_preferencial := v_posicion_ciclo < v_config.intercalado_preferencial;

  -- 5) Seleccionar el siguiente turno respetando el algoritmo configurado.
  --    Se intenta primero el tipo (preferencial/normal) que indica el ciclo de intercalado;
  --    si no hay turnos de ese tipo en espera, se hace fallback al otro tipo para no
  --    dejar la cola detenida artificialmente.
  select t.* into v_turno
  from public.turnos t
  where t.estado = 'en_espera'
    and t.especialidad_id = v_especialidad_id
    and t.zona_id = v_zona_id
    and t.es_preferencial = v_debe_ser_preferencial
  order by
    -- hibrido: primero los que tienen cita agendada (por hora de cita), luego por llegada
    case when v_config.algoritmo_cola = 'hibrido' then (t.hora_cita is null) end asc,
    case when v_config.algoritmo_cola in ('hora_cita', 'hibrido')
         then coalesce(t.hora_cita, t.hora_llegada) end asc nulls last,
    case when v_config.algoritmo_cola = 'orden_llegada' then t.hora_llegada end asc,
    t.hora_llegada asc
  limit 1
  for update skip locked;

  if v_turno.id is null then
    -- Fallback: no hay turnos del tipo requerido por el ciclo, tomar cualquiera disponible
    select t.* into v_turno
    from public.turnos t
    where t.estado = 'en_espera'
      and t.especialidad_id = v_especialidad_id
      and t.zona_id = v_zona_id
    order by
      case when v_config.algoritmo_cola = 'hibrido' then (t.hora_cita is null) end asc,
      case when v_config.algoritmo_cola in ('hora_cita', 'hibrido')
           then coalesce(t.hora_cita, t.hora_llegada) end asc nulls last,
      case when v_config.algoritmo_cola = 'orden_llegada' then t.hora_llegada end asc,
      t.hora_llegada asc
    limit 1
    for update skip locked;
  end if;

  -- 6) Cola vacía: no hay nada que llamar
  if v_turno.id is null then
    return null;
  end if;

  -- 7) Transición atómica de estado + registro del llamado
  update public.turnos
  set estado = 'llamado',
      punto_atencion_id = p_punto_atencion_id,
      hora_llamado = now(),
      intentos_llamado = intentos_llamado + 1
  where id = v_turno.id
  returning * into v_turno;

  v_etiqueta_publica := public.fn_enmascarar_turno(v_turno, v_config.formato_privacidad_tv);

  select pa.nombre into v_etiqueta_punto
  from public.puntos_atencion pa
  where pa.id = p_punto_atencion_id;

  insert into public.llamados (
    turno_id, punto_atencion_id, zona_id,
    etiqueta_publica, etiqueta_punto_atencion,
    tipo_llamado, agente_id
  ) values (
    v_turno.id, p_punto_atencion_id, v_zona_id,
    v_etiqueta_publica, v_etiqueta_punto,
    'inicial', p_agente_id
  );

  -- 8) El INSERT en `llamados` dispara automáticamente el evento de Supabase Realtime
  --    (postgres_changes) que consumen el TV Display y el Operator Workspace.
  return v_turno;
end;
$$;

comment on function public.fn_llamar_siguiente_turno(uuid, uuid) is
  'Selecciona y llama atómicamente el siguiente turno en espera de la cola (especialidad+zona) '
  'del punto de atención indicado, respetando algoritmo_cola e intercalado_preferencial/normal.';

grant execute on function public.fn_llamar_siguiente_turno(uuid, uuid) to authenticated;
grant execute on function public.fn_enmascarar_turno(public.turnos, formato_privacidad_tv) to authenticated;
