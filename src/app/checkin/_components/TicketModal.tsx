'use client';

import { useEffect } from 'react';
import { Ticket, Clock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { TurnoConEstimado } from '@/types/domain';

const AUTO_CIERRE_MS = 10_000;

export function TicketModal({ turno, onClose }: { turno: TurnoConEstimado; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_CIERRE_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <Modal open onClose={onClose} className="max-w-md text-center">
      <Ticket className="mx-auto mb-4 size-10 text-primary" />
      <p className="mb-2 font-mono text-sm uppercase tracking-widest text-muted">Su turno es</p>
      <p className="mb-6 font-mono text-7xl font-bold text-primary glow-primary">{turno.codigo}</p>

      <div className="mb-6 flex items-center gap-3 rounded-lg border border-secondary/40 bg-secondary/10 px-5 py-4 text-left">
        <Clock className="size-6 shrink-0 text-secondary" />
        <div>
          <p className="text-sm font-semibold text-text">
            {turno.tiempoEstimadoMinutos > 0 ? (
              <>
                Tiempo estimado de espera:{' '}
                <span className="text-secondary">~{turno.tiempoEstimadoMinutos} min</span>
              </>
            ) : (
              <span className="text-secondary">Eres el siguiente en la fila</span>
            )}
          </p>
          <p className="text-xs text-muted">Te avisaremos en pantalla cuando sea tu turno.</p>
        </div>
      </div>

      <p className="mb-8 text-sm text-muted">
        Conserve este ticket. Cuando sea llamado, se anunciará en la pantalla y por sonido.
      </p>
      <Button size="lg" className="w-full" onClick={onClose}>
        Aceptar
      </Button>
    </Modal>
  );
}
