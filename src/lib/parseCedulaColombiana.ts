/**
 * Parser del código de barras PDF417 de la cédula de ciudadanía colombiana.
 *
 * El formato documentado de la Registraduría separa los campos con '@'. La posición
 * exacta del número de documento varía entre versiones del carné (algunas traen un
 * código de control antes del número, otras no), así que en vez de asumir un índice
 * fijo, se busca el primer campo puramente numérico de longitud razonable — funciona
 * para ambos layouts sin necesidad de detectar la versión del documento.
 *
 * IMPORTANTE: validar contra una cédula física real (lector USB/Bluetooth o cámara)
 * antes de confiar en esto en producción. No hay una cédula de prueba disponible en
 * este entorno de desarrollo para verificar el layout exacto byte a byte, y los campos
 * posteriores al nombre (sexo, fecha de nacimiento, lugar de nacimiento) a veces vienen
 * codificados en binario en vez de texto plano según la versión del carné — por eso
 * este parser solo confía en los campos de texto (documento y nombres).
 */
export interface CedulaParseada {
  numeroDocumento: string;
  primerApellido: string;
  segundoApellido: string;
  primerNombre: string;
  segundoNombre: string;
  nombreCompleto: string;
}

const REGEX_DOCUMENTO = /^\d{5,15}$/;

export function parseCedulaColombiana(rawData: string): CedulaParseada | null {
  const texto = rawData.trim();
  if (!texto) return null;

  const campos = texto
    .split('@')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  const idxDocumento = campos.findIndex((c) => REGEX_DOCUMENTO.test(c));
  if (idxDocumento === -1) return null;

  const numeroDocumento = campos[idxDocumento];
  const [primerApellido = '', segundoApellido = '', primerNombre = '', segundoNombre = ''] = campos.slice(
    idxDocumento + 1,
  );

  const nombreCompleto = [primerNombre, segundoNombre, primerApellido, segundoApellido]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!nombreCompleto) return null;

  return { numeroDocumento, primerApellido, segundoApellido, primerNombre, segundoNombre, nombreCompleto };
}
