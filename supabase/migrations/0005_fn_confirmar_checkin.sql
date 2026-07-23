-- =====================================================================================
-- FLOWQ — Fase 2 (soporte): fn_confirmar_checkin
--
-- No estaba en la lista original de 4 RPCs operativas, pero es necesaria para que
-- `src/actions/checkin.ts` pueda completar el flujo "Check-In de Agenda Previa":
-- transición 'programado' -> 'en_espera'. Se mantiene el mismo principio de Fase 1
-- (ninguna mutación de `turnos` se hace con UPDATE directo desde el cliente).
-- =====================================================================================
create or replace function public.fn_confirmar_checkin(
  p_turno_id uuid,
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
  select * into v_turno from public.turnos where id = p_turno_id for update;

  if v_turno.id is null then
    raise exception 'Turno % no existe', p_turno_id;
  end if;

  if v_turno.estado <> 'programado' then
    raise exception 'Solo se puede confirmar check-in de un turno "programado" (estado actual: %)', v_turno.estado;
  end if;

  update public.turnos
  set estado = 'en_espera',
      hora_llegada = now()
  where id = p_turno_id
  returning * into v_turno;

  insert into public.auditoria (agente_id, accion, turno_id, metadata)
  values (p_agente_id, 'checkin_confirmado', v_turno.id, '{}'::jsonb);

  return v_turno;
end;
$$;

grant execute on function public.fn_confirmar_checkin(uuid, uuid) to authenticated;
