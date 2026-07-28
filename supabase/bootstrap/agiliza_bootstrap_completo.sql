-- =====================================================================================
-- AGILIZA — Bootstrap completo de base de datos para cliente nuevo
-- Concatenación de supabase/migrations/0001..0017 en orden, generada automáticamente.
-- NO editar este archivo a mano — para cambios, edita las migraciones individuales en
-- supabase/migrations/ y vuelve a generar este archivo (ver docs/ONBOARDING_CLIENTE_NUEVO.md).
--
-- Uso: pega el contenido completo de este archivo UNA SOLA VEZ en el SQL Editor de un
-- proyecto Supabase nuevo. Reemplaza correr las 17 migraciones una por una.
-- =====================================================================================


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0001_init_schema.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Sistema de Llamado y Gestión de Turnos
-- Fase 1: Cimentación Técnica y Base de Datos
-- Ejecutar en el Editor SQL de Supabase (o vía `supabase db push`)
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 0. EXTENSIONES
-- -------------------------------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -------------------------------------------------------------------------------------
-- 1. ENUMS
-- -------------------------------------------------------------------------------------

-- Rol funcional del usuario dentro del sistema
create type rol_usuario as enum ('admin', 'supervisor', 'agente', 'recepcion');

-- Ciclo de vida completo del turno (ver Sección 5 del doc de especificación técnica)
create type estado_turno as enum (
  'programado',   -- cita agendada, paciente aún no llega
  'en_espera',    -- en cola activa (tras check-in o alta espontánea)
  'llamado',      -- fue anunciado por un punto de atención
  'en_atencion',  -- el agente inició la consulta
  'finalizado',   -- atención completada
  'cancelado',    -- anulado (por sistema, agente o cierre nocturno)
  'ausente',      -- superó el límite de llamados sin presentarse
  'reingresado'   -- ausente que fue reincorporado a la cola (con penalización)
);

-- Origen del turno
create type tipo_turno as enum ('cita_previa', 'espontaneo');

-- Algoritmo de ordenamiento configurable (Módulo 1)
create type algoritmo_cola as enum ('hora_cita', 'orden_llegada', 'hibrido');

-- Nivel de anonimización mostrado en pantallas TV (Módulo 1 / Módulo 4)
create type formato_privacidad_tv as enum ('solo_codigo', 'iniciales_parcial', 'nombre_completo');

-- Estado operativo de un punto de atención
create type estado_punto_atencion as enum ('fuera_de_linea', 'disponible', 'atendiendo', 'pausado');

-- Tipo de evento de llamado (para el log público `llamados`)
create type tipo_llamado as enum ('inicial', 're_llamado', 'prioritario');


-- -------------------------------------------------------------------------------------
-- 2. TABLA: perfiles
-- Extiende auth.users con el rol funcional. Se crea automáticamente via trigger
-- (ver 0002_auth_trigger.sql en Fase 2) o manualmente por el admin.
-- -------------------------------------------------------------------------------------
create table public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text not null,
  rol            rol_usuario not null default 'agente',
  activo         boolean not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.perfiles is 'Extiende auth.users con el rol funcional del staff (admin, supervisor, agente, recepción).';


-- -------------------------------------------------------------------------------------
-- 3. TABLA: especialidades (servicios)
-- -------------------------------------------------------------------------------------
create table public.especialidades (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,  -- prefijo del ticket, ej: 'CAR', 'GEN', 'FIN'
  nombre     text not null,         -- 'Cardiología'
  activo     boolean not null default true,
  created_at timestamptz not null default now()
);


-- -------------------------------------------------------------------------------------
-- 4. TABLA: zonas
-- Vincula pantallas TV a salas físicas mediante /display?zone=<codigo>
-- -------------------------------------------------------------------------------------
create table public.zonas (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,  -- 'piso2', usado en la URL del display
  nombre      text not null,         -- 'Piso 2 - Consulta Externa'
  descripcion text,
  created_at  timestamptz not null default now()
);


-- -------------------------------------------------------------------------------------
-- 5. TABLA: puntos_atencion (módulos, cajas, consultorios)
-- -------------------------------------------------------------------------------------
create table public.puntos_atencion (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,               -- 'CONS-05'
  nombre             text not null,                       -- 'Consultorio 5'
  zona_id            uuid not null references public.zonas(id),
  especialidad_id    uuid references public.especialidades(id),
  estado             estado_punto_atencion not null default 'fuera_de_linea',
  agente_actual_id   uuid references public.perfiles(id),
  created_at         timestamptz not null default now()
);

create index idx_puntos_atencion_zona on public.puntos_atencion (zona_id);
create index idx_puntos_atencion_especialidad on public.puntos_atencion (especialidad_id);


-- -------------------------------------------------------------------------------------
-- 6. TABLA: agentes_puntos_atencion
-- Asignación de permisos: qué agentes pueden operar qué puntos de atención.
-- Es la base de las políticas RLS de `turnos` (un agente solo ve/opera su cola).
-- -------------------------------------------------------------------------------------
create table public.agentes_puntos_atencion (
  perfil_id         uuid not null references public.perfiles(id) on delete cascade,
  punto_atencion_id uuid not null references public.puntos_atencion(id) on delete cascade,
  primary key (perfil_id, punto_atencion_id)
);


-- -------------------------------------------------------------------------------------
-- 7. TABLA: configuraciones_globales (singleton — Módulo 1)
-- -------------------------------------------------------------------------------------
create table public.configuraciones_globales (
  id                            smallint primary key default 1 check (id = 1),
  algoritmo_cola                algoritmo_cola not null default 'hibrido',
  minutos_checkin_previo        int not null default 15,
  minutos_tolerancia            int not null default 10,
  segundos_intervalo_rellamado  int not null default 30,
  limite_llamados_ausencia      int not null default 3,
  reingreso_penalizado          boolean not null default true,
  formato_privacidad_tv         formato_privacidad_tv not null default 'solo_codigo',
  intercalado_preferencial      int not null default 1,   -- proporción Ley
  intercalado_normal            int not null default 2,   -- proporción Normal (ej. 1:2)
  updated_at                    timestamptz not null default now(),
  actualizado_por               uuid references public.perfiles(id)
);

comment on table public.configuraciones_globales is 'Fila única (id=1) con las reglas de negocio editables desde el panel de administración.';

insert into public.configuraciones_globales (id) values (1);


-- -------------------------------------------------------------------------------------
-- 8. TABLA: turnos
-- Contiene PII (documento, nombre) — nunca expuesta a `anon`.
-- -------------------------------------------------------------------------------------
create table public.turnos (
  id                  uuid primary key default gen_random_uuid(),
  codigo              text not null,                 -- ticket alfanumérico, ej: 'CAR-014'
  especialidad_id     uuid not null references public.especialidades(id),
  zona_id             uuid not null references public.zonas(id),
  tipo_turno          tipo_turno not null default 'espontaneo',
  es_preferencial     boolean not null default false, -- turno Ley
  estado              estado_turno not null default 'en_espera',

  documento_paciente  text not null,
  nombre_paciente     text not null,

  hora_cita           timestamptz,          -- solo si tipo_turno = 'cita_previa'
  hora_llegada        timestamptz not null default now(), -- check-in / alta

  punto_atencion_id   uuid references public.puntos_atencion(id),
  hora_llamado        timestamptz,
  hora_atencion       timestamptz,
  hora_finalizacion   timestamptz,
  intentos_llamado    int not null default 0,

  turno_origen_id     uuid references public.turnos(id), -- ruta multiespecialidad (derivación)
  motivo_auditoria    text,                               -- justificación de salto de cola

  creado_por          uuid references public.perfiles(id),
  created_at          timestamptz not null default now()
);

comment on column public.turnos.turno_origen_id is 'Referencia al turno previo cuando el paciente fue derivado a una 2da especialidad.';
comment on column public.turnos.motivo_auditoria is 'Motivo registrado al usar "Salto de Cola Autorizado" (ej. Urgencia médica).';

-- Índices de rendimiento para lecturas en tiempo real (cola activa por zona/especialidad/estado)
create index idx_turnos_especialidad_zona_estado
  on public.turnos (especialidad_id, zona_id, estado);
create index idx_turnos_punto_atencion
  on public.turnos (punto_atencion_id) where punto_atencion_id is not null;
create index idx_turnos_documento
  on public.turnos (documento_paciente);
create index idx_turnos_estado_hora_llegada
  on public.turnos (estado, hora_llegada) where estado = 'en_espera';


-- -------------------------------------------------------------------------------------
-- 9. TABLA: llamados
-- Log de eventos de llamado — fuente de Realtime para el TV Display.
-- SIEMPRE anonimizado: nunca contiene documento_paciente ni nombre_paciente crudo.
-- -------------------------------------------------------------------------------------
create table public.llamados (
  id                     uuid primary key default gen_random_uuid(),
  turno_id               uuid not null references public.turnos(id),
  punto_atencion_id      uuid not null references public.puntos_atencion(id),
  zona_id                uuid not null,             -- denormalizado: permite filtro directo de Realtime
  etiqueta_publica       text not null,              -- ya enmascarada según formato_privacidad_tv
  etiqueta_punto_atencion text not null,             -- ej. 'Consultorio 5'
  tipo_llamado           tipo_llamado not null default 'inicial',
  agente_id              uuid references public.perfiles(id),
  created_at             timestamptz not null default now()
);

create index idx_llamados_zona_created on public.llamados (zona_id, created_at desc);


-- -------------------------------------------------------------------------------------
-- 10. TABLA: auditoria
-- Trazabilidad de saltos de cola, reasignaciones masivas y cierres de jornada.
-- -------------------------------------------------------------------------------------
create table public.auditoria (
  id         uuid primary key default gen_random_uuid(),
  agente_id  uuid references public.perfiles(id),
  accion     text not null,   -- 'salto_de_cola' | 'reasignacion_masiva' | 'cierre_jornada'
  turno_id   uuid references public.turnos(id),
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_auditoria_accion_created on public.auditoria (accion, created_at desc);


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0002_rls_policies.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Row Level Security (RLS)
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0003_fn_llamar_siguiente_turno.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — RPC: fn_llamar_siguiente_turno
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0004_rpc_operativas.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Fase 2: RPCs operativas restantes
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0005_fn_confirmar_checkin.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Fase 2 (soporte): fn_confirmar_checkin
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0006_rpc_atencion.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Fase 3: RPCs de atención en consultorio
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0007_realtime_publication.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Habilita Supabase Realtime (WebSockets) sobre las tablas que lo necesitan.
--
-- Sin esto, los canales `postgres_changes` de useRealtimeCalls/useRealtimeTurnos se
-- suscriben correctamente pero Postgres nunca emite el evento lógico de replicación,
-- así que la UI solo se actualiza al recargar la página. Detectado probando el flujo
-- end-to-end: fn_llamar_siguiente_turno se ejecutaba bien, pero /workspace y /display
-- no reflejaban el cambio hasta refrescar.
-- =====================================================================================

alter publication supabase_realtime add table public.turnos;
alter publication supabase_realtime add table public.llamados;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0008_fn_cerrar_jornada.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Cierre de jornada (Vercel Cron Job nocturno)
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0009_zonas_activo.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Módulo de Gestión de Infraestructura Operativa
-- `zonas` no tenía forma de desactivarse (a diferencia de `especialidades`, que ya
-- traía `activo` desde 0001). Se necesita para el toggle Activa/Inactiva del admin.
-- =====================================================================================

alter table public.zonas
  add column if not exists activo boolean not null default true;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0010_zonas_lectura_publica.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Permite lectura pública (anon) de `zonas`
--
-- Bug real: /display?zone=piso2 corre sin sesión (rol anon), pero la política
-- `zonas_lectura_autenticados` (0002_rls_policies.sql) solo permitía rol `authenticated`.
-- RLS no lanza error al bloquear — simplemente no devuelve filas — así que la página
-- siempre mostraba "Zona no encontrada" aunque la zona sí existiera.
--
-- El contenido de `zonas` (nombres de piso/sala, ej. "Piso 2 - Consulta Externa") no es
-- sensible — el propio código de zona ya viaja expuesto en la URL pública del display —
-- así que se abre a lectura pública, igual que ya se hizo con `llamados`.
-- =====================================================================================

drop policy if exists "zonas_lectura_autenticados" on public.zonas;

create policy "zonas_lectura_publica"
  on public.zonas for select
  using (true);

grant select on public.zonas to anon;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0011_analytics.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Módulo de Analytics Ejecutivo
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


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0012_modo_audio_tv.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Modo de audio del TV Display (Tono / Voz / Tono + Voz)
--
-- También abre `configuraciones_globales` a lectura pública (anon): el TV Display corre
-- sin sesión y necesita saber qué modo de audio usar. Nada en esta tabla es sensible
-- (algoritmo de cola, tolerancias, formato de privacidad, modo de audio) — mismo
-- criterio ya aplicado a `zonas` en 0010_zonas_lectura_publica.sql.
-- =====================================================================================

create type modo_audio_tv as enum ('tono', 'voz', 'tono_voz');

alter table public.configuraciones_globales
  add column if not exists modo_audio_tv modo_audio_tv not null default 'tono_voz';

drop policy if exists "config_lectura_autenticados" on public.configuraciones_globales;

create policy "config_lectura_publica"
  on public.configuraciones_globales for select
  using (true);

grant select on public.configuraciones_globales to anon;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0013_especialidades_lectura_publica.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Permite lectura pública (anon) de `especialidades`
--
-- Mismo bug real que 0010_zonas_lectura_publica.sql: /checkin corre sin sesión (rol
-- anon), pero la política `especialidades_lectura_autenticados` (0002_rls_policies.sql)
-- solo permitía rol `authenticated`. RLS no lanza error al bloquear — simplemente no
-- devuelve filas — así que el selector de especialidad en el tótem de auto-servicio
-- siempre aparecía vacío aunque las especialidades existieran y estuvieran activas.
--
-- Solo se exponen las especialidades activas al público (a diferencia de `zonas`, cuyo
-- código de zona ya viaja en la URL); el catálogo completo sigue restringido a personal
-- autenticado vía `especialidades_admin_escribe`.
-- =====================================================================================

drop policy if exists "especialidades_lectura_autenticados" on public.especialidades;

create policy "especialidades_lectura_autenticados"
  on public.especialidades for select
  to authenticated
  using (true);

create policy "especialidades_lectura_publica_activas"
  on public.especialidades for select
  to anon
  using (activo = true);

grant select on public.especialidades to anon;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0014_citas_programadas.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Módulo de Citas Programadas opcional
--
-- `permitir_citas_programadas` decide si /checkin ofrece el flujo de "Tengo Cita
-- Programada" o entra directo al registro de turno espontáneo. Por defecto queda
-- desactivado (false): la mayoría de sedes operan solo por orden de llegada y el
-- selector de dos tarjetas es una fricción innecesaria si nunca hay citas que validar.
-- =====================================================================================

alter table public.configuraciones_globales
  add column if not exists permitir_citas_programadas boolean not null default false;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0015_lectura_cedula.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Lectura de cédula (PDF417) opcional en Check-In
--
-- `permitir_lectura_cedula` decide si /checkin muestra el aviso de "acerca el código de
-- barras..." y el botón de escaneo por cámara (además de escuchar un lector físico
-- USB/Bluetooth, que de todas formas solo hace algo si el sitio realmente tiene uno).
-- Por defecto queda desactivado (false) — mismo criterio que
-- `permitir_citas_programadas` (0014): la mayoría de sedes no tienen lector físico
-- todavía, y mostrar el aviso sin que haya nada que lo respalde es solo ruido visual.
-- =====================================================================================

alter table public.configuraciones_globales
  add column if not exists permitir_lectura_cedula boolean not null default false;


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0016_tema_visual.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Modo claro (Light Mode) opcional, configurable a nivel de sede
--
-- `tema_visual` decide la paleta de TODA la aplicación (TV, check-in, workspace, panel
-- admin) — es una preferencia de sede, no de usuario individual, consistente con el
-- resto de `configuraciones_globales`. Por defecto queda 'oscuro' (el único modo que
-- existía hasta ahora) para no cambiar la apariencia de ningún despliegue existente sin
-- que un admin lo elija explícitamente.
-- =====================================================================================

create type tema_visual as enum ('oscuro', 'claro');

alter table public.configuraciones_globales
  add column if not exists tema_visual tema_visual not null default 'oscuro';


-- ------------------------------------------------------------------------------------
-- Origen: supabase/migrations/0017_texto_informativo_tv.sql
-- ------------------------------------------------------------------------------------
-- =====================================================================================
-- AGILIZA — Texto informativo del TV Display, configurable por sede
--
-- El ticker inferior del TV Display traía un texto fijo en el código ("tenga su
-- identificación a mano...", "puede agendar su cita desde la app..."). Cada sede tiene
-- avisos distintos que dar a sus pacientes, así que se mueve a `configuraciones_globales`
-- — el admin lo edita en /admin/settings sin necesitar un despliegue de código.
-- El valor por defecto es el mismo texto que ya estaba, para no cambiar la pantalla de
-- ningún despliegue existente hasta que un admin lo edite a propósito.
-- =====================================================================================

alter table public.configuraciones_globales
  add column if not exists texto_informativo_tv text not null default
    'Por favor, tenga su identificación a mano para agilizar la atención   |   Recuerde que puede agendar su cita desde la app   |   Sistema de Gestión de Turnos — Agiliza';

