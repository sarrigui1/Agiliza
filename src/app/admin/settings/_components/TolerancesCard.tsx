import { Clock } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';

interface TolerancesCardProps {
  permitirCitasProgramadas: boolean;
  minutosCheckinPrevio: number;
  minutosTolerancia: number;
  segundosIntervaloRellamado: number;
  onChange: (patch: Partial<{
    permitir_citas_programadas: boolean;
    minutos_checkin_previo: number;
    minutos_tolerancia: number;
    segundos_intervalo_rellamado: number;
  }>) => void;
}

function CampoNumerico({
  label,
  unidad,
  value,
  onChange,
}: {
  label: string;
  unidad: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-lg text-text outline-none"
        />
        <span className="font-mono text-xs text-muted">{unidad}</span>
      </div>
    </label>
  );
}

export function TolerancesCard({
  permitirCitasProgramadas,
  minutosCheckinPrevio,
  minutosTolerancia,
  segundosIntervaloRellamado,
  onChange,
}: TolerancesCardProps) {
  return (
    <Card>
      <CardTitle>
        <Clock className="size-5 text-primary" />
        Tiempos y Tolerancia
      </CardTitle>

      <div className="mb-6 border-b border-border pb-6">
        <Toggle
          checked={permitirCitasProgramadas}
          onChange={(v) => onChange({ permitir_citas_programadas: v })}
          label="Módulo de Citas Programadas / Agenda"
          description="Habilita el flujo de 'Tengo Cita Programada' en Check-In. Si está apagado, el tótem entra directo al registro de turno."
        />
      </div>

      <div className="flex flex-col gap-4">
        <CampoNumerico
          label="Check-in Previo"
          unidad="min"
          value={minutosCheckinPrevio}
          onChange={(v) => onChange({ minutos_checkin_previo: v })}
        />
        <CampoNumerico
          label="Tolerancia Retraso"
          unidad="min"
          value={minutosTolerancia}
          onChange={(v) => onChange({ minutos_tolerancia: v })}
        />
        <CampoNumerico
          label="Intervalo Re-llamado"
          unidad="seg"
          value={segundosIntervaloRellamado}
          onChange={(v) => onChange({ segundos_intervalo_rellamado: v })}
        />
      </div>
    </Card>
  );
}
