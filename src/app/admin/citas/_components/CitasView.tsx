'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { registrarCitaPrevia } from '@/actions/citas';
import type { Especialidad, EstadoTurno, Turno, Zona } from '@/types/database';

const ESTADO_TONE: Record<EstadoTurno, 'neutral' | 'primary' | 'secondary' | 'warning' | 'danger'> = {
  programado: 'secondary',
  en_espera: 'primary',
  llamado: 'primary',
  en_atencion: 'primary',
  finalizado: 'neutral',
  cancelado: 'danger',
  ausente: 'warning',
  reingresado: 'warning',
};

const ESTADO_LABEL: Record<EstadoTurno, string> = {
  programado: 'Programada',
  en_espera: 'En Espera',
  llamado: 'Llamado',
  en_atencion: 'En Atención',
  finalizado: 'Finalizado',
  cancelado: 'Cancelado',
  ausente: 'Ausente',
  reingresado: 'Reingresado',
};

interface CitasViewProps {
  citasIniciales: Turno[];
  especialidades: Especialidad[];
  zonas: Zona[];
}

export function CitasView({ citasIniciales, especialidades, zonas }: CitasViewProps) {
  const router = useRouter();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [toast, setToast] = useState<{ mensaje: string; tono: 'exito' | 'error' } | null>(null);
  const [isPending, startTransition] = useTransition();

  function notificar(mensaje: string, tono: 'exito' | 'error' = 'exito') {
    setToast({ mensaje, tono });
    setTimeout(() => setToast(null), 4000);
  }

  const nombreEspecialidad = (id: string) => especialidades.find((e) => e.id === id)?.nombre ?? id;

  function registrar(input: {
    nombre: string;
    documento: string;
    especialidadId: string;
    zonaId: string;
    horaCita: string;
  }) {
    startTransition(async () => {
      const res = await registrarCitaPrevia(input);
      if (!res.ok) {
        notificar(res.error, 'error');
        return;
      }
      setModalAbierto(false);
      notificar('Cita registrada correctamente.');
      router.refresh();
    });
  }

  return (
    <main className="p-8">
      {toast && (
        <div
          className={cn(
            'fixed left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-6 py-3 text-sm shadow-xl',
            toast.tono === 'exito'
              ? 'border-primary/50 bg-surface text-primary'
              : 'border-danger/50 bg-surface text-danger',
          )}
        >
          {toast.tono === 'exito' ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          {toast.mensaje}
        </div>
      )}

      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">Panel de Administración</p>
          <h1 className="text-2xl font-bold text-text">Citas del Día</h1>
        </div>
        <Button onClick={() => setModalAbierto(true)}>
          <CalendarPlus className="size-4" />
          Nueva Cita
        </Button>
      </header>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3">Hora</th>
              <th className="px-6 py-3">Paciente</th>
              <th className="px-6 py-3">Documento</th>
              <th className="px-6 py-3">Especialidad</th>
              <th className="px-6 py-3">Código</th>
              <th className="px-6 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {citasIniciales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-muted">
                  No hay citas registradas para hoy.
                </td>
              </tr>
            )}
            {citasIniciales.map((cita) => (
              <tr key={cita.id}>
                <td className="px-6 py-4 font-mono text-text">
                  {cita.hora_cita
                    ? new Date(cita.hora_cita).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </td>
                <td className="px-6 py-4 font-medium text-text">{cita.nombre_paciente}</td>
                <td className="px-6 py-4 font-mono text-muted">{cita.documento_paciente}</td>
                <td className="px-6 py-4 text-text">{nombreEspecialidad(cita.especialidad_id)}</td>
                <td className="px-6 py-4">
                  <Badge tone="secondary">{cita.codigo}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge tone={ESTADO_TONE[cita.estado]}>{ESTADO_LABEL[cita.estado]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <NuevaCitaModal
        open={modalAbierto}
        especialidades={especialidades}
        zonas={zonas}
        loading={isPending}
        onClose={() => setModalAbierto(false)}
        onGuardar={registrar}
      />
    </main>
  );
}

function NuevaCitaModal({
  open,
  especialidades,
  zonas,
  loading,
  onClose,
  onGuardar,
}: {
  open: boolean;
  especialidades: Especialidad[];
  zonas: Zona[];
  loading: boolean;
  onClose: () => void;
  onGuardar: (input: {
    nombre: string;
    documento: string;
    especialidadId: string;
    zonaId: string;
    horaCita: string;
  }) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [especialidadId, setEspecialidadId] = useState(especialidades[0]?.id ?? '');
  const [zonaId, setZonaId] = useState(zonas[0]?.id ?? '');
  const [horaCita, setHoraCita] = useState('');

  function cerrar() {
    setNombre('');
    setDocumento('');
    setHoraCita('');
    onClose();
  }

  return (
    <Modal open={open} onClose={cerrar} title="Registrar Cita Previa">
      <div className="flex flex-col gap-4">
        <Campo label="Nombre completo">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Juan Pérez"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <Campo label="Documento">
          <input
            value={documento}
            onChange={(e) => setDocumento(e.target.value.replace(/\D/g, ''))}
            placeholder="1020304050"
            inputMode="numeric"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>
        <Campo label="Especialidad">
          <select
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Zona">
          <select
            value={zonaId}
            onChange={(e) => setZonaId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Fecha y Hora de la Cita">
          <input
            type="datetime-local"
            value={horaCita}
            onChange={(e) => setHoraCita(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </Campo>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={cerrar}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!nombre || documento.length < 5 || !especialidadId || !zonaId || !horaCita}
            onClick={() => onGuardar({ nombre, documento, especialidadId, zonaId, horaCita })}
          >
            Registrar Cita
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">{label}</span>
      {children}
    </label>
  );
}
