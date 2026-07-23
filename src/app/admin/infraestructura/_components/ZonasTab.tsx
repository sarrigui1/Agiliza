'use client';

import { useState, useTransition } from 'react';
import { Plus, Pencil, Power } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { crearZona, actualizarZona, cambiarEstadoZona } from '@/actions/infrastructure';
import type { Zona } from '@/types/database';

interface ZonasTabProps {
  zonas: Zona[];
  onExito: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

export function ZonasTab({ zonas, onExito, onError }: ZonasTabProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [zonaEditando, setZonaEditando] = useState<Zona | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function abrirCrear() {
    setZonaEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(zona: Zona) {
    setZonaEditando(zona);
    setModalAbierto(true);
  }

  function guardar(nombre: string, descripcion: string) {
    startTransition(async () => {
      const res = zonaEditando
        ? await actualizarZona(zonaEditando.id, { nombre, descripcion: descripcion || null })
        : await crearZona(nombre, descripcion);

      if (!res.ok) {
        onError(res.error);
        return;
      }
      setModalAbierto(false);
      onExito(zonaEditando ? 'Zona actualizada correctamente.' : 'Zona creada correctamente.');
    });
  }

  function toggleEstado(zona: Zona) {
    setPendingId(zona.id);
    startTransition(async () => {
      const res = await cambiarEstadoZona(zona.id, !zona.activo);
      setPendingId(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onExito(`Zona "${zona.nombre}" ${res.data.activo ? 'activada' : 'desactivada'}.`);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={abrirCrear}>
          <Plus className="size-4" />
          Nueva Zona
        </Button>
      </div>

      <Card className="p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Código</th>
              <th className="px-6 py-3">Descripción</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {zonas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-6 text-center text-muted">
                  No hay zonas registradas.
                </td>
              </tr>
            )}
            {zonas.map((zona) => (
              <tr key={zona.id}>
                <td className="px-6 py-4 font-medium text-text">{zona.nombre}</td>
                <td className="px-6 py-4 font-mono text-muted">{zona.codigo}</td>
                <td className="px-6 py-4 text-muted">{zona.descripcion ?? '—'}</td>
                <td className="px-6 py-4">
                  <Badge tone={zona.activo ? 'primary' : 'neutral'}>
                    {zona.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="default" onClick={() => abrirEditar(zona)}>
                      <Pencil className="size-3.5" />
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="default"
                      loading={isPending && pendingId === zona.id}
                      onClick={() => toggleEstado(zona)}
                    >
                      <Power className="size-3.5" />
                      {zona.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <ZonaModal
        open={modalAbierto}
        zona={zonaEditando}
        loading={isPending}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />
    </div>
  );
}

function ZonaModal({
  open,
  zona,
  loading,
  onClose,
  onGuardar,
}: {
  open: boolean;
  zona: Zona | null;
  loading: boolean;
  onClose: () => void;
  onGuardar: (nombre: string, descripcion: string) => void;
}) {
  const [nombre, setNombre] = useState(zona?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(zona?.descripcion ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={zona ? 'Editar Zona' : 'Nueva Zona'}
      key={zona?.id ?? 'nueva'}
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">Nombre</span>
          <input
            defaultValue={zona?.nombre ?? ''}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Piso 3 - Urgencias"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
            Descripción (opcional)
          </span>
          <input
            defaultValue={zona?.descripcion ?? ''}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Ej: Área de urgencias y triage"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!nombre.trim() && !zona}
            onClick={() => onGuardar(nombre || zona?.nombre || '', descripcion)}
          >
            {zona ? 'Guardar Cambios' : 'Crear Zona'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
