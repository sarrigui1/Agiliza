/** Plantillas de texto por evento — WhatsApp no soporta HTML, `*texto*` es negrita nativa. */

export function mensajeCheckinExitoso(nombre: string, codigo: string, minutosEstimados: number): string {
  return (
    `Hola ${nombre}, tu turno *${codigo}* fue registrado. ` +
    `Tiempo estimado de espera: ~${minutosEstimados} min. ` +
    `Te avisaremos por este medio cuando se acerque tu turno. — Agiliza`
  );
}

export function mensajeLlamadoModulo(nombre: string, codigo: string, puntoAtencion: string): string {
  return `${nombre}, tu turno *${codigo}* fue llamado. Por favor dirígete a *${puntoAtencion}*. — Agiliza`;
}
