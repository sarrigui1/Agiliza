import { BarChart3 } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';

interface RendimientoPanelProps {
  finalizadosHoy: { hora_atencion: string | null; hora_finalizacion: string | null }[];
  tamanoCola: number;
}

function calcularTpaMinutos(registros: RendimientoPanelProps['finalizadosHoy']): number | null {
  const duraciones = registros
    .filter((r) => r.hora_atencion && r.hora_finalizacion)
    .map((r) => new Date(r.hora_finalizacion!).getTime() - new Date(r.hora_atencion!).getTime());

  if (duraciones.length === 0) return null;
  const promedioMs = duraciones.reduce((a, b) => a + b, 0) / duraciones.length;
  return Math.round(promedioMs / 60_000);
}

export function RendimientoPanel({ finalizadosHoy, tamanoCola }: RendimientoPanelProps) {
  const tpa = calcularTpaMinutos(finalizadosHoy);

  return (
    <Card className="h-fit">
      <CardTitle>
        <BarChart3 className="size-5 text-primary" />
        Rendimiento Hoy
      </CardTitle>

      <div className="flex flex-col gap-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Atendidos Hoy</p>
          <p className="font-mono text-4xl font-bold text-primary">{finalizadosHoy.length}</p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Tiempo Promedio (TPA)</p>
          <p className="font-mono text-4xl font-bold text-text">
            {tpa !== null ? `${tpa}` : '--'} <span className="text-base text-muted">min</span>
          </p>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">En Espera Ahora</p>
          <p className="font-mono text-4xl font-bold text-secondary">{tamanoCola}</p>
        </div>
      </div>
    </Card>
  );
}
