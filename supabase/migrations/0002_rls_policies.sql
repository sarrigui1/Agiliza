-- =====================================================================================
-- FLOWQ — Row Level Security (RLS)
-- Requiere haber ejecutado 0001_init_schema.sql
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. HABILITAR RLS EN TODAS LAS TABLAS
-- -------------------------------------------------------------------------------------
alter table public.perfiles                 enable row level security;
alter table public.especialidades           enable row level security;
alter table public.zonas                    enable row level security;
alter table public.puntos_atencion          enable row level security;
alter table public.agentes_puntos_atencion  enable row level security;
alter table public.configuraciones_globales enable row level security;
alter table public.turnos                   enable row level security;
alter table public.llamados                 enable row level security;
alter table public.auditoria                enable row level security;


-- -------------------------------------------------------------------------------------
-- 2. HELPER: rol del usuario autenticado actual
-- SECURITY DEFINER + search_path fijo para evitar hijacking de esquema.
-- -------------------------------------------------------------------------------------
create or replace function public.fn_rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid();
$$;


-- -------------------------------------------------------------------------------------
-- 3. perfiles
-- -------------------------------------------------------------------------------------
create policy "perfiles_select_propio_o_staff"
  on public.perfiles for select
  using (id = auth.uid() or public.fn_rol_actual() in ('admin', 'supervisor'));

create policy "perfiles_admin_escribe"
  on public.perfiles for all
  using (public.fn_rol_actual() = 'admin')
  with check (public.fn_rol_actual() = 'admin');


-- -------------------------------------------------------------------------------------
-- 4. especialidades / zonas — catálogos de lectura general
-- -------------------------------------------------------------------------------------
create policy "especialidades_lectura_autenticados"
  on public.especialidades for select
  using (auth.role() = 'authenticated');

create policy "especialidades_admin_escribe"
  on public.especialidades for all
  using (public.fn_rol_actual() in ('admin', 'supervisor'))
  with check (public.fn_rol_actual() in ('admin', 'supervisor'));

create policy "zonas_lectura_autenticados"
  on public.zonas for select
  using (auth.role() = 'authenticated');

create policy "zonas_admin_escribe"
  on public.zonas for all
  using (public.fn_rol_actual() in ('admin', 'supervisor'))
  with check (public.fn_rol_actual() in ('admin', 'supervisor'));


-- -------------------------------------------------------------------------------------
-- 5. puntos_atencion
-- Lectura: cualquier autenticado (necesario para totem/recepción listar destinos).
-- Escritura total: admin/supervisor. Los agentes asignados solo pueden cambiar su
-- propio estado operativo (disponible/pausado) vía RPC (ver fn_actualizar_estado_punto,
-- Fase 2) — aquí NO se otorga UPDATE directo a agentes para mantener el control centralizado.
-- -------------------------------------------------------------------------------------
create policy "puntos_atencion_lectura_autenticados"
  on public.puntos_atencion for select
  using (auth.role() = 'authenticated');

create policy "puntos_atencion_admin_escribe"
  on public.puntos_atencion for all
  using (public.fn_rol_actual() in ('admin', 'supervisor'))
  with check (public.fn_rol_actual() in ('admin', 'supervisor'));


-- -------------------------------------------------------------------------------------
-- 6. agentes_puntos_atencion
-- -------------------------------------------------------------------------------------
create policy "asignaciones_select_propio_o_staff"
  on public.agentes_puntos_atencion for select
  using (perfil_id = auth.uid() or public.fn_rol_actual() in ('admin', 'supervisor'));

create policy "asignaciones_admin_escribe"
  on public.agentes_puntos_atencion for all
  using (public.fn_rol_actual() in ('admin', 'supervisor'))
  with check (public.fn_rol_actual() in ('admin', 'supervisor'));


-- -------------------------------------------------------------------------------------
-- 7. configuraciones_globales
-- -------------------------------------------------------------------------------------
create policy "config_lectura_autenticados"
  on public.configuraciones_globales for select
  using (auth.role() = 'authenticated');

create policy "config_admin_actualiza"
  on public.configuraciones_globales for update
  using (public.fn_rol_actual() = 'admin')
  with check (public.fn_rol_actual() = 'admin');


-- -------------------------------------------------------------------------------------
-- 8. turnos (PII)
-- SELECT: admin/supervisor ven todo; recepción ve todo (necesita buscar por documento
-- en cualquier especialidad/zona); agente solo ve turnos de los puntos que tiene asignados.
-- INSERT: recepción/admin/supervisor (alta de turnos en check-in).
-- Sin políticas UPDATE/DELETE: toda transición de estado pasa por RPC `SECURITY DEFINER`
-- (fn_llamar_siguiente_turno y funciones equivalentes de Fase 2), evitando que cualquier
-- rol pueda alterar el estado de un turno saltándose el algoritmo de cola.
-- -------------------------------------------------------------------------------------
create policy "turnos_select_staff"
  on public.turnos for select
  using (
    public.fn_rol_actual() in ('admin', 'supervisor', 'recepcion')
    or exists (
      select 1
      from public.agentes_puntos_atencion apa
      join public.puntos_atencion pa on pa.id = apa.punto_atencion_id
      where apa.perfil_id = auth.uid()
        and pa.especialidad_id = turnos.especialidad_id
        and pa.zona_id = turnos.zona_id
    )
  );

create policy "turnos_insert_recepcion"
  on public.turnos for insert
  with check (public.fn_rol_actual() in ('recepcion', 'admin', 'supervisor'));


-- -------------------------------------------------------------------------------------
-- 9. llamados — dato público anonimizado, fuente del TV Display
-- -------------------------------------------------------------------------------------
create policy "llamados_select_publico"
  on public.llamados for select
  using (true); -- anon + authenticated: el registro ya no contiene PII


-- -------------------------------------------------------------------------------------
-- 10. auditoria — solo supervisión/admin; el INSERT lo hacen las funciones RPC
-- -------------------------------------------------------------------------------------
create policy "auditoria_select_supervisores"
  on public.auditoria for select
  using (public.fn_rol_actual() in ('admin', 'supervisor'));


-- -------------------------------------------------------------------------------------
-- 11. GRANTS explícitos
-- RLS restringe filas, pero Postgres exige además el privilegio de tabla correspondiente.
-- -------------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- Acceso público (TV Display, sin sesión)
grant select on public.llamados to anon;

-- Acceso autenticado (staff)
grant select on public.llamados to authenticated;
grant select, insert, update on public.perfiles to authenticated;
grant select on public.especialidades, public.zonas, public.puntos_atencion,
  public.agentes_puntos_atencion, public.configuraciones_globales to authenticated;
grant select, insert on public.turnos to authenticated;
grant select on public.auditoria to authenticated;

-- Escritura de catálogos y configuración queda acotada por las policies "all" de arriba,
-- pero igualmente se otorgan los privilegios base para que RLS pueda evaluarlos:
grant insert, update, delete on public.especialidades, public.zonas, public.puntos_atencion,
  public.agentes_puntos_atencion to authenticated;
grant update on public.configuraciones_globales to authenticated;
