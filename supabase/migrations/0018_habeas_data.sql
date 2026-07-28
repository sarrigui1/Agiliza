-- =====================================================================================
-- AGILIZA — Consentimiento de tratamiento de datos personales (Ley 1581 de 2012, Colombia)
--
-- El check-in captura documento + nombre (y, con lectura de cédula activada, el dato
-- completo del PDF417) sin que el paciente autorice expresamente su tratamiento. Se
-- agrega el registro de consentimiento por turno y un texto de política editable por
-- sede (mismo patrón que texto_informativo_tv) porque el Responsable del Tratamiento
-- cambia con cada cliente.
-- =====================================================================================

alter table public.turnos
  add column if not exists acepto_tratamiento_datos boolean not null default false,
  add column if not exists fecha_consentimiento_datos timestamptz;

comment on column public.turnos.acepto_tratamiento_datos is
  'Consentimiento expreso del paciente para el tratamiento de sus datos personales, capturado en el momento del check-in.';

alter table public.configuraciones_globales
  add column if not exists texto_politica_datos text not null default
'POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES

[NOMBRE DE LA INSTITUCIÓN], identificada con NIT [NIT], con domicilio en [CIUDAD], actúa como Responsable del Tratamiento de los datos personales que usted suministra al registrar su turno de atención (documento de identidad, nombre y, cuando aplique, datos relacionados con su atención).

Finalidades del tratamiento:
1. Gestionar y mostrar su turno en las pantallas y sistemas de atención.
2. Generar estadísticas internas para mejorar el servicio.
3. Contactarlo únicamente por canales que usted autorice, en relación con su atención.

Sus datos no serán vendidos ni cedidos a terceros con fines comerciales.

De acuerdo con la Ley 1581 de 2012 y el Decreto 1377 de 2013, usted tiene derecho a: conocer, actualizar y rectificar sus datos; solicitar prueba de esta autorización; ser informado del uso dado a sus datos; presentar quejas ante la Superintendencia de Industria y Comercio; revocar esta autorización y/o solicitar la supresión del dato cuando no exista un deber legal o contractual que lo impida; y acceder de forma gratuita a sus datos personales.

Para ejercer estos derechos escriba a [CORREO DE CONTACTO] o acérquese a nuestro punto de atención.

Al marcar la casilla de aceptación, usted autoriza el tratamiento de sus datos personales conforme a esta política.';

comment on column public.configuraciones_globales.texto_politica_datos is
  'Texto completo de la política de tratamiento de datos mostrado en /checkin. Editable por sede en /admin/settings — el texto por defecto trae marcadores [ENTRE CORCHETES] que cada cliente (Responsable del Tratamiento) debe reemplazar con sus datos reales antes de operar.';

-- fn_confirmar_checkin gana un tercer parámetro para registrar el consentimiento en el
-- mismo movimiento atómico que confirma la llegada (no se permiten UPDATE directos a
-- turnos desde el cliente, ver 0005_fn_confirmar_checkin.sql).
drop function if exists public.fn_confirmar_checkin(uuid, uuid);

create or replace function public.fn_confirmar_checkin(
  p_turno_id uuid,
  p_agente_id uuid,
  p_acepto_tratamiento_datos boolean default false
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
      hora_llegada = now(),
      acepto_tratamiento_datos = v_turno.acepto_tratamiento_datos or p_acepto_tratamiento_datos,
      fecha_consentimiento_datos = case
        when p_acepto_tratamiento_datos then now()
        else v_turno.fecha_consentimiento_datos
      end
  where id = p_turno_id
  returning * into v_turno;

  insert into public.auditoria (agente_id, accion, turno_id, metadata)
  values (p_agente_id, 'checkin_confirmado', v_turno.id, '{}'::jsonb);

  return v_turno;
end;
$$;

grant execute on function public.fn_confirmar_checkin(uuid, uuid, boolean) to authenticated;
