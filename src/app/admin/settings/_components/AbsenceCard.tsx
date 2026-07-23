import { UserX, Minus, Plus } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';

interface AbsenceCardProps {
  limiteLlamadosAusencia: number;
  reingresoPenalizado: boolean;
  onChange: (patch: Partial<{ limite_llamados_ausencia: number; reingreso_penalizado: boolean }>) => void;
}

export function AbsenceCard({ limiteLlamadosAusencia, reingresoPenalizado, onChange }: AbsenceCardProps) {
  return (
    <Card>
      <CardTitle>
        <UserX className="size-5 text-primary" />
        Gestión de Ausencias
      </CardTitle>

      <div className="mb-6">
        <span className="mb-2 block font-mono text-xs uppercase tracking-widest text-muted">
          Límite de Llamados
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChange({ limite_llamados_ausencia: Math.max(1, limiteLlamadosAusencia - 1) })}
            className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text hover:bg-surface-high"
          >
            <Minus className="size-4" />
          </button>
          <span className="w-12 text-center text-2xl font-bold text-text">{limiteLlamadosAusencia}</span>
          <button
            type="button"
            onClick={() => onChange({ limite_llamados_ausencia: Math.min(10, limiteLlamadosAusencia + 1) })}
            className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text hover:bg-surface-high"
          >
            <Plus className="size-4" />
          </button>
          <span className="text-sm text-muted">intentos antes de marcar ausente</span>
        </div>
      </div>

      <Toggle
        checked={reingresoPenalizado}
        onChange={(v) => onChange({ reingreso_penalizado: v })}
        label="Reingreso penalizado"
        description="Si llega tarde, se reencola al final."
      />
    </Card>
  );
}
