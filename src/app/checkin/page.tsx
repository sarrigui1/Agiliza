import { createClient } from '@/lib/supabase/server';
import { CheckinFlow } from './_components/CheckinFlow';

export const dynamic = 'force-dynamic';

/** Respaldo si la migración 0018_habeas_data.sql todavía no corrió contra esta base. */
const POLITICA_DATOS_POR_DEFECTO =
  'POLÍTICA DE TRATAMIENTO DE DATOS PERSONALES\n\n' +
  '[NOMBRE DE LA INSTITUCIÓN] actúa como Responsable del Tratamiento de los datos personales ' +
  'que usted suministra al registrar su turno de atención. Sus datos se usan únicamente para ' +
  'gestionar su turno y generar estadísticas internas del servicio, y no se ceden a terceros ' +
  'con fines comerciales. Conforme a la Ley 1581 de 2012, usted puede conocer, actualizar, ' +
  'rectificar o solicitar la supresión de sus datos en cualquier momento.';

export default async function CheckinPage() {
  const supabase = await createClient();

  const [{ data: especialidades }, { data: zonas }, { data: config }] = await Promise.all([
    supabase.from('especialidades').select('*').eq('activo', true).order('nombre'),
    supabase.from('zonas').select('*').order('nombre'),
    supabase
      .from('configuraciones_globales')
      .select('permitir_citas_programadas, permitir_lectura_cedula, texto_politica_datos')
      .eq('id', 1)
      .maybeSingle(),
  ]);

  return (
    <CheckinFlow
      especialidades={especialidades ?? []}
      zonas={zonas ?? []}
      permitirCitasProgramadas={config?.permitir_citas_programadas ?? false}
      permitirLecturaCedula={config?.permitir_lectura_cedula ?? false}
      politicaDatos={config?.texto_politica_datos ?? POLITICA_DATOS_POR_DEFECTO}
    />
  );
}
