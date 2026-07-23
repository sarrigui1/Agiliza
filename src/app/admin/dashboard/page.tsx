import {
  obtenerMetricasEjecutivas,
  obtenerHeatmapDemanda,
  obtenerTendenciaDiaria,
  obtenerRendimientoPorServicioYAgente,
} from '@/actions/analytics';
import { resolverRango, type RangoId } from '@/lib/dateRanges';
import { DashboardView } from './_components/DashboardView';

export const dynamic = 'force-dynamic';

interface DashboardPageProps {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const rango = (params.rango as RangoId) ?? 'hoy';
  const { desde, hasta } = resolverRango(rango, params.desde, params.hasta);

  const [metricas, tendencia, heatmap, rendimiento] = await Promise.all([
    obtenerMetricasEjecutivas(desde, hasta),
    obtenerTendenciaDiaria(desde, hasta),
    obtenerHeatmapDemanda(desde, hasta),
    obtenerRendimientoPorServicioYAgente(desde, hasta),
  ]);

  if (!metricas.ok) {
    return (
      <main className="p-8">
        <p className="text-danger">Error cargando métricas: {metricas.error}</p>
      </main>
    );
  }

  return (
    <DashboardView
      rango={rango}
      desde={desde.toISOString()}
      hasta={hasta.toISOString()}
      metricas={metricas.data}
      tendencia={tendencia.ok ? tendencia.data : []}
      heatmap={heatmap.ok ? heatmap.data : []}
      rendimiento={rendimiento.ok ? rendimiento.data : { porServicio: [], porAgente: [] }}
    />
  );
}
