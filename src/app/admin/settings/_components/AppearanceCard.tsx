import { Palette, Moon, Sun } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { RadioCard } from '@/components/ui/RadioCard';
import type { TemaVisual } from '@/types/database';

const OPCIONES_TEMA: { value: TemaVisual; title: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'oscuro',
    title: 'Oscuro',
    description: 'Paleta original, alto contraste — recomendado para TVs y tótems en salas con poca luz.',
    icon: <Moon className="size-4 text-muted" />,
  },
  {
    value: 'claro',
    title: 'Claro',
    description: 'Fondos blancos, texto oscuro — recomendado para oficinas y pantallas con mucha luz ambiente.',
    icon: <Sun className="size-4 text-muted" />,
  },
];

interface AppearanceCardProps {
  temaVisual: TemaVisual;
  onChange: (patch: Partial<{ tema_visual: TemaVisual }>) => void;
}

export function AppearanceCard({ temaVisual, onChange }: AppearanceCardProps) {
  return (
    <Card>
      <CardTitle>
        <Palette className="size-5 text-primary" />
        Apariencia
      </CardTitle>

      <p className="mb-4 text-sm text-muted">
        Aplica a todas las pantallas del sistema (TV, Check-In, Panel de Trabajo, Administración) — es una
        preferencia de la sede, no de cada persona.
      </p>

      <div className="flex flex-col gap-3">
        {OPCIONES_TEMA.map((op) => (
          <RadioCard
            key={op.value}
            name="tema_visual"
            value={op.value}
            checked={temaVisual === op.value}
            onChange={(v) => onChange({ tema_visual: v as TemaVisual })}
            title={op.title}
            description={op.description}
            icon={op.icon}
          />
        ))}
      </div>
    </Card>
  );
}
