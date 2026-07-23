-- =====================================================================================
-- FLOWQ — Cierre de jornada (Vercel Cron Job nocturno)
-- Requiere 0001-0007. Se invoca únicamente desde el Route Handler protegido con
-- CRON_SECRET (src/app/api/cron/cierre-jornada/route.ts), usando el cliente Service Role.
--
-- A propósito NO se otorga EXECUTE a `authenticated`: a diferencia del resto de RPCs de
-- este proyecto, esta función jamás debe ser invocable desde el cliente (ni por un admin
-- logueado) — solo desde el cron con la Service Role Key.
-- =====================================================================================

create or replace function public.fn_cerrar_jornada()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expirados int;
begin
  -- Expira todo turno que no llegó a 'en_atencion' ni a un estado terminal durante la
  -- jornada: citas no presentadas ('programado'), turnos que se quedaron en fila
  -- ('en_espera' / 'reingresado') y llamados que nadie atendió ('llamado').
  -- 'en_atencion' se deja intacto: no se corta una consulta en curso a medianoche.
  with expirados as (
    update public.turnos
    set estado = 'cancelado'
    where estado in ('programado', 'en_espera', 'llamado', 'reingresado')
    returning id
  )
  select count(*) into v_expirados from expirados;

  -- Libera puntos que habían quedado marcados "atendiendo" sin un turno realmente activo
  -- (ej. su turno en 'llamado' fue expirado arriba en la misma pasada).
  update public.puntos_atencion pa
  set estado = 'disponible'
  where pa.estado = 'atendiendo'
    and not exists (
      select 1 from public.turnos t
      where t.punto_atencion_id = pa.id and t.estado = 'en_atencion'
    );

  insert into public.auditoria (accion, metadata)
  values ('cierre_jornada', jsonb_build_object('turnos_expirados', v_expirados, 'ejecutado_en', now()));

  return v_expirados;
end;
$$;

comment on function public.fn_cerrar_jornada() is
  'Cron nocturno: cancela turnos no atendidos (programado/en_espera/llamado/reingresado) y libera puntos de atención huérfanos. Solo invocable con Service Role.';

grant execute on function public.fn_cerrar_jornada() to service_role;
