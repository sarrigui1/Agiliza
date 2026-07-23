'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult, type CitaEncontrada } from '@/types/domain';
import type { Turno } from '@/types/database';

/**
 * MÓDULO 2 — Admisión y Check-In.
 *
 * Nota de seguridad: `turnos` contiene PII y la política RLS `turnos_insert_recepcion`
 * exige que el usuario autenticado tenga rol 'recepcion' | 'admin' | 'supervisor'.
 * Si el tótem opera como kiosco de autoservicio (sin login personal del paciente), el
 * dispositivo debe estar autenticado con una cuenta de servicio de rol 'recepcion' —
 * este archivo asume que existe una sesión de Supabase activa al ejecutarse.
 */

// ---------------------------------------------------------------------------------------
// 1) Validar cita por documento o código QR (Check-In de Agenda Previa)
// ---------------------------------------------------------------------------------------
export async function buscarTurnoProgramado(
  identificador: string,
): Promise<ActionResult<CitaEncontrada[]>> {
  const valor = identificador.trim();
  if (!valor) {
    return fail('Debe ingresar un documento o escanear un código QR válido.');
  }

  const supabase = await createClient();

  const { data: config, error: errorConfig } = await supabase
    .from('configuraciones_globales')
    .select('minutos_checkin_previo, minutos_tolerancia')
    .eq('id', 1)
    .single();

  if (errorConfig || !config) {
    return fail('No se pudo cargar la configuración del sistema.');
  }

  // El QR puede traer el documento del paciente o el código de ticket ya emitido
  // (ej. si se reimprime la cita); se acepta cualquiera de las dos coincidencias.
  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('*')
    .eq('estado', 'programado')
    .or(`documento_paciente.eq.${valor},codigo.eq.${valor}`)
    .order('hora_cita', { ascending: true });

  if (error) {
    return fail(`Error al buscar la cita: ${error.message}`);
  }

  if (!turnos || turnos.length === 0) {
    return fail('No se encontró una cita programada con ese documento o código.');
  }

  const ahora = Date.now();
  const previoMs = config.minutos_checkin_previo * 60_000;
  const toleranciaMs = config.minutos_tolerancia * 60_000;

  const citas: CitaEncontrada[] = (turnos as Turno[]).map((turno) => {
    if (!turno.hora_cita) {
      return { ...turno, fuera_de_horario: false };
    }
    const horaCitaMs = new Date(turno.hora_cita).getTime();
    const ventanaDesde = horaCitaMs - previoMs;
    const ventanaHasta = horaCitaMs + toleranciaMs;
    return { ...turno, fuera_de_horario: ahora < ventanaDesde || ahora > ventanaHasta };
  });

  return ok(citas);
}

// ---------------------------------------------------------------------------------------
// 2) Confirmar el check-in de una cita programada -> pasa a 'en_espera'
// ---------------------------------------------------------------------------------------
export async function confirmarCheckIn(turnoId: string): Promise<ActionResult<Turno>> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail('Sesión no válida para registrar el check-in.');
  }

  const { data, error } = await supabase.rpc('fn_confirmar_checkin', {
    p_turno_id: turnoId,
    p_agente_id: user.id,
  });

  if (error) {
    return fail(error.message);
  }

  revalidatePath('/checkin');
  return ok(data as Turno);
}

// ---------------------------------------------------------------------------------------
// 3) Crear turno espontáneo (alta sin cita) y emitir ticket alfanumérico
// ---------------------------------------------------------------------------------------
export interface CrearTurnoEspontaneoInput {
  documento: string;
  nombre: string;
  especialidadId: string;
  zonaId: string;
  esPreferencial?: boolean;
}

export async function crearTurnoEspontaneo(
  input: CrearTurnoEspontaneoInput,
): Promise<ActionResult<Turno>> {
  const documento = input.documento.trim();
  const nombre = input.nombre.trim();

  if (!documento || !nombre) {
    return fail('Documento y nombre son obligatorios.');
  }
  if (!input.especialidadId || !input.zonaId) {
    return fail('Debe seleccionar especialidad y zona de atención.');
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return fail('Sesión no válida para registrar el turno.');
  }

  // Generación atómica del código de ticket (lock de asesoría por especialidad+día,
  // ver supabase/migrations/0004_rpc_operativas.sql).
  const { data: codigo, error: errorCodigo } = await supabase.rpc('fn_generar_codigo_turno', {
    p_especialidad_id: input.especialidadId,
  });

  if (errorCodigo || !codigo) {
    return fail(errorCodigo?.message ?? 'No se pudo generar el código del turno.');
  }

  const { data: turno, error: errorInsert } = await supabase
    .from('turnos')
    .insert({
      codigo,
      especialidad_id: input.especialidadId,
      zona_id: input.zonaId,
      tipo_turno: 'espontaneo',
      es_preferencial: input.esPreferencial ?? false,
      estado: 'en_espera',
      documento_paciente: documento,
      nombre_paciente: nombre,
      hora_llegada: new Date().toISOString(),
      creado_por: user.id,
    })
    .select()
    .single();

  if (errorInsert) {
    return fail(errorInsert.message);
  }

  revalidatePath('/checkin');
  return ok(turno as Turno);
}
