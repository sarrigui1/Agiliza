-- =====================================================================================
-- AGILIZA — Motor de notificaciones WhatsApp (Twilio)
--
-- Switch maestro + toggles por evento + costeo (USD/COP con TRM) + bitácora de envíos.
-- Las credenciales de Twilio (Account SID, Auth Token, número emisor) NO se guardan acá:
-- viven como variables de entorno server-only (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
-- TWILIO_WHATSAPP_NUMBER — ver .env.local.example), igual que SUPABASE_SERVICE_ROLE_KEY.
-- Guardarlas en una tabla editable desde el panel admin las expondría en texto plano a
-- cualquier fila legible por 'admin'/'supervisor' — un riesgo innecesario cuando el env
-- var ya resuelve el mismo problema con el mismo patrón que el resto del proyecto.
--
-- El motor de disparo (src/lib/notifications/) y el webhook de estado
-- (src/app/api/webhooks/twilio/status) escriben con el cliente Service Role — por eso
-- notificaciones_log no tiene policy de insert/update para 'authenticated', igual que
-- fn_cerrar_jornada.
-- =====================================================================================

create type estado_notificacion as enum ('pendiente', 'enviado', 'entregado', 'leido', 'fallido');

create type tipo_evento_notificacion as enum (
  'checkin_exitoso',
  'pre_llamado',
  'llamado_modulo',
  'recordatorio_cita',
  'encuesta_post_atencion'
);

-- Teléfono opcional del paciente — solo se pide/usa si el switch maestro está activo.
alter table public.turnos
  add column if not exists telefono_paciente text;

-- -------------------------------------------------------------------------------------
-- Configuración (singleton, mismo patrón que configuraciones_globales)
-- -------------------------------------------------------------------------------------
create table public.notificaciones_configuracion (
  id                          int primary key default 1,
  habilitado                  boolean not null default false,
  notificar_checkin           boolean not null default false,
  notificar_pre_llamado       boolean not null default false,
  notificar_llamado           boolean not null default false,
  notificar_recordatorio_cita boolean not null default false,
  notificar_encuesta          boolean not null default false,
  umbral_pre_llamado          int not null default 2,
  minutos_delay_encuesta      int not null default 15,
  costo_sesion_utilidad_usd   numeric(10, 4) not null default 0.0158,
  trm_cop                     numeric(10, 2) not null default 4000,
  updated_at                  timestamptz not null default now(),
  actualizado_por             uuid references public.perfiles(id),
  constraint notificaciones_configuracion_singleton check (id = 1)
);

insert into public.notificaciones_configuracion (id) values (1);

comment on table public.notificaciones_configuracion is
  'Fila única (id=1). Switch maestro + toggles por evento + costeo del motor de notificaciones WhatsApp. No contiene credenciales de Twilio (ver env vars).';

-- -------------------------------------------------------------------------------------
-- Bitácora / libro de costos
-- -------------------------------------------------------------------------------------
create table public.notificaciones_log (
  id                 uuid primary key default gen_random_uuid(),
  turno_id           uuid references public.turnos(id),
  tipo_evento        tipo_evento_notificacion not null,
  telefono_destino   text not null,
  estado             estado_notificacion not null default 'pendiente',
  costo_usd          numeric(10, 4),
  costo_cop          numeric(10, 2),
  trm_aplicada       numeric(10, 2),
  twilio_message_sid text,
  codigo_error       text,
  mensaje_error      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_notificaciones_log_tipo_evento on public.notificaciones_log (tipo_evento, created_at desc);
create index idx_notificaciones_log_estado on public.notificaciones_log (estado);
create index idx_notificaciones_log_sid on public.notificaciones_log (twilio_message_sid);

comment on table public.notificaciones_log is
  'Auditoría y costeo de cada intento de notificación. estado se actualiza vía webhook de Twilio (enviado -> entregado/leido/fallido).';

-- -------------------------------------------------------------------------------------
-- RLS
-- -------------------------------------------------------------------------------------
alter table public.notificaciones_configuracion enable row level security;
alter table public.notificaciones_log enable row level security;

create policy "notif_config_select_staff"
  on public.notificaciones_configuracion for select
  using (public.fn_rol_actual() in ('admin', 'supervisor'));

create policy "notif_config_update_admin"
  on public.notificaciones_configuracion for update
  using (public.fn_rol_actual() = 'admin')
  with check (public.fn_rol_actual() = 'admin');

create policy "notif_log_select_staff"
  on public.notificaciones_log for select
  using (public.fn_rol_actual() in ('admin', 'supervisor'));

grant select, update on public.notificaciones_configuracion to authenticated;
grant select on public.notificaciones_log to authenticated;
