import { describe, it, expect, afterEach, vi } from 'vitest';
import { resolverRango } from '@/lib/dateRanges';

/**
 * Regresión del bug documentado en dateRanges.ts: un turno creado después de las 7pm hora
 * Colombia caía en el día UTC siguiente con la lógica anterior (basada en Date.setHours,
 * que usa la zona horaria del proceso — UTC en Vercel). Estos tests fijan la hora del
 * sistema en instantes UTC específicos (equivalentes a una hora Colombia conocida) para
 * verificar que el límite de "hoy" se calcula en hora de Colombia, no en UTC.
 */
describe('resolverRango', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('"hoy" no cruza al día siguiente antes de la medianoche de Colombia (caso que rompía la versión anterior)', () => {
    // 2026-07-28T23:30:00 hora Colombia = 2026-07-29T04:30:00Z — casi medianoche Colombia,
    // pero ya es 29 de julio en UTC. Con lógica basada en UTC, "hoy" habría saltado al 29.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T04:30:00Z'));

    const { desde, hasta } = resolverRango('hoy');

    expect(desde.toISOString()).toBe('2026-07-28T05:00:00.000Z'); // medianoche Colombia del 28 == 05:00Z
    expect(hasta.toISOString()).toBe('2026-07-29T05:00:00.000Z'); // medianoche Colombia del 29
  });

  it('"hoy" cruza correctamente justo después de la medianoche de Colombia', () => {
    // 2026-07-29T00:05:00 hora Colombia = 2026-07-29T05:05:00Z
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T05:05:00Z'));

    const { desde } = resolverRango('hoy');

    expect(desde.toISOString()).toBe('2026-07-29T05:00:00.000Z');
  });

  it('"semana" empieza el lunes en hora de Colombia', () => {
    // 2026-07-29 12:00 Colombia es miércoles (verificado: getUTCDay() de 2026-07-29T17:00Z = 3).
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T17:00:00Z'));

    const { desde, hasta } = resolverRango('semana');

    // Lunes 27 de julio, medianoche Colombia.
    expect(desde.toISOString()).toBe('2026-07-27T05:00:00.000Z');
    // hasta = hoy + 1 día (miércoles 29 + 1 = jueves 30, medianoche Colombia).
    expect(hasta.toISOString()).toBe('2026-07-30T05:00:00.000Z');
  });

  it('"mes" empieza el día 1 del mes en hora de Colombia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T17:00:00Z'));

    const { desde } = resolverRango('mes');

    expect(desde.toISOString()).toBe('2026-07-01T05:00:00.000Z');
  });

  it('"personalizado" es inclusivo del día "hasta" completo (rango medio-abierto +1 día)', () => {
    const { desde, hasta } = resolverRango('personalizado', '2026-07-01', '2026-07-15');

    expect(desde.toISOString()).toBe('2026-07-01T05:00:00.000Z');
    // hasta debe ser medianoche Colombia del 16, no del 15, para incluir todo el 15.
    expect(hasta.toISOString()).toBe('2026-07-16T05:00:00.000Z');
  });

  it('"personalizado" sin fechas cae de vuelta a "hoy"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-29T17:00:00Z'));

    const conFechas = resolverRango('personalizado');
    const hoy = resolverRango('hoy');

    expect(conFechas.desde.toISOString()).toBe(hoy.desde.toISOString());
    expect(conFechas.hasta.toISOString()).toBe(hoy.hasta.toISOString());
  });
});
