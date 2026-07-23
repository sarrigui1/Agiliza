import { Shield, Lock, EyeOff, Eye } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { RadioCard } from '@/components/ui/RadioCard';
import type { FormatoPrivacidadTv } from '@/types/database';

const OPCIONES: { value: FormatoPrivacidadTv; title: string; ejemplo: string; icon: React.ReactNode }[] = [
  { value: 'solo_codigo', title: 'Solo Código', ejemplo: 'Ej: TKT-A12', icon: <Lock className="size-4 text-muted" /> },
  {
    value: 'iniciales_parcial',
    title: 'Iniciales + ID Parcial',
    ejemplo: 'Ej: J.P. (***456)',
    icon: <EyeOff className="size-4 text-muted" />,
  },
  { value: 'nombre_completo', title: 'Nombre Completo', ejemplo: 'Ej: Juan Perez', icon: <Eye className="size-4 text-muted" /> },
];

interface PrivacyCardProps {
  formatoPrivacidadTv: FormatoPrivacidadTv;
  onChange: (patch: Partial<{ formato_privacidad_tv: FormatoPrivacidadTv }>) => void;
}

export function PrivacyCard({ formatoPrivacidadTv, onChange }: PrivacyCardProps) {
  return (
    <Card>
      <CardTitle>
        <Shield className="size-5 text-primary" />
        Privacidad (TVs)
      </CardTitle>

      <div className="flex flex-col gap-3">
        {OPCIONES.map((op) => (
          <RadioCard
            key={op.value}
            name="formato_privacidad_tv"
            value={op.value}
            checked={formatoPrivacidadTv === op.value}
            onChange={(v) => onChange({ formato_privacidad_tv: v as FormatoPrivacidadTv })}
            title={op.title}
            description={op.ejemplo}
            icon={op.icon}
          />
        ))}
      </div>
    </Card>
  );
}
