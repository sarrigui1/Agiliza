import { createClient } from '@/lib/supabase/server';
import { CheckinFlow } from './_components/CheckinFlow';

export const dynamic = 'force-dynamic';

export default async function CheckinPage() {
  const supabase = await createClient();

  const [{ data: especialidades }, { data: zonas }] = await Promise.all([
    supabase.from('especialidades').select('*').eq('activo', true).order('nombre'),
    supabase.from('zonas').select('*').order('nombre'),
  ]);

  return <CheckinFlow especialidades={especialidades ?? []} zonas={zonas ?? []} />;
}
