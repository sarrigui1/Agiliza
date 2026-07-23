import { SlidersHorizontal } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { RadioCard } from '@/components/ui/RadioCard';
import type { AlgoritmoCola } from '@/types/database';

const OPCIONES: { value: AlgoritmoCola; title: string; description: string }[] = [
  { value: 'hora_cita', title: 'Por Hora de Cita', description: 'Prioriza pacientes con turno agendado.' },
  { value: 'orden_llegada', title: 'Por Orden de Llegada', description: 'Fila única basada en check-in manual.' },
  { value: 'hibrido', title: 'Híbrido', description: 'Balance dinámico entre citas y demanda.' },
];

interface AlgorithmCardProps {
  algoritmoCola: AlgoritmoCola;
  intercaladoPreferencial: number;
  intercaladoNormal: number;
  onChange: (patch: Partial<{ algoritmo_cola: AlgoritmoCola; intercalado_preferencial: number; intercalado_normal: number }>) => void;
}

export function AlgorithmCard({ algoritmoCola, intercaladoPreferencial, intercaladoNormal, onChange }: AlgorithmCardProps) {
  return (
    <Card>
      <CardTitle>
        <SlidersHorizontal className="size-5 text-primary" />
        Algoritmo y Ordenamiento
      </CardTitle>

      <div className="flex flex-col gap-3">
        {OPCIONES.map((op) => (
          <RadioCard
            key={op.value}
            name="algoritmo_cola"
            value={op.value}
            checked={algoritmoCola === op.value}
            onChange={(v) => onChange({ algoritmo_cola: v as AlgoritmoCola })}
            title={op.title}
            description={op.description}
          />
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-widest text-muted">
          Intercalado de Prioridad
        </span>
        <span className="font-mono text-sm font-bold text-primary">
          {intercaladoPreferencial}:{intercaladoNormal}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Preferencial</span>
          <input
            type="range"
            min={1}
            max={5}
            value={intercaladoPreferencial}
            onChange={(e) => onChange({ intercalado_preferencial: Number(e.target.value) })}
            className="w-full accent-primary"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Normal</span>
          <input
            type="range"
            min={1}
            max={5}
            value={intercaladoNormal}
            onChange={(e) => onChange({ intercalado_normal: Number(e.target.value) })}
            className="w-full accent-secondary"
          />
        </label>
      </div>
    </Card>
  );
}
