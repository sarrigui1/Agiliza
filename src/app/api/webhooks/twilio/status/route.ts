import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/admin';
import { verificarFirmaTwilio } from '@/lib/notifications/twilioSignature';
import type { EstadoNotificacion } from '@/types/database';

/**
 * Twilio invoca este endpoint (configurado como `StatusCallback` en cada envío, ver
 * src/lib/notifications/twilioWhatsApp.ts) para reportar sent -> delivered/read/failed.
 * Público en proxy.ts (Twilio no manda cookies de sesión) — se autentica validando
 * `X-Twilio-Signature` con el Auth Token, no con un secreto propio.
 */
export const dynamic = 'force-dynamic';

const MAPA_ESTADO: Record<string, EstadoNotificacion> = {
  sent: 'enviado',
  delivered: 'entregado',
  read: 'leido',
  failed: 'fallido',
  undelivered: 'fallido',
};

export async function POST(request: Request) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return new NextResponse('Twilio no configurado en este despliegue.', { status: 501 });
  }

  const formData = await request.formData();
  const parametros: Record<string, string> = {};
  formData.forEach((value, key) => {
    parametros[key] = String(value);
  });

  const firma = request.headers.get('x-twilio-signature');
  if (!firma || !verificarFirmaTwilio(request.url, parametros, firma, authToken)) {
    return new NextResponse('Firma inválida.', { status: 403 });
  }

  const sid = parametros.MessageSid;
  const estadoTwilio = parametros.MessageStatus;
  if (!sid || !estadoTwilio) {
    return new NextResponse('Payload incompleto.', { status: 400 });
  }

  const estado = MAPA_ESTADO[estadoTwilio];
  if (!estado) {
    // Estados intermedios que Twilio también puede notificar (ej. 'queued', 'accepted')
    // y que no están en nuestro enum — se reconoce el webhook sin tocar la fila.
    return NextResponse.json({ ok: true, ignorado: estadoTwilio });
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from('notificaciones_log')
      .update({
        estado,
        codigo_error: parametros.ErrorCode || null,
        mensaje_error: parametros.ErrorMessage || null,
        updated_at: new Date().toISOString(),
      })
      .eq('twilio_message_sid', sid);

    if (error) {
      Sentry.captureException(new Error(`Webhook Twilio: fallo al actualizar notificaciones_log: ${error.message}`));
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Ej. SUPABASE_SERVICE_ROLE_KEY ausente/inválida: createAdminClient() lanza en vez de
    // devolver un `error` — se captura acá para que el webhook siempre reciba JSON (Twilio
    // reintenta status callbacks fallidos, así que un 500 con JSON es preferible a un crash).
    Sentry.captureException(err);
    const mensaje = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
