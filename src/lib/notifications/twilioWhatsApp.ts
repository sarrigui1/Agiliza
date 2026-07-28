/**
 * Cliente mínimo de la API de Twilio para WhatsApp — un `fetch` directo en vez de agregar
 * el SDK `twilio` (varios MB, y solo se necesita un endpoint) siguiendo Basic Auth con
 * Account SID + Auth Token, tal como documenta Twilio.
 */
export interface ResultadoEnvioWhatsApp {
  ok: boolean;
  sid?: string;
  codigo?: string;
  mensaje?: string;
}

function urlWebhookEstado(): string | undefined {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return base ? `${base}/api/webhooks/twilio/status` : undefined;
}

export async function enviarWhatsApp(telefonoE164: string, cuerpo: string): Promise<ResultadoEnvioWhatsApp> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const numeroEmisor = process.env.TWILIO_WHATSAPP_NUMBER;

  if (!accountSid || !authToken || !numeroEmisor) {
    return {
      ok: false,
      mensaje: 'Credenciales de Twilio no configuradas (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER).',
    };
  }

  const cuerpoFormulario = new URLSearchParams({
    To: `whatsapp:${telefonoE164}`,
    From: `whatsapp:${numeroEmisor}`,
    Body: cuerpo,
  });

  const statusCallback = urlWebhookEstado();
  if (statusCallback) cuerpoFormulario.set('StatusCallback', statusCallback);

  try {
    const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: cuerpoFormulario,
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      return {
        ok: false,
        codigo: String(datos.code ?? respuesta.status),
        mensaje: typeof datos.message === 'string' ? datos.message : 'Error desconocido de la API de Twilio.',
      };
    }

    return { ok: true, sid: datos.sid as string };
  } catch (err) {
    return { ok: false, mensaje: err instanceof Error ? err.message : 'Error de red al contactar Twilio.' };
  }
}
