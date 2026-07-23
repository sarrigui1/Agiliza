export type RangoId = 'hoy' | 'semana' | 'mes' | 'personalizado';

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function sumarDias(fecha: Date, dias: number): Date {
  const d = new Date(fecha);
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Resuelve un rango predefinido (o personalizado, vía `desdeParam`/`hastaParam` en
 * formato "YYYY-MM-DD") a un par [desde, hasta) de límites de día completos.
 * Usado tanto por /admin/dashboard como por /admin/reportes para que ambos calculen
 * exactamente el mismo rango a partir de los mismos query params.
 */
export function resolverRango(
  rango: RangoId,
  desdeParam?: string,
  hastaParam?: string,
): RangoFechas {
  const hoy = inicioDelDia(new Date());

  if (rango === 'personalizado' && desdeParam && hastaParam) {
    const desde = inicioDelDia(new Date(desdeParam));
    const hasta = sumarDias(inicioDelDia(new Date(hastaParam)), 1);
    return { desde, hasta };
  }

  if (rango === 'semana') {
    const diaIso = hoy.getDay() === 0 ? 7 : hoy.getDay(); // 1=lunes..7=domingo
    const lunes = sumarDias(hoy, -(diaIso - 1));
    return { desde: lunes, hasta: sumarDias(hoy, 1) };
  }

  if (rango === 'mes') {
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: inicioMes, hasta: sumarDias(hoy, 1) };
  }

  // 'hoy' (o fallback si "personalizado" no trae fechas)
  return { desde: hoy, hasta: sumarDias(hoy, 1) };
}

export const OPCIONES_RANGO: { value: RangoId; label: string }[] = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta Semana' },
  { value: 'mes', label: 'Este Mes' },
  { value: 'personalizado', label: 'Personalizado' },
];
