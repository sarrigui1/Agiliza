import { createAdminClient } from '@/lib/supabase/admin';
import { enviarWhatsApp } from './twilioWhatsApp';
import { formatearTelefonoE164 } from './phone';
import type { TipoEventoNotificacion, NotificacionesConfiguracion } from '@/types/database';

interface DispararNotificacionInput {
  turnoId: string;
  telefono: string | null | undefined;
  tipoEvento: TipoEventoNotificacion;
  mensaje: string;
}

const TOGGLE_POR_EVENTO: Record<TipoEventoNotificacion, keyof NotificacionesConfiguracion> = {
  checkin_exitoso: 'notificar_checkin',
  pre_llamado: 'notificar_pre_llamado',
  llamado_modulo: 'notificar_llamado',
  recordatorio_cita: 'notificar_recordatorio_cita',
  encuesta_post_atencion: 'notificar_encuesta',
};

/**
 * Interceptor de eventos del motor de notificaciones. Verifica el switch maestro y el
 * toggle del evento puntual, calcula el costo estimado, registra el intento en
 * notificaciones_log, y despacha a Twilio — en ese orden, para que el costo quede
 * auditado incluso si el envío falla.
 *
 * Usa el cliente Service Role: no corre bajo la sesión del paciente ni del recepcionista,
 * y notificaciones_log no tiene policy de insert para 'authenticated' (ver 0019).
 *
 * Pensado para invocarse dentro de `after()` (next/server) desde la Server Action que
 * dispara el evento, para no sumar latencia de red de Twilio a la respuesta del usuario.
 */
export async function dispararNotificacion(input: DispararNotificacionInput): Promise<void> {
  if (!input.telefono) return;

  const supabase = createAdminClient();

  const { data: config } = await supabase
    .from('notificaciones_configuracion')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (!config || !config.habilitado) return;
  if (!config[TOGGLE_POR_EVENTO[input.tipoEvento]]) return;

  const telefonoE164 = formatearTelefonoE164(input.telefono);
  if (!telefonoE164) return;

  const costoUsd = Number(config.costo_sesion_utilidad_usd);
  const trm = Number(config.trm_cop);

  const { data: logRow } = await supabase
    .from('notificaciones_log')
    .insert({
      turno_id: input.turnoId,
      tipo_evento: input.tipoEvento,
      telefono_destino: telefonoE164,
      estado: 'pendiente',
      costo_usd: costoUsd,
      costo_cop: Math.round(costoUsd * trm),
      trm_aplicada: trm,
    })
    .select('id')
    .single();

  const resultado = await enviarWhatsApp(telefonoE164, input.mensaje);

  if (!logRow) return; // no se pudo auditar el intento; no bloquea el flujo del turno

  await supabase
    .from('notificaciones_log')
    .update({
      estado: resultado.ok ? 'enviado' : 'fallido',
      twilio_message_sid: resultado.ok ? resultado.sid ?? null : null,
      codigo_error: resultado.ok ? null : (resultado.codigo ?? null),
      mensaje_error: resultado.ok ? null : (resultado.mensaje ?? null),
      updated_at: new Date().toISOString(),
    })
    .eq('id', logRow.id);
}
