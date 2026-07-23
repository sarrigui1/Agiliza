-- =====================================================================================
-- FLOWQ — Sistema de Llamado y Gestión de Turnos
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
