export type RangoId = 'hoy' | 'semana' | 'mes' | 'personalizado';

export interface RangoFechas {
  desde: Date;
  hasta: Date;
}

/**
 * Colombia fija en UTC-5 (sin horario de verano — mismo supuesto que ya usa el Cron de
 * cierre de jornada, ver vercel.json). Los "días" de este módulo se calculan explícitamente
 * en esta zona horaria en vez de confiar en `Date.prototype.setHours`/`getDate`, que usan
 * la zona horaria del proceso — en Vercel eso es UTC, no Colombia. Con la versión anterior,
 * cualquier turno creado después de las 7pm hora Colombia caía en el día UTC siguiente y
 * desaparecía del rango "Hoy" hasta el día calendario después (momento en el que aparecía
 * mezclado con datos del día equivocado).
 */
const OFFSET_COLOMBIA_MS = 5 * 60 * 60 * 1000;

/** Instante UTC que representa la medianoche en hora de Colombia del año/mes(0-based)/día dados. */
function medianocheColombia(anio: number, mesIndice0: number, dia: number): Date {
  return new Date(Date.UTC(anio, mesIndice0, dia, 0, 0, 0, 0) + OFFSET_COLOMBIA_MS);
}

/** Componentes de calendario (y día ISO de semana) tal como se ven en hora de Colombia para un instante UTC. */
function componentesColombia(instante: Date) {
  const relojColombia = new Date(instante.getTime() - OFFSET_COLOMBIA_MS);
  const diaSemana = relojColombia.getUTCDay(); // 0=domingo..6=sábado
  return {
    anio: relojColombia.getUTCFullYear(),
    mes: relojColombia.getUTCMonth(),
    dia: relojColombia.getUTCDate(),
    diaSemanaIso: diaSemana === 0 ? 7 : diaSemana, // 1=lunes..7=domingo
  };
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * 86_400_000);
}

/** Parsea un string "YYYY-MM-DD" (del <input type="date">) a sus componentes numéricos. */
function parsearFechaISO(valor: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = valor.split('-').map(Number);
  return { anio, mes: mes - 1, dia };
}

/**
 * Resuelve un rango predefinido (o personalizado, vía `desdeParam`/`hastaParam` en
 * formato "YYYY-MM-DD") a un par [desde, hasta) de límites de día completos, en hora
 * de Colombia. Usado tanto por /admin/dashboard como por /admin/reportes para que ambos
 * calculen exactamente el mismo rango a partir de los mismos query params.
 */
export function resolverRango(
  rango: RangoId,
  desdeParam?: string,
  hastaParam?: string,
): RangoFechas {
  const hoyComponentes = componentesColombia(new Date());
  const hoy = medianocheColombia(hoyComponentes.anio, hoyComponentes.mes, hoyComponentes.dia);

  if (rango === 'personalizado' && desdeParam && hastaParam) {
    const d = parsearFechaISO(desdeParam);
    const h = parsearFechaISO(hastaParam);
    const desde = medianocheColombia(d.anio, d.mes, d.dia);
    const hasta = sumarDias(medianocheColombia(h.anio, h.mes, h.dia), 1);
    return { desde, hasta };
  }

  if (rango === 'semana') {
    const lunes = sumarDias(hoy, -(hoyComponentes.diaSemanaIso - 1));
    return { desde: lunes, hasta: sumarDias(hoy, 1) };
  }

  if (rango === 'mes') {
    const inicioMes = medianocheColombia(hoyComponentes.anio, hoyComponentes.mes, 1);
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

/**
 * Límites [desde, hasta) del día calendario actual en hora de Colombia, como instantes
 * UTC listos para `.gte()/.lte()` en Supabase. Helper para el resto del código que
 * necesita filtrar "hoy" (workspace, supervisor, citas, check-in) sin reimplementar el
 * cálculo de zona horaria — ver la nota junto a `OFFSET_COLOMBIA_MS` más arriba.
 */
export function rangoHoyColombia(): RangoFechas {
  return resolverRango('hoy');
}
