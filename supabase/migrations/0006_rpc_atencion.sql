-- =====================================================================================
-- FLOWQ — Fase 3: RPCs de atención en consultorio
-- Requiere 0001..0005. Completa el ciclo de vida que faltaba en el Workspace:
--   'llamado' --fn_iniciar_atencion--> 'en_atencion' --fn_finalizar_atencion--> 'finalizado'
--
-- Ambas actualizan `puntos_atencion.estado` como efecto colateral, para que el
-- Tablero de Supervisión (Módulo 5) refleje en vivo quién está "atendiendo" vs
-- "disponible" sin tener que inferirlo indirectamente desde `turnos`.
-- =====================================================================================

-- =====================================================================================
-- fn_iniciar_atencion
-- =====================================================================================
create or replace function public.fn_iniciar_atencion(
  p_turno_id uuid,
  p_punto_atencion_id uuid,
  p_agente_id uuid
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos;
begin
  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado <> 'llamado' then
    raise exception 'Solo se puede iniciar atención de un turno en estado "llamado" (estado actual: %)', v_turno.estado;
  end if;

  if v_turno.punto_atencion_id <> p_punto_atencion_id then
    raise exception 'El turno % fue llamado desde otro punto de atención', p_turno_id;
  end if;

  update public.turnos
  set estado = 'en_atencion',
      hora_atencion = now()
  where id = p_turno_id
  returning * into v_turno;

  update public.puntos_atencion
  set estado = 'atendiendo',
      agente_actual_id = p_agente_id
  where id = p_punto_atencion_id;

  return v_turno;
end;
$$;

grant execute on function public.fn_iniciar_atencion(uuid, uuid, uuid) to authenticated;


-- =====================================================================================
-- fn_finalizar_atencion
-- =====================================================================================
create or replace function public.fn_finalizar_atencion(
  p_turno_id uuid,
  p_punto_atencion_id uuid,
  p_agente_id uuid
)
returns public.turnos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.turnos;
begin
  if not public.fn_agente_autorizado_turno(p_turno_id, p_agente_id) then
    raise exception 'El agente % no está autorizado sobre el turno %', p_agente_id, p_turno_id;
  end if;

  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado <> 'en_atencion' then
    raise exception 'Solo se puede finalizar un turno en estado "en_atencion" (estado actual: %)', v_turno.estado;
  end if;

  if v_turno.punto_atencion_id <> p_punto_atencion_id then
    raise exception 'El turno % no pertenece a este punto de atención', p_turno_id;
  end if;

  update public.turnos
  set estado = 'finalizado',
      hora_finalizacion = now()
  where id = p_turno_id
  returning * into v_turno;

  update public.puntos_atencion
  set estado = 'disponible'
  where id = p_punto_atencion_id;

  return v_turno;
end;
$$;

grant execute on function public.fn_finalizar_atencion(uuid, uuid, uuid) to authenticated;
