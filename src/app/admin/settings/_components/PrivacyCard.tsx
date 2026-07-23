import { Shield, Lock, EyeOff, Eye, Volume2, Bell, Mic } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { RadioCard } from '@/components/ui/RadioCard';
import type { FormatoPrivacidadTv, ModoAudioTv } from '@/types/database';

const OPCIONES_PRIVACIDAD: {
  value: FormatoPrivacidadTv;
  title: string;
  ejemplo: string;
  icon: React.ReactNode;
}[] = [
  { value: 'solo_codigo', title: 'Solo Código', ejemplo: 'Ej: TKT-A12', icon: <Lock className="size-4 text-muted" /> },
  {
    value: 'iniciales_parcial',
    title: 'Iniciales + ID Parcial',
    ejemplo: 'Ej: J.P. (***456)',
    icon: <EyeOff className="size-4 text-muted" />,
  },
  { value: 'nombre_completo', title: 'Nombre Completo', ejemplo: 'Ej: Juan Perez', icon: <Eye className="size-4 text-muted" /> },
];

const OPCIONES_AUDIO: { value: ModoAudioTv; title: string; description: string; icon: React.ReactNode }[] = [
  { value: 'tono', title: 'Solo Tono / Chime', description: 'Sin voz, solo el timbre de aviso.', icon: <Bell className="size-4 text-muted" /> },
  { value: 'voz', title: 'Solo Voz (TTS)', description: 'Anuncia el turno hablado, sin timbre.', icon: <Mic className="size-4 text-muted" /> },
  { value: 'tono_voz', title: 'Tono + Voz', description: 'Timbre y luego el anuncio hablado (por defecto).', icon: <Volume2 className="size-4 text-muted" /> },
];

interface PrivacyCardProps {
  formatoPrivacidadTv: FormatoPrivacidadTv;
  modoAudioTv: ModoAudioTv;
  onChange: (
    patch: Partial<{ formato_privacidad_tv: FormatoPrivacidadTv; modo_audio_tv: ModoAudioTv }>,
  ) => void;
}

export function PrivacyCard({ formatoPrivacidadTv, modoAudioTv, onChange }: PrivacyCardProps) {
  return (
    <Card>
      <CardTitle>
        <Shield className="size-5 text-primary" />
        Privacidad (TVs)
      </CardTitle>

      <div className="mb-6 flex flex-col gap-3">
        {OPCIONES_PRIVACIDAD.map((op) => (
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

      <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Audio de Sala</p>
      <div className="flex flex-col gap-3">
        {OPCIONES_AUDIO.map((op) => (
          <RadioCard
            key={op.value}
            name="modo_audio_tv"
            value={op.value}
            checked={modoAudioTv === op.value}
            onChange={(v) => onChange({ modo_audio_tv: v as ModoAudioTv })}
            title={op.title}
            description={op.description}
            icon={op.icon}
          />
        ))}
      </div>
    </Card>
  );
}
