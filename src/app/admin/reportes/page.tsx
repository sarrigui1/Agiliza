import {
  obtenerMetricasEjecutivas,
  obtenerTendenciaDiaria,
  obtenerRendimientoPorServicioYAgente,
} from '@/actions/analytics';
import { resolverRango, type RangoId } from '@/lib/dateRanges';
import { ReporteView } from './_components/ReporteView';

export const dynamic = 'force-dynamic';

interface ReportesPageProps {
  searchParams: Promise<{ rango?: string; desde?: string; hasta?: string }>;
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const params = await searchParams;
  const rango = (params.rango as RangoId) ?? 'hoy';
  const { desde, hasta } = resolverRango(rango, params.desde, params.hasta);

  const [metricas, tendencia, rendimiento] = await Promise.all([
    obtenerMetricasEjecutivas(desde, hasta),
    obtenerTendenciaDiaria(desde, hasta),
    obtenerRendimientoPorServicioYAgente(desde, hasta),
  ]);

  if (!metricas.ok) {
    return (
      <main className="p-8">
        <p className="text-red-600">Error cargando métricas: {metricas.error}</p>
      </main>
    );
  }

  return (
    <ReporteView
      desde={desde.toISOString()}
      hasta={hasta.toISOString()}
      metricas={metricas.data}
      tendencia={tendencia.ok ? tendencia.data : []}
      porServicio={rendimiento.ok ? rendimiento.data.porServicio : []}
    />
  );
}
