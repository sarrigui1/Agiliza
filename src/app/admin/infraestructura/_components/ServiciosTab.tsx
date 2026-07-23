'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { crearServicio, actualizarServicio, cambiarEstadoServicio } from '@/actions/infrastructure';
import type { Especialidad } from '@/types/database';

interface ServiciosTabProps {
  especialidades: Especialidad[];
  onExito: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

export function ServiciosTab({ especialidades, onExito, onError }: ServiciosTabProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [servicioEditando, setServicioEditando] = useState<Especialidad | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function abrirCrear() {
    setServicioEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(servicio: Especialidad) {
    setServicioEditando(servicio);
    setModalAbierto(true);
  }

  function guardar(nombre: string, codigo: string) {
    startTransition(async () => {
      const res = servicioEditando
        ? await actualizarServicio(servicioEditando.id, { nombre, codigo })
        : await crearServicio(nombre, codigo);

      if (!res.ok) {
        onError(res.error);
        return;
      }
      setModalAbierto(false);
      onExito(servicioEditando ? 'Servicio actualizado correctamente.' : 'Servicio creado correctamente.');
    });
  }

  function toggleEstado(servicio: Especialidad) {
    setPendingId(servicio.id);
    startTransition(async () => {
      const res = await cambiarEstadoServicio(servicio.id, !servicio.activo);
      setPendingId(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onExito(`Servicio "${servicio.nombre}" ${res.data.activo ? 'activado' : 'desactivado'}.`);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={abrirCrear}>
          <Plus className="size-4" />
          Nuevo Servicio
        </Button>
      </div>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Prefijo de Ticket</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {especialidades.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-6 text-center text-muted">
                  No hay servicios registrados.
                </td>
              </tr>
            )}
            {especialidades.map((servicio) => (
              <tr key={servicio.id}>
                <td className="px-6 py-4 font-medium text-text">{servicio.nombre}</td>
                <td className="px-6 py-4">
                  <Badge tone="secondary">{servicio.codigo}</Badge>
                </td>
                <td className="px-6 py-4">
                  <Badge tone={servicio.activo ? 'primary' : 'neutral'}>
                    {servicio.activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="default" onClick={() => abrirEditar(servicio)}>
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="default"
                      loading={isPending && pendingId === servicio.id}
                      onClick={() => toggleEstado(servicio)}
                    >
                      <Power className="size-3.5" />
                      {servicio.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ServicioModal
        open={modalAbierto}
        servicio={servicioEditando}
        loading={isPending}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />
    </div>
  );
}

function ServicioModal({
  open,
  servicio,
  loading,
  onClose,
  onGuardar,
}: {
  open: boolean;
  servicio: Especialidad | null;
  loading: boolean;
  onClose: () => void;
  onGuardar: (nombre: string, codigo: string) => void;
}) {
  const [nombre, setNombre] = useState(servicio?.nombre ?? '');
  const [codigo, setCodigo] = useState(servicio?.codigo ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={servicio ? 'Editar Servicio' : 'Nuevo Servicio'}
      key={servicio?.id ?? 'nuevo'}
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">Nombre</span>
          <input
            defaultValue={servicio?.nombre ?? ''}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Cardiología"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
            Prefijo de Ticket
          </span>
          <input
            defaultValue={servicio?.codigo ?? ''}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            placeholder="Ej: CAR"
            maxLength={6}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 font-mono uppercase text-text"
          />
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!(nombre || servicio?.nombre) || !(codigo || servicio?.codigo)}
            onClick={() => onGuardar(nombre || servicio?.nombre || '', codigo || servicio?.codigo || '')}
          >
            {servicio ? 'Guardar Cambios' : 'Crear Servicio'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
