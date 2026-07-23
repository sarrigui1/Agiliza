import { createClient } from '@/lib/supabase/server';
import { SupervisorDashboard, type TerminalInfo, type TpeArea } from './_components/SupervisorDashboard';

export const dynamic = 'force-dynamic';

const UMBRAL_SATURACION = 6; // turnos en espera simultáneos para marcar un punto como saturado

export default async function AdminSupervisorPage() {
  const supabase = await createClient();

  const inicioDelDia = new Date();
  inicioDelDia.setHours(0, 0, 0, 0);

  const [
    { data: puntos },
    { data: especialidades },
    { data: perfiles },
    { data: activos },
    { data: historicoHoy },
  ] = await Promise.all([
    supabase.from('puntos_atencion').select('*').order('nombre'),
    supabase.from('especialidades').select('*'),
    supabase.from('perfiles').select('*'),
    supabase.from('turnos').select('*').in('estado', ['en_espera', 'llamado', 'en_atencion']),
    supabase
      .from('turnos')
      .select('especialidad_id, estado, hora_llegada, hora_llamado')
      .in('estado', ['finalizado', 'ausente'])
      .gte('created_at', inicioDelDia.toISOString()),
  ]);

  const especialidadNombre = new Map((especialidades ?? []).map((e) => [e.id, e.nombre]));
  const agenteNombre = new Map((perfiles ?? []).map((p) => [p.id, p.nombre_completo]));
  const listaActivos = activos ?? [];
  const listaHistorico = historicoHoy ?? [];

  const terminales: TerminalInfo[] = (puntos ?? []).map((pa) => {
    const turnoActivo = listaActivos.find(
      (t) => t.punto_atencion_id === pa.id && (t.estado === 'llamado' || t.estado === 'en_atencion'),
    );
    const colaLength = listaActivos.filter(
      (t) => t.estado === 'en_espera' && t.especialidad_id === pa.especialidad_id && t.zona_id === pa.zona_id,
    ).length;

    return {
      id: pa.id,
      nombre: pa.nombre,
      especialidad: pa.especialidad_id ? especialidadNombre.get(pa.especialidad_id) ?? '—' : '—',
      agenteNombre: pa.agente_actual_id ? agenteNombre.get(pa.agente_actual_id) ?? '—' : '—',
      estadoRaw: pa.estado,
      turnoCodigo: turnoActivo?.codigo ?? null,
      enEspera: colaLength,
      saturado: colaLength >= UMBRAL_SATURACION,
    };
  });

  const tpePorAreaMap = new Map<string, number[]>();
  for (const t of listaHistorico) {
    if (t.estado !== 'finalizado' || !t.hora_llamado) continue;
    const nombre = especialidadNombre.get(t.especialidad_id) ?? 'Otros';
    const minutos = (new Date(t.hora_llamado).getTime() - new Date(t.hora_llegada).getTime()) / 60_000;
    tpePorAreaMap.set(nombre, [...(tpePorAreaMap.get(nombre) ?? []), minutos]);
  }
  const tpePorArea: TpeArea[] = Array.from(tpePorAreaMap.entries()).map(([nombre, valores]) => ({
    nombre,
    minutos: Math.max(0, Math.round(valores.reduce((a, b) => a + b, 0) / valores.length)),
  }));

  const atendidosHoy = listaHistorico.filter((t) => t.estado === 'finalizado').length;
  const ausentesHoy = listaHistorico.filter((t) => t.estado === 'ausente').length;
  const haySaturacion = terminales.some((t) => t.saturado);

  return (
    <SupervisorDashboard
      terminales={terminales}
      tpePorArea={tpePorArea}
      atendidosHoy={atendidosHoy}
      ausentesHoy={ausentesHoy}
      haySaturacion={haySaturacion}
    />
  );
}
