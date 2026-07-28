import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Valida `X-Twilio-Signature` según el algoritmo documentado por Twilio:
 * HMAC-SHA1 de (URL exacta + parámetros del POST ordenados alfabéticamente y
 * concatenados como clave+valor), en Base64, usando el Auth Token como llave.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export function verificarFirmaTwilio(
  url: string,
  parametros: Record<string, string>,
  firmaRecibida: string,
  authToken: string,
): boolean {
  const datosOrdenados = Object.keys(parametros)
    .sort()
    .reduce((acc, key) => acc + key + parametros[key], url);

  const firmaCalculada = createHmac('sha1', authToken).update(datosOrdenados, 'utf8').digest('base64');

  const bufCalculada = Buffer.from(firmaCalculada);
  const bufRecibida = Buffer.from(firmaRecibida);
  if (bufCalculada.length !== bufRecibida.length) return false;

  return timingSafeEqual(bufCalculada, bufRecibida);
}
