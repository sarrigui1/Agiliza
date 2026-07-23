import type { Turno } from './database';

/**
 * Resultado uniforme de Server Actions: evita usar `throw` a través del límite
 * cliente/servidor para errores de negocio esperables (turno no encontrado, fuera de
 * horario, etc.) y deja los `throw` reales para errores inesperados/infraestructura.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** Turno programado encontrado en la búsqueda de check-in, con el flag de destiempo ya calculado. */
export type CitaEncontrada = Turno & {
  fuera_de_horario: boolean;
};

/** Turno recién confirmado/creado en Check-In, con la estimación de espera ya calculada. */
export type TurnoConEstimado = Turno & {
  tiempoEstimadoMinutos: number;
};
