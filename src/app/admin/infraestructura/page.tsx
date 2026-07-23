import { createClient } from '@/lib/supabase/server';
import { InfraestructuraView } from './_components/InfraestructuraView';

export const dynamic = 'force-dynamic';

export default async function InfraestructuraPage() {
  const supabase = await createClient();

  const [
    { data: zonas },
    { data: especialidades },
    { data: puntos },
    { data: agentes },
    { data: asignaciones },
  ] = await Promise.all([
    supabase.from('zonas').select('*').order('nombre'),
    supabase.from('especialidades').select('*').order('nombre'),
    supabase.from('puntos_atencion').select('*').order('nombre'),
    supabase.from('perfiles').select('*').eq('rol', 'agente').order('nombre_completo'),
    supabase.from('agentes_puntos_atencion').select('*'),
  ]);

  return (
    <InfraestructuraView
      zonas={zonas ?? []}
      especialidades={especialidades ?? []}
      puntos={puntos ?? []}
      agentes={agentes ?? []}
      asignaciones={asignaciones ?? []}
    />
  );
}
