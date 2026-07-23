'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { Turno } from '@/types/database';

/**
 * MÓDULO 3 — Panel de Control del Agente (Operator Workspace).
 *
 * Wrappers delgados sobre las RPC de `supabase/migrations/0003_fn_llamar_siguiente_turno.sql`
 * y `0004_rpc_operativas.sql`. Ninguna de estas acciones hace `update()` directo sobre
 * `turnos`: toda la lógica de negocio y las validaciones viven en Postgres (atomicidad,
 * autorización por cola, límites de re-llamado/ausencia), este archivo solo obtiene al
 * usuario autenticado, invoca la función y traduce el resultado/error a `ActionResult`.
 */

async function usuarioAutenticado() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// ---------------------------------------------------------------------------------------
// Llamar Siguiente
// ---------------------------------------------------------------------------------------
export async function llamarSiguienteTurno(
  puntoAtencionId: string,
): Promise<ActionResult<Turno | null>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_llamar_siguiente_turno', {
    p_punto_atencion_id: puntoAtencionId,
    p_agente_id: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok((data as Turno | null) ?? null); // null = cola vacía, no es un error
}

// ---------------------------------------------------------------------------------------
// Re-llamar
// ---------------------------------------------------------------------------------------
export async function reLlamarTurno(turnoId: string): Promise<ActionResult<Turno>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_re_llamar_turno', {
    p_turno_id: turnoId,
    p_agente_id: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// Iniciar Atención
// ---------------------------------------------------------------------------------------
export async function iniciarAtencion(
  turnoId: string,
  puntoAtencionId: string,
): Promise<ActionResult<Turno>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_iniciar_atencion', {
    p_turno_id: turnoId,
    p_punto_atencion_id: puntoAtencionId,
    p_agente_id: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// Finalizar Atención
// ---------------------------------------------------------------------------------------
export async function finalizarAtencion(
  turnoId: string,
  puntoAtencionId: string,
): Promise<ActionResult<Turno>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_finalizar_atencion', {
    p_turno_id: turnoId,
    p_punto_atencion_id: puntoAtencionId,
    p_agente_id: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// Marcar Ausente (aplica reingreso penalizado si está configurado)
// ---------------------------------------------------------------------------------------
export async function marcarTurnoAusente(turnoId: string): Promise<ActionResult<Turno>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_marcar_ausente', {
    p_turno_id: turnoId,
    p_agente_id: user.id,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// Derivar a 2da especialidad (ruta multiespecialidad)
// ---------------------------------------------------------------------------------------
export async function derivarTurno(
  turnoId: string,
  especialidadDestinoId: string,
  zonaDestinoId?: string,
): Promise<ActionResult<Turno>> {
  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_derivar_turno', {
    p_turno_id: turnoId,
    p_especialidad_destino_id: especialidadDestinoId,
    p_agente_id: user.id,
    p_zona_destino_id: zonaDestinoId ?? null,
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// Salto de Cola Autorizado (requiere motivo de auditoría)
// ---------------------------------------------------------------------------------------
export async function saltarColaAutorizado(
  turnoId: string,
  puntoAtencionId: string,
  motivo: string,
): Promise<ActionResult<Turno>> {
  if (!motivo.trim()) {
    return fail('Debe indicar un motivo para autorizar el salto de cola.');
  }

  const { supabase, user } = await usuarioAutenticado();
  if (!user) return fail('Sesión no válida.');

  const { data, error } = await supabase.rpc('fn_salto_de_cola_autorizado', {
    p_turno_id: turnoId,
    p_punto_atencion_id: puntoAtencionId,
    p_agente_id: user.id,
    p_motivo: motivo.trim(),
  });

  if (error) return fail(error.message);

  revalidatePath('/workspace');
  return ok(data as Turno);
}
