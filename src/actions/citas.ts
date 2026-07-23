'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';
import type { Turno } from '@/types/database';

/**
 * MÓDULO 3 — Gestión Básica de Citas del Día (personal administrativo).
 * Registra turnos `tipo_turno = 'cita_previa'` en estado 'programado' para que el
 * flujo público de `/checkin` ("Tengo Cita Programada", ver actions/checkin.ts) tenga
 * citas reales que validar. Mismas políticas RLS que el resto de `turnos`
 * (turnos_select_staff / turnos_insert_recepcion, 0002_rls_policies.sql).
 */

export async function listarCitasDelDia(): Promise<ActionResult<Turno[]>> {
  const supabase = await createClient();

  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);
  const finDelDia = new Date();
  finDelDia.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('turnos')
    .select('*')
    .eq('tipo_turno', 'cita_previa')
    .gte('hora_cita', inicioDelDia.toISOString())
    .lte('hora_cita', finDelDia.toISOString())
    .order('hora_cita', { ascending: true });

  if (error) return fail(error.message);
  return ok((data ?? []) as Turno[]);
}

export interface RegistrarCitaInput {
  nombre: string;
  documento: string;
  especialidadId: string;
  zonaId: string;
  horaCita: string; // ISO string (input datetime-local ya convertido)
}

export async function registrarCitaPrevia(input: RegistrarCitaInput): Promise<ActionResult<Turno>> {
  const documento = input.documento.trim();
  const nombre = input.nombre.trim();

  if (!documento || !nombre) {
    return fail('Documento y nombre son obligatorios.');
  }
  if (!input.especialidadId || !input.zonaId) {
    return fail('Debe seleccionar especialidad y zona.');
  }
  if (!input.horaCita || Number.isNaN(new Date(input.horaCita).getTime())) {
    return fail('Debe indicar una fecha y hora de cita válidas.');
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail('Sesión no válida.');

  // Mismo generador atómico que el turno espontáneo (fn_generar_codigo_turno,
  // supabase/migrations/0004_rpc_operativas.sql) para que el ticket de la cita ya
  // exista al momento de registrarla, no recién al confirmar el check-in.
  const { data: codigo, error: errorCodigo } = await supabase.rpc('fn_generar_codigo_turno', {
    p_especialidad_id: input.especialidadId,
  });

  if (errorCodigo || !codigo) {
    return fail(errorCodigo?.message ?? 'No se pudo generar el código de la cita.');
  }

  const { data: turno, error: errorInsert } = await supabase
    .from('turnos')
    .insert({
      codigo,
      especialidad_id: input.especialidadId,
      zona_id: input.zonaId,
      tipo_turno: 'cita_previa',
      estado: 'programado',
      documento_paciente: documento,
      nombre_paciente: nombre,
      hora_cita: new Date(input.horaCita).toISOString(),
      creado_por: user.id,
    })
    .select()
    .single();

  if (errorInsert) return fail(errorInsert.message);

  revalidatePath('/admin/citas');
  return ok(turno as Turno);
}
