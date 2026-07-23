-- =====================================================================================
-- FLOWQ — Fase 2: RPCs operativas restantes
-- Requiere 0001_init_schema.sql, 0002_rls_policies.sql y 0003_fn_llamar_siguiente_turno.sql
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Helper: autorización de agente sobre un turno.
-- Todas las RPC de esta fase son SECURITY DEFINER (bypasean RLS para poder hacer el UPDATE),
-- por lo que cada una valida explícitamente que el agente tiene permiso sobre la cola
-- (especialidad + zona) del turno, salvo que sea admin/supervisor.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_agente_autorizado_turno(p_turno_id uuid, p_agente_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol rol_usuario;
  v_autorizado boolean;
begin
  select rol into v_rol from public.perfiles where id = p_agente_id;

  if v_rol in ('admin', 'supervisor') then
    return true;
  end if;

  select exists (
    select 1
    from public.turnos t
    join public.agentes_puntos_atencion apa on apa.perfil_id = p_agente_id
    join public.puntos_atencion pa on pa.id = apa.punto_atencion_id
    where t.id = p_turno_id
      and pa.especialidad_id = t.especialidad_id
      and pa.zona_id = t.zona_id
  ) into v_autorizado;

  return coalesce(v_autorizado, false);
end;
$$;


-- -------------------------------------------------------------------------------------
-- Helper: generación atómica de código alfanumérico de ticket ('CAR-014').
-- Usado por fn_derivar_turno y por el Server Action de Check-In (src/actions/checkin.ts).
-- Lock de asesoría por especialidad+día evita colisiones si dos recepciones dan de alta
-- pacientes de la misma especialidad al mismo tiempo.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_generar_codigo_turno(p_especialidad_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_codigo_especialidad text;
  v_siguiente int;
begin
  select codigo into v_codigo_especialidad
  from public.especialidades
  where id = p_especialidad_id;

  if v_codigo_especialidad is null then
    raise exception 'Especialidad % no existe', p_especialidad_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('codigo_turno:' || p_especialidad_id::text || ':' || current_date::text, 0)
  );

  select count(*) + 1 into v_siguiente
  from public.turnos
  where especialidad_id = p_especialidad_id
    and created_at >= date_trunc('day', now());

  return v_codigo_especialidad || '-' || lpad(v_siguiente::text, 3, '0');
end;
$$;

grant execute on function public.fn_generar_codigo_turno(uuid) to authenticated;
grant execute on function public.fn_agente_autorizado_turno(uuid, uuid) to authenticated;


-- =====================================================================================
-- A. fn_re_llamar_turno
-- Re-notifica el mismo turno (mantiene estado 'llamado') respetando el intervalo mínimo
-- configurado entre re-llamados, para evitar spamear la pantalla/TTS.
-- =====================================================================================
create or replace function public.fn_re_llamar_turno(
  p_turno_id uuid,
  p_agente_id uuid
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno   public.turnos;
  v_config  public.configuraciones_globales;
  v_etiqueta_publica text;
  v_etiqueta_punto   text;
begin
  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_config from public.configuraciones_globales where id = 1;

  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado <> 'llamado' then
    raise exception 'Solo se puede re-llamar un turno en estado "llamado" (estado actual: %)', v_turno.estado;
  end if;

  if v_turno.hora_llamado is not null
     and now() - v_turno.hora_llamado < make_interval(secs => v_config.segundos_intervalo_rellamado) then
    raise exception 'Debe esperar % segundos entre re-llamados', v_config.segundos_intervalo_rellamado;
  end if;

  update public.turnos
  set hora_llamado = now(),
      intentos_llamado = intentos_llamado + 1
  where id = p_turno_id
  returning * into v_turno;

  v_etiqueta_publica := public.fn_enmascarar_turno(v_turno, v_config.formato_privacidad_tv);

  select nombre into v_etiqueta_punto
  from public.puntos_atencion
  where id = v_turno.punto_atencion_id;

  insert into public.llamados (
    turno_id, punto_atencion_id, zona_id,
    etiqueta_publica, etiqueta_punto_atencion,
    tipo_llamado, agente_id
  ) values (
    v_turno.id, v_turno.punto_atencion_id, v_turno.zona_id,
    v_etiqueta_publica, v_etiqueta_punto,
    're_llamado', p_agente_id
  );

  return v_turno;
end;
$$;

grant execute on function public.fn_re_llamar_turno(uuid, uuid) to authenticated;


-- =====================================================================================
-- B. fn_marcar_ausente
-- Solo permite marcar ausente tras alcanzar limite_llamados_ausencia (regla de negocio
-- de Módulo 1, no solo una restricción de UI). Si reingreso_penalizado está activo,
-- genera automáticamente un nuevo turno 'reingresado' al final de la fila.
-- =====================================================================================
create or replace function public.fn_marcar_ausente(
  p_turno_id uuid,
  p_agente_id uuid
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno      public.turnos;
  v_config     public.configuraciones_globales;
  v_reingreso  public.turnos;
begin
  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_config from public.configuraciones_globales where id = 1;

  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado <> 'llamado' then
    raise exception 'Solo se puede marcar ausente un turno en estado "llamado" (estado actual: %)', v_turno.estado;
  end if;

  if v_turno.intentos_llamado < v_config.limite_llamados_ausencia then
    raise exception 'Aún no se alcanza el límite de llamados (%/%) para marcar ausente',
      v_turno.intentos_llamado, v_config.limite_llamados_ausencia;
  end if;

  update public.turnos
  set estado = 'ausente'
  where id = p_turno_id
  returning * into v_turno;

  insert into public.auditoria (agente_id, accion, turno_id, metadata)
  values (p_agente_id, 'marcar_ausente', v_turno.id,
          jsonb_build_object('intentos_llamado', v_turno.intentos_llamado));

  if v_config.reingreso_penalizado then
    insert into public.turnos (
      codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado,
      documento_paciente, nombre_paciente, hora_cita, hora_llegada,
      turno_origen_id, creado_por
    ) values (
      v_turno.codigo, v_turno.especialidad_id, v_turno.zona_id, v_turno.tipo_turno, v_turno.es_preferencial,
      'en_espera',
      v_turno.documento_paciente, v_turno.nombre_paciente, null, now(), -- hora_llegada = now() -> al final de la fila
      v_turno.id, p_agente_id
    )
    returning * into v_reingreso;

    update public.turnos set estado = 'reingresado' where id = v_turno.id;

    insert into public.auditoria (agente_id, accion, turno_id, metadata)
    values (p_agente_id, 'reingreso_penalizado', v_reingreso.id,
            jsonb_build_object('turno_origen_id', v_turno.id));

    return v_reingreso;
  end if;

  return v_turno;
end;
$$;

grant execute on function public.fn_marcar_ausente(uuid, uuid) to authenticated;


-- =====================================================================================
-- C. fn_derivar_turno
-- Finaliza el turno actual y crea uno nuevo en otra especialidad (misma zona salvo que
-- se indique otra), soportando el flujo "Ruta de Atención" multiespecialidad.
-- =====================================================================================
create or replace function public.fn_derivar_turno(
  p_turno_id uuid,
  p_especialidad_destino_id uuid,
  p_agente_id uuid,
  p_zona_destino_id uuid default null
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno       public.turnos;
  v_zona_destino uuid;
  v_codigo_nuevo text;
  v_nuevo_turno  public.turnos;
begin
  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado not in ('llamado', 'en_atencion') then
    raise exception 'Solo se puede derivar un turno en atención o recién llamado (estado actual: %)', v_turno.estado;
  end if;

  if not exists (select 1 from public.especialidades where id = p_especialidad_destino_id) then
    raise exception 'Especialidad destino % no existe', p_especialidad_destino_id;
  end if;

  v_zona_destino := coalesce(p_zona_destino_id, v_turno.zona_id);

  -- Cierra el turno actual
  update public.turnos
  set estado = 'finalizado',
      hora_finalizacion = now()
  where id = p_turno_id
  returning * into v_turno;

  -- Genera el ticket de la 2da especialidad y re-encola al paciente
  v_codigo_nuevo := public.fn_generar_codigo_turno(p_especialidad_destino_id);

  insert into public.turnos (
    codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado,
    documento_paciente, nombre_paciente, hora_llegada,
    turno_origen_id, creado_por
  ) values (
    v_codigo_nuevo, p_especialidad_destino_id, v_zona_destino, 'espontaneo', v_turno.es_preferencial,
    'en_espera',
    v_turno.documento_paciente, v_turno.nombre_paciente, now(),
    v_turno.id, p_agente_id
  )
  returning * into v_nuevo_turno;

  insert into public.auditoria (agente_id, accion, turno_id, metadata)
  values (p_agente_id, 'derivacion_multiespecialidad', v_nuevo_turno.id,
          jsonb_build_object('turno_origen_id', v_turno.id, 'especialidad_destino_id', p_especialidad_destino_id));

  return v_nuevo_turno;
end;
$$;

grant execute on function public.fn_derivar_turno(uuid, uuid, uuid, uuid) to authenticated;


-- =====================================================================================
-- D. fn_salto_de_cola_autorizado
-- Permite llamar un turno fuera de orden. Motivo obligatorio, queda registrado en
-- `auditoria`. Comparte el mismo lock de cola que fn_llamar_siguiente_turno para
-- evitar que un llamado "normal" y un salto de cola colisionen sobre el mismo turno.
-- =====================================================================================
create or replace function public.fn_salto_de_cola_autorizado(
  p_turno_id uuid,
  p_punto_atencion_id uuid,
  p_agente_id uuid,
  p_motivo text
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno     public.turnos;
  v_config    public.configuraciones_globales;
  v_etiqueta_publica text;
  v_etiqueta_punto   text;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'El salto de cola requiere un motivo de auditoría';
  end if;

  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_turno from public.turnos where id = p_turno_id;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  -- Mismo lock lógico de cola que usa fn_llamar_siguiente_turno, para serializar
  -- ambos caminos de llamado sobre la misma especialidad+zona.
  perform pg_advisory_xact_lock(
    hashtextextended(v_turno.especialidad_id::text || ':' || v_turno.zona_id::text, 0)
  );

  -- Se relee el turno ya con el lock tomado, por si cambió de estado mientras se esperaba.
  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.estado <> 'en_espera' then
    raise exception 'Solo se puede saltar la cola con un turno en estado "en_espera" (estado actual: %)', v_turno.estado;
  end if;

  select * into v_config from public.configuraciones_globales where id = 1;

  update public.turnos
  set estado = 'llamado',
      punto_atencion_id = p_punto_atencion_id,
      hora_llamado = now(),
      intentos_llamado = intentos_llamado + 1,
      motivo_auditoria = p_motivo
  where id = p_turno_id
  returning * into v_turno;

  v_etiqueta_publica := public.fn_enmascarar_turno(v_turno, v_config.formato_privacidad_tv);

  select nombre into v_etiqueta_punto
  from public.puntos_atencion
  where id = p_punto_atencion_id;

  insert into public.llamados (
    turno_id, punto_atencion_id, zona_id,
    etiqueta_publica, etiqueta_punto_atencion,
    tipo_llamado, agente_id
  ) values (
    v_turno.id, p_punto_atencion_id, v_turno.zona_id,
    v_etiqueta_publica, v_etiqueta_punto,
    'prioritario', p_agente_id
  );

  insert into public.auditoria (agente_id, accion, turno_id, metadata)
  values (p_agente_id, 'salto_de_cola', v_turno.id,
          jsonb_build_object('motivo', p_motivo, 'punto_atencion_id', p_punto_atencion_id));

  return v_turno;
end;
$$;

grant execute on function public.fn_salto_de_cola_autorizado(uuid, uuid, uuid, text) to authenticated;
