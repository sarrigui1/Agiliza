-- =====================================================================================
-- FLOWQ — Plantilla para vincular usuarios de Auth con perfiles/roles y puntos de atención.
--
-- Los usuarios de autenticación NO se crean por SQL (GoTrue maneja el hash de contraseña
-- y la validación de email) — créalos primero en el Dashboard:
--   Authentication → Users → Add user → (email + password, marca "Auto Confirm User")
--
-- Después de crear cada usuario, copia su UUID (columna "id" en la lista de usuarios) y
-- reemplázalo abajo antes de ejecutar este script en el SQL Editor.
-- =====================================================================================

-- 1) Administrador — accede a /admin/settings y /admin/supervisor
insert into public.perfiles (id, nombre_completo, rol)
values ('08351068-602a-4544-af6d-a9b1ed7262ae', 'Administrador FlowQ', 'admin');

-- 2) Agente — accede a /workspace. Se vincula al punto de atención "Consultorio 5".
insert into public.perfiles (id, nombre_completo, rol)
values ('56960b31-fcc7-4e04-9cbb-c57259a693ff', 'Carlos Ruiz', 'agente');

insert into public.agentes_puntos_atencion (perfil_id, punto_atencion_id)
select '56960b31-fcc7-4e04-9cbb-c57259a693ff', pa.id
from public.puntos_atencion pa
where pa.codigo = 'CONS-05';

-- 3) Recepción — usado como sesión del tótem/dispositivo en /checkin.
insert into public.perfiles (id, nombre_completo, rol)
values ('b6b3a676-d852-4c34-8a11-272c944cc743', 'Recepción Principal', 'recepcion');
