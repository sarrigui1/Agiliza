/**
 * Formatea un teléfono capturado en Check-In a E.164 para WhatsApp (Colombia por defecto).
 * Devuelve null si el formato no es reconocible — se prefiere no enviar a descartar el
 * turno completo por un dato de contacto mal digitado.
 */
export function formatearTelefonoE164(raw: string): string | null {
  const valor = raw.trim();
  const soloDigitos = valor.replace(/\D/g, '');
  if (!soloDigitos) return null;

  if (valor.startsWith('+')) {
    return soloDigitos.length >= 8 ? `+${soloDigitos}` : null;
  }
  if (soloDigitos.length === 10) {
    return `+57${soloDigitos}`;
  }
  if (soloDigitos.length === 12 && soloDigitos.startsWith('57')) {
    return `+${soloDigitos}`;
  }
  return null;
}
