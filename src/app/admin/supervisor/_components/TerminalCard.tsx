import { ArrowLeftRight, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { TerminalInfo } from './SupervisorDashboard';

function estadoVisible(t: TerminalInfo): { texto: string; tone: 'primary' | 'warning' | 'secondary' | 'neutral' } {
  if (t.turnoCodigo) return { texto: `Atendiendo - ${t.turnoCodigo}`, tone: 'primary' };
  if (t.saturado) return { texto: 'Saturación', tone: 'warning' };
  if (t.estadoRaw === 'disponible') return { texto: 'Disponible', tone: 'secondary' };
  if (t.estadoRaw === 'pausado') return { texto: 'En Pausa', tone: 'neutral' };
  return { texto: 'Fuera de Línea', tone: 'neutral' };
}

export function TerminalCard({
  terminal,
  onIntervenir,
}: {
  terminal: TerminalInfo;
  onIntervenir: (mensaje: string) => void;
}) {
  const estado = estadoVisible(terminal);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-surface px-6 py-4 ${
        terminal.saturado ? 'border-warning/50' : 'border-border'
      }`}
    >
      <div className="min-w-[160px]">
        <p className="font-semibold text-text">{terminal.nombre}</p>
        <p className="text-sm text-muted">{terminal.agenteNombre}</p>
      </div>

      <Badge tone={estado.tone}>{estado.texto}</Badge>

      <div className="text-center">
        <p className="font-mono text-lg font-bold text-text">{terminal.enEspera}</p>
        <p className="text-xs text-muted">en espera</p>
      </div>

      {terminal.saturado ? (
        <Button
          variant="ghost"
          className="border-warning/50 text-warning"
          onClick={() => onIntervenir(`Intervención sobre ${terminal.nombre} disponible en la próxima fase.`)}
        >
          <Zap className="size-4" />
          Intervenir
        </Button>
      ) : (
        <Button
          variant="ghost"
          onClick={() => onIntervenir(`Reasignar ${terminal.nombre} estará disponible en la próxima fase.`)}
        >
          <ArrowLeftRight className="size-4" />
          Reasignar
        </Button>
      )}
    </div>
  );
}
