import { createClient } from '@/lib/supabase/server';
import { CheckinFlow } from './_components/CheckinFlow';

export const dynamic = 'force-dynamic';

export default async function CheckinPage() {
  const supabase = await createClient();

  const [{ data: especialidades }, { data: zonas }, { data: config }] = await Promise.all([
    supabase.from('especialidades').select('*').eq('activo', true).order('nombre'),
    supabase.from('zonas').select('*').order('nombre'),
    supabase.from('configuraciones_globales').select('permitir_citas_programadas').eq('id', 1).maybeSingle(),
  ]);

  return (
    <CheckinFlow
      especialidades={especialidades ?? []}
      zonas={zonas ?? []}
      permitirCitasProgramadas={config?.permitir_citas_programadas ?? false}
    />
  );
}
