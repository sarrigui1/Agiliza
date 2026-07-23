import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

const TONO_VALOR = {
  neutral: 'text-text',
  success: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

export interface StatTileProps {
  label: string;
  value: string;
  unidad?: string;
  tono?: keyof typeof TONO_VALOR;
  /** % de cambio vs. el periodo anterior. Positivo no siempre es "bueno" (ej. ausentismo). */
  delta?: { valor: number; positivoEsBueno: boolean } | null;
  icon?: React.ReactNode;
}

export function StatTile({ label, value, unidad, tono = 'neutral', delta, icon }: StatTileProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
        {icon && <span className="text-muted">{icon}</span>}
      </div>
      <p className={cn('mt-2 text-4xl font-semibold', TONO_VALOR[tono])}>
        {value}
        {unidad && <span className="ml-1 text-base font-normal text-muted">{unidad}</span>}
      </p>
      {delta !== undefined && delta !== null && (
        <DeltaBadge valor={delta.valor} positivoEsBueno={delta.positivoEsBueno} />
      )}
    </Card>
  );
}

function DeltaBadge({ valor, positivoEsBueno }: { valor: number; positivoEsBueno: boolean }) {
  const neutro = Math.abs(valor) < 0.05;
  const esBueno = neutro ? null : (valor > 0) === positivoEsBueno;

  const color = neutro ? 'text-muted' : esBueno ? 'text-primary' : 'text-danger';
  const Icon = neutro ? Minus : valor > 0 ? TrendingUp : TrendingDown;

  return (
    <p className={cn('mt-2 flex items-center gap-1 text-sm', color)}>
      <Icon className="size-3.5" />
      {valor > 0 ? '+' : ''}
      {valor.toFixed(1)}%<span className="text-muted">vs. periodo anterior</span>
    </p>
  );
}
