import { createClient } from '@/lib/supabase/server';
import { listarCitasDelDia } from '@/actions/citas';
import { CitasView } from './_components/CitasView';

export const dynamic = 'force-dynamic';

export default async function CitasPage() {
  const supabase = await createClient();

  const [citasRes, { data: especialidades }, { data: zonas }] = await Promise.all([
    listarCitasDelDia(),
    supabase.from('especialidades').select('*').eq('activo', true).order('nombre'),
    supabase.from('zonas').select('*').order('nombre'),
  ]);

  return (
    <CitasView
      citasIniciales={citasRes.ok ? citasRes.data : []}
      especialidades={especialidades ?? []}
      zonas={zonas ?? []}
    />
  );
}
