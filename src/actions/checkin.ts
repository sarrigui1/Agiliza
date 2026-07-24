'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { rangoHoyColombia } from '@/lib/dateRanges';
import { ok, fail, type ActionResult, type CitaEncontrada, type TurnoConEstimado } from '@/types/domain';
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

/** TPA de respaldo cuando todavía no hay ningún turno finalizado hoy en esa especialidad. */
const TPA_MINUTOS_POR_DEFECTO = 10;

/**
 * Tiempo estimado de espera para un turno recién confirmado/creado:
 * (turnos 'en_espera' que ya estaban delante, misma especialidad+zona) × (TPA real de
 * hoy para esa especialidad, o el valor de respaldo si aún no hay datos).
 *
 * No usa `fn_rendimiento_por_servicio` (la RPC de analítica) a propósito — esa consulta
 * trae el desglose de TODAS las especialidades para un rango arbitrario; acá solo hace
 * falta una, para "hoy", así que una consulta directa es más simple y evita acoplar el
 * flujo de Check-In al módulo de Analytics.
 */
async function calcularTiempoEstimado(
  supabase: Awaited<ReturnType<typeof createClient>>,
  especialidadId: string,
  zonaId: string,
): Promise<number> {
  const { desde: inicioDelDia } = rangoHoyColombia();

  const [{ count: enEspera }, { data: finalizadosHoy }] = await Promise.all([
    supabase
      .from('turnos')
      .select('id', { count: 'exact', head: true })
      .eq('especialidad_id', especialidadId)
      .eq('zona_id', zonaId)
      .eq('estado', 'en_espera'),
    supabase
      .from('turnos')
      .select('hora_atencion, hora_finalizacion')
      .eq('especialidad_id', especialidadId)
      .eq('estado', 'finalizado')
      .gte('hora_llegada', inicioDelDia.toISOString()),
  ]);

  // El propio turno recién confirmado ya cuenta como 'en_espera' -> se excluye.
  const turnosAdelante = Math.max(0, (enEspera ?? 1) - 1);

  const duraciones = (finalizadosHoy ?? [])
    .filter((t) => t.hora_atencion && t.hora_finalizacion)
    .map((t) => (new Date(t.hora_finalizacion!).getTime() - new Date(t.hora_atencion!).getTime()) / 60_000);

  const tpaMinutos =
    duraciones.length > 0
      ? duraciones.reduce((a, b) => a + b, 0) / duraciones.length
      : TPA_MINUTOS_POR_DEFECTO;

  return Math.round(turnosAdelante * tpaMinutos);
}

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

  const { desde: inicioDelDia, hasta: finDelDia } = rangoHoyColombia();

  // El QR puede traer el documento del paciente o el código de ticket ya emitido
  // (ej. si se reimprime la cita); se acepta cualquiera de las dos coincidencias.
  // Solo interesa la agenda del día: una cita de otra fecha no debe poder hacer check-in hoy.
  const { data: turnos, error } = await supabase
    .from('turnos')
    .select('*')
    .eq('estado', 'programado')
    .or(`documento_paciente.eq.${valor},codigo.eq.${valor}`)
    .gte('hora_cita', inicioDelDia.toISOString())
    .lt('hora_cita', finDelDia.toISOString())
    .order('hora_cita', { ascending: true });

  if (error) {
    return fail(`Error al buscar la cita: ${error.message}`);
  }

  if (!turnos || turnos.length === 0) {
    return fail('No encontramos una cita agendada para hoy con este documento o código.');
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
export async function confirmarCheckIn(turnoId: string): Promise<ActionResult<TurnoConEstimado>> {
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

  const turno = data as Turno;
  const tiempoEstimadoMinutos = await calcularTiempoEstimado(supabase, turno.especialidad_id, turno.zona_id);

  revalidatePath('/checkin');
  return ok({ ...turno, tiempoEstimadoMinutos });
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
): Promise<ActionResult<TurnoConEstimado>> {
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

  const tiempoEstimadoMinutos = await calcularTiempoEstimado(supabase, input.especialidadId, input.zonaId);

  revalidatePath('/checkin');
  return ok({ ...(turno as Turno), tiempoEstimadoMinutos });
}
