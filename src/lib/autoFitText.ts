/**
 * Tamaño de fuente (px) inversamente proporcional a la longitud del texto, para que
 * un código corto ("CAR-014"), una etiqueta enmascarada más larga ("A.A. (***514)") o
 * un nombre completo largo quepan siempre en el mismo contenedor del TV Display sin
 * desbordarlo — en vez de un tamaño fijo que se rompe con las etiquetas más largas.
 */
export function calcularTamanoFuente(
  texto: string,
  opciones: { max: number; min: number; factor: number },
): number {
  const largo = Math.max(texto.length, 1);
  const tamano = opciones.factor / largo;
  return Math.min(opciones.max, Math.max(opciones.min, Math.round(tamano)));
}
