'use server';

import { createClient } from '@/lib/supabase/server';
import { ok, fail, type ActionResult } from '@/types/domain';

/**
 * Exportación de reportes. La versión "Excel" pedida se resuelve como CSV: Excel abre
 * CSV nativamente y evita sumar una librería de generación de .xlsx binario solo para
 * esto — si más adelante se necesita formato .xlsx real (estilos, múltiples hojas),
 * ahí sí se justifica agregar una dependencia dedicada.
 */

function escaparCsv(valor: string): string {
  if (/[",\n]/.test(valor)) {
    return `"${valor.replace(/"/g, '""')}"`;
  }
  return valor;
}

function formatoFecha(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('es-CO') : '';
}

const ENCABEZADOS = [
  'Código',
  'Documento',
  'Nombre Paciente',
  'Especialidad',
  'Zona',
  'Punto de Atención',
  'Tipo de Turno',
  'Preferencial',
  'Estado',
  'Hora Cita',
  'Hora Llegada',
  'Hora Llamado',
  'Hora Atención',
  'Hora Finalización',
  'Intentos de Llamado',
];

export async function exportarTurnosDetalladoCSV(
  fechaInicio: Date,
  fechaFin: Date,
): Promise<ActionResult<string>> {
  const supabase = await createClient();

  const [{ data: turnos, error }, { data: especialidades }, { data: zonas }, { data: puntos }] =
    await Promise.all([
      supabase
        .from('turnos')
        .select('*')
        .gte('hora_llegada', fechaInicio.toISOString())
        .lt('hora_llegada', fechaFin.toISOString())
        .order('hora_llegada', { ascending: true }),
      supabase.from('especialidades').select('*'),
      supabase.from('zonas').select('*'),
      supabase.from('puntos_atencion').select('*'),
    ]);

  if (error) return fail(error.message);

  const especialidadNombre = new Map((especialidades ?? []).map((e) => [e.id, e.nombre]));
  const zonaNombre = new Map((zonas ?? []).map((z) => [z.id, z.nombre]));
  const puntoNombre = new Map((puntos ?? []).map((p) => [p.id, p.nombre]));

  const filas = (turnos ?? []).map((t) =>
    [
      t.codigo,
      t.documento_paciente,
      t.nombre_paciente,
      especialidadNombre.get(t.especialidad_id) ?? '',
      zonaNombre.get(t.zona_id) ?? '',
      t.punto_atencion_id ? puntoNombre.get(t.punto_atencion_id) ?? '' : '',
      t.tipo_turno,
      t.es_preferencial ? 'Sí' : 'No',
      t.estado,
      formatoFecha(t.hora_cita),
      formatoFecha(t.hora_llegada),
      formatoFecha(t.hora_llamado),
      formatoFecha(t.hora_atencion),
      formatoFecha(t.hora_finalizacion),
      String(t.intentos_llamado),
    ]
      .map((valor) => escaparCsv(String(valor)))
      .join(','),
  );

  const csv = [ENCABEZADOS.join(','), ...filas].join('\n');
  return ok(csv);
}
