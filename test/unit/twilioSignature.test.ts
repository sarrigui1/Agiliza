import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { verificarFirmaTwilio } from '@/lib/notifications/twilioSignature';

/** Firma una URL+params exactamente como Twilio, para generar firmas válidas de prueba. */
function firmar(url: string, params: Record<string, string>, authToken: string): string {
  const datos = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac('sha1', authToken).update(datos, 'utf8').digest('base64');
}

describe('verificarFirmaTwilio', () => {
  const authToken = 'test-auth-token-abc123';
  const url = 'https://agiliza.example.com/api/webhooks/twilio/status';
  const params = { MessageSid: 'SM1234567890abcdef1234567890abcdef', MessageStatus: 'delivered' };

  it('acepta una firma calculada correctamente con el algoritmo real de Twilio', () => {
    const firmaValida = firmar(url, params, authToken);
    expect(verificarFirmaTwilio(url, params, firmaValida, authToken)).toBe(true);
  });

  it('rechaza una firma con el Auth Token equivocado', () => {
    const firmaConOtroToken = firmar(url, params, 'otro-token-distinto');
    expect(verificarFirmaTwilio(url, params, firmaConOtroToken, authToken)).toBe(false);
  });

  it('rechaza una firma si cambia cualquier parámetro (payload alterado)', () => {
    const firmaValida = firmar(url, params, authToken);
    const paramsAlterados = { ...params, MessageStatus: 'failed' };
    expect(verificarFirmaTwilio(url, paramsAlterados, firmaValida, authToken)).toBe(false);
  });

  it('rechaza una firma si cambia la URL (ej. ambiente equivocado)', () => {
    const firmaValida = firmar(url, params, authToken);
    expect(verificarFirmaTwilio('https://otro-dominio.com/webhook', params, firmaValida, authToken)).toBe(false);
  });

  it('rechaza una firma arbitraria/vacía sin lanzar excepción', () => {
    expect(verificarFirmaTwilio(url, params, '', authToken)).toBe(false);
    expect(verificarFirmaTwilio(url, params, 'firma-inventada', authToken)).toBe(false);
  });

  it('es insensible al orden en que llegan los parámetros (se ordenan antes de firmar)', () => {
    const firmaValida = firmar(url, params, authToken);
    const paramsInvertidos = { MessageStatus: params.MessageStatus, MessageSid: params.MessageSid };
    expect(verificarFirmaTwilio(url, paramsInvertidos, firmaValida, authToken)).toBe(true);
  });
});
