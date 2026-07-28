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
