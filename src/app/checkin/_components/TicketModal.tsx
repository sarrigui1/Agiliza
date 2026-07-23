'use client';

import { useEffect } from 'react';
import { Ticket } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Turno } from '@/types/database';

const AUTO_CIERRE_MS = 10_000;

export function TicketModal({ turno, onClose }: { turno: Turno; onClose: () => void }) {
  useEffect(() => {
    const id = setTimeout(onClose, AUTO_CIERRE_MS);
    return () => clearTimeout(id);
  }, [onClose]);

  return (
    <Modal open onClose={onClose} className="max-w-md text-center">
      <Ticket className="mx-auto mb-4 size-10 text-primary" />
      <p className="mb-2 font-mono text-sm uppercase tracking-widest text-muted">Su turno es</p>
      <p className="mb-6 font-mono text-7xl font-bold text-primary glow-primary">{turno.codigo}</p>
      <p className="mb-8 text-sm text-muted">
        Conserve este ticket. Cuando sea llamado, se anunciará en la pantalla y por sonido.
      </p>
      <Button size="lg" className="w-full" onClick={onClose}>
        Aceptar
      </Button>
    </Modal>
  );
}
