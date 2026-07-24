import { createClient } from '@/lib/supabase/server';
import { rangoHoyColombia } from '@/lib/dateRanges';
import { WorkspaceView } from './_components/WorkspaceView';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <EstadoVacio mensaje="Sesión no válida." />;
  }

  const [{ data: perfil }, { data: asignacion }, { data: config }, { data: especialidades }] =
    await Promise.all([
      supabase.from('perfiles').select('*').eq('id', user.id).single(),
      supabase
        .from('agentes_puntos_atencion')
        .select('punto_atencion_id')
        .eq('perfil_id', user.id)
        .limit(1)
        .maybeSingle(),
      supabase.from('configuraciones_globales').select('*').eq('id', 1).single(),
      supabase.from('especialidades').select('*').eq('activo', true).order('nombre'),
    ]);

  const { data: miPunto } = asignacion
    ? await supabase.from('puntos_atencion').select('*').eq('id', asignacion.punto_atencion_id).single()
    : { data: null };

  if (!perfil || !miPunto) {
    return (
      <EstadoVacio mensaje="Este usuario no tiene un punto de atención asignado. Contacte a un administrador." />
    );
  }

  const { data: turnosActivos } = await supabase
    .from('turnos')
    .select('*')
    .eq('especialidad_id', miPunto.especialidad_id!)
    .eq('zona_id', miPunto.zona_id)
    .in('estado', ['en_espera', 'llamado', 'en_atencion'])
    .order('hora_llegada', { ascending: true });

  const { desde: inicioDelDia } = rangoHoyColombia();

  const { data: finalizadosHoy } = await supabase
    .from('turnos')
    .select('hora_atencion, hora_finalizacion')
    .eq('punto_atencion_id', miPunto.id)
    .eq('estado', 'finalizado')
    .gte('hora_finalizacion', inicioDelDia.toISOString());

  return (
    <WorkspaceView
      perfil={perfil}
      puntoAtencion={miPunto}
      especialidades={especialidades ?? []}
      config={config ?? null}
      turnosIniciales={turnosActivos ?? []}
      finalizadosHoy={finalizadosHoy ?? []}
    />
  );
}

function EstadoVacio({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex h-dvh items-center justify-center bg-bg px-6 text-center">
      <p className="max-w-md text-sm text-muted">{mensaje}</p>
    </main>
  );
}
