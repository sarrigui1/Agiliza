-- =====================================================================================
-- FLOWQ — Datos semilla (catálogos + turnos de prueba)
-- Ejecutar UNA VEZ en el SQL Editor de Supabase, después de las migraciones 0001-0006.
-- No incluye usuarios (auth.users se gestiona desde el Dashboard, ver seed_perfiles.sql).
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- Especialidades
-- -------------------------------------------------------------------------------------
insert into public.especialidades (codigo, nombre) values
  ('CAR', 'Cardiología'),
  ('GEN', 'Atención al Cliente'),
  ('FIN', 'Atención Financiera'),
  ('ASE', 'Asesoría Especializada')
on conflict (codigo) do nothing;

-- -------------------------------------------------------------------------------------
-- Zonas
-- -------------------------------------------------------------------------------------
insert into public.zonas (codigo, nombre, descripcion) values
  ('piso1', 'Planta Baja', 'Recepción, cajas y asesoría general'),
  ('piso2', 'Piso 2 - Consulta Externa', 'Consultorios médicos')
on conflict (codigo) do nothing;

-- -------------------------------------------------------------------------------------
-- Puntos de atención
-- -------------------------------------------------------------------------------------
insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'CONS-05', 'Consultorio 5', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso2' and e.codigo = 'CAR'
on conflict (codigo) do nothing;

insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'MOD-01', 'Módulo 1', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso1' and e.codigo = 'GEN'
on conflict (codigo) do nothing;

insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'MOD-02', 'Módulo 2', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso1' and e.codigo = 'GEN'
on conflict (codigo) do nothing;

insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'CAJA-01', 'Caja 1', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso1' and e.codigo = 'FIN'
on conflict (codigo) do nothing;

insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'CAJA-02', 'Caja 2', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso1' and e.codigo = 'FIN'
on conflict (codigo) do nothing;

insert into public.puntos_atencion (codigo, nombre, zona_id, especialidad_id)
select 'ASE-A', 'Asesoría A', z.id, e.id
from public.zonas z, public.especialidades e
where z.codigo = 'piso1' and e.codigo = 'ASE'
on conflict (codigo) do nothing;

-- -------------------------------------------------------------------------------------
-- Turnos de prueba (en espera) — para probar Workspace/Display sin pasar por Check-In.
-- Documentos y nombres son datos ficticios de prueba.
-- -------------------------------------------------------------------------------------
insert into public.turnos (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_llegada)
select 'CAR-015', e.id, z.id, 'espontaneo', true, 'en_espera', '1000000001', 'Paciente de Prueba Uno', now() - interval '18 minutes'
from public.especialidades e, public.zonas z where e.codigo = 'CAR' and z.codigo = 'piso2';

insert into public.turnos (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_llegada)
select 'GEN-115', e.id, z.id, 'espontaneo', false, 'en_espera', '1000000002', 'Paciente de Prueba Dos', now() - interval '9 minutes'
from public.especialidades e, public.zonas z where e.codigo = 'GEN' and z.codigo = 'piso1';

insert into public.turnos (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_llegada)
select 'FIN-092', e.id, z.id, 'cita_previa', false, 'en_espera', '1000000003', 'Paciente de Prueba Tres', now() - interval '25 minutes'
from public.especialidades e, public.zonas z where e.codigo = 'FIN' and z.codigo = 'piso1';

insert into public.turnos (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_llegada)
select 'FIN-093', e.id, z.id, 'espontaneo', false, 'en_espera', '1000000004', 'Paciente de Prueba Cuatro', now() - interval '4 minutes'
from public.especialidades e, public.zonas z where e.codigo = 'FIN' and z.codigo = 'piso1';

-- -------------------------------------------------------------------------------------
-- Cita programada de prueba (para probar Check-In por documento: usa "1000000099")
-- -------------------------------------------------------------------------------------
insert into public.turnos (codigo, especialidad_id, zona_id, tipo_turno, es_preferencial, estado, documento_paciente, nombre_paciente, hora_cita, hora_llegada)
select 'CAR-020', e.id, z.id, 'cita_previa', false, 'programado', '1000000099', 'Paciente Con Cita Previa', now() + interval '10 minutes', now()
from public.especialidades e, public.zonas z where e.codigo = 'CAR' and z.codigo = 'piso2';
