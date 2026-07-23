import { Users, Timer, UserX, ShieldCheck, TrendingUp, Flame } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatTile } from '@/components/charts/StatTile';
import { TrendBarChart } from '@/components/charts/TrendBarChart';
import { DemandHeatmap } from '@/components/charts/DemandHeatmap';
import type {
  MetricasEjecutivas,
  PuntoTendencia,
  CeldaHeatmap,
  RendimientoServicioYAgente,
} from '@/actions/analytics';
import type { RangoId } from '@/lib/dateRanges';
import { RangoFilterBar } from './RangoFilterBar';
import { ExportButtons } from './ExportButtons';
import { ServicioTable } from './ServicioTable';

const TPE_META_MINUTOS = 15;

interface DashboardViewProps {
  rango: RangoId;
  desde: string;
  hasta: string;
  metricas: MetricasEjecutivas;
  tendencia: PuntoTendencia[];
  heatmap: CeldaHeatmap[];
  rendimiento: RendimientoServicioYAgente;
}

export function DashboardView({
  rango,
  desde,
  hasta,
  metricas,
  tendencia,
  heatmap,
  rendimiento,
}: DashboardViewProps) {
  const tonoTpe =
    metricas.tpeGlobalMinutos === null
      ? 'neutral'
      : metricas.tpeGlobalMinutos <= TPE_META_MINUTOS
        ? 'success'
        : 'danger';

  const tonoSla =
    metricas.cumplimientoSla === null
      ? 'neutral'
      : metricas.cumplimientoSla >= 80
        ? 'success'
        : metricas.cumplimientoSla >= 60
          ? 'warning'
          : 'danger';

  const tonoAusentismo =
    metricas.tasaAusentismo <= 5 ? 'neutral' : metricas.tasaAusentismo <= 15 ? 'warning' : 'danger';

  return (
    <main className="p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Alta Dirección</p>
          <h1 className="text-2xl font-bold text-text">Dashboard Ejecutivo</h1>
        </div>
        <ExportButtons desde={desde} hasta={hasta} rango={rango} />
      </header>

      <div className="mb-6">
        <RangoFilterBar rangoActual={rango} desdeActual={desde} hastaActual={hasta} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total Atendidos"
          value={String(metricas.totalAtendidos)}
          icon={<Users className="size-4" />}
          delta={
            metricas.variacionAtendidos !== null
              ? { valor: metricas.variacionAtendidos, positivoEsBueno: true }
              : null
          }
        />
        <StatTile
          label="TPE Promedio"
          value={metricas.tpeGlobalMinutos !== null ? String(metricas.tpeGlobalMinutos) : '—'}
          unidad="min"
          tono={tonoTpe}
          icon={<Timer className="size-4" />}
        />
        <StatTile
          label="% Cumplimiento SLA"
          value={metricas.cumplimientoSla !== null ? String(metricas.cumplimientoSla) : '—'}
          unidad="%"
          tono={tonoSla}
          icon={<ShieldCheck className="size-4" />}
        />
        <Card>
          <div className="flex items-start justify-between">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Tasa de Ausentismo / Fuga
            </p>
            <UserX className="size-4 text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <p className="text-4xl font-semibold text-text">{metricas.tasaAusentismo}%</p>
            <Badge tone={tonoAusentismo === 'neutral' ? 'primary' : tonoAusentismo}>
              {metricas.totalAusentes} turnos
            </Badge>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>
            <TrendingUp className="size-5 text-primary" />
            Tendencia de Demanda
          </CardTitle>
          <TrendBarChart datos={tendencia} />
        </Card>
        <Card>
          <CardTitle>
            <Flame className="size-5 text-primary" />
            Horas Pico (Lun–Sáb, 8:00–18:00)
          </CardTitle>
          <DemandHeatmap datos={heatmap} />
        </Card>
      </div>

      <ServicioTable datos={rendimiento.porServicio} />
    </main>
  );
}
