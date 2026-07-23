/**
 * Construye el texto que lee la síntesis de voz (TTS) a partir de `etiqueta_publica`
 * (el string que ya llega enmascarado desde `fn_enmascarar_turno`, ver
 * supabase/migrations/0003_fn_llamar_siguiente_turno.sql). El cliente no sabe qué
 * `formato_privacidad_tv` se usó para generarla, así que se detecta por forma:
 *
 * - Código de ticket ("CAR-014")            -> letras deletreadas + dígitos uno a uno.
 * - Iniciales + cédula parcial ("J.P. (***456)") -> iniciales deletreadas + dígitos uno a uno.
 * - Nombre completo (cualquier otra forma)  -> se lee tal cual.
 */

function deletrear(segmento: string): string {
  return segmento.split('').join(' ');
}

const PATRON_CODIGO = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)-(\d+)$/;
const PATRON_INICIALES = /^((?:[A-Za-zÁÉÍÓÚÑáéíóúñ]\.\s*)+)\(\*{3}(\d{3})\)$/;

export function construirMensajeVoz(etiquetaPublica: string, etiquetaPunto: string): string {
  const texto = etiquetaPublica.trim();

  const matchCodigo = texto.match(PATRON_CODIGO);
  if (matchCodigo) {
    const [, prefijo, numero] = matchCodigo;
    return `Turno ${deletrear(prefijo)}, ${deletrear(numero)}. Favor pasar a ${etiquetaPunto}.`;
  }

  const matchIniciales = texto.match(PATRON_INICIALES);
  if (matchIniciales) {
    const iniciales = matchIniciales[1].replace(/\./g, '').trim();
    const digitos = matchIniciales[2];
    return `Paciente ${deletrear(iniciales)}, con cédula terminada en ${deletrear(digitos)}. Favor pasar a ${etiquetaPunto}.`;
  }

  // Nombre completo u otro formato no reconocido: se lee tal cual.
  return `Paciente ${texto}, favor pasar a ${etiquetaPunto}.`;
}
