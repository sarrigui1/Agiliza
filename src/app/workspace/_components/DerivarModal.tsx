'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { derivarTurno } from '@/actions/workspace';
import type { Especialidad, PuntoAtencion, Turno } from '@/types/database';

interface DerivarModalProps {
  open: boolean;
  onClose: () => void;
  turno: Turno;
  puntoAtencion: PuntoAtencion;
  especialidades: Especialidad[];
  onError: (mensaje: string) => void;
}

export function DerivarModal({ open, onClose, turno, puntoAtencion, especialidades, onError }: DerivarModalProps) {
  const destinos = especialidades.filter((e) => e.id !== turno.especialidad_id);
  const [especialidadDestino, setEspecialidadDestino] = useState(destinos[0]?.id ?? '');
  const [isPending, startTransition] = useTransition();

  const confirmar = () => {
    if (!especialidadDestino) return;
    startTransition(async () => {
      const res = await derivarTurno(turno.id, especialidadDestino, puntoAtencion.zona_id);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onClose();
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Derivar a 2da especialidad">
      <p className="mb-4 text-sm text-muted">
        El turno <span className="font-mono font-bold text-text">{turno.codigo}</span> finalizará aquí y
        se generará un nuevo ticket en la especialidad seleccionada.
      </p>

      <label className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
        Especialidad destino
      </label>
      <select
        value={especialidadDestino}
        onChange={(e) => setEspecialidadDestino(e.target.value)}
        className="mb-6 w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
      >
        {destinos.length === 0 && <option value="">No hay otras especialidades activas</option>}
        {destinos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={confirmar} loading={isPending} disabled={!especialidadDestino}>
          Confirmar Derivación
        </Button>
      </div>
    </Modal>
  );
}
