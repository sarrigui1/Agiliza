'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  crearPuntoAtencion,
  actualizarPuntoAtencion,
  asignarAgenteAPunto,
  cambiarEstadoPunto,
  type EstadoPuntoAdministrable,
} from '@/actions/infrastructure';
import type { Especialidad, Perfil, PuntoAtencion, Zona } from '@/types/database';
import type { Asignacion } from './InfraestructuraView';

const ESTADOS_ADMINISTRABLES: { value: EstadoPuntoAdministrable; label: string }[] = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'pausado', label: 'Pausado' },
  { value: 'fuera_de_linea', label: 'Fuera de Línea' },
];

interface PuntosTabProps {
  puntos: PuntoAtencion[];
  zonas: Zona[];
  especialidades: Especialidad[];
  agentes: Perfil[];
  asignaciones: Asignacion[];
  onExito: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}

export function PuntosTab({
  puntos,
  zonas,
  especialidades,
  agentes,
  asignaciones,
  onExito,
  onError,
}: PuntosTabProps) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [puntoEditando, setPuntoEditando] = useState<PuntoAtencion | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const zonaNombre = useMemo(() => new Map(zonas.map((z) => [z.id, z.nombre])), [zonas]);
  const especialidadNombre = useMemo(
    () => new Map(especialidades.map((e) => [e.id, e.nombre])),
    [especialidades],
  );
  const agenteAsignado = useMemo(
    () => new Map(asignaciones.map((a) => [a.punto_atencion_id, a.perfil_id])),
    [asignaciones],
  );

  function abrirCrear() {
    setPuntoEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(punto: PuntoAtencion) {
    setPuntoEditando(punto);
    setModalAbierto(true);
  }

  function guardar(nombre: string, zonaId: string, especialidadId: string) {
    startTransition(async () => {
      const res = puntoEditando
        ? await actualizarPuntoAtencion(puntoEditando.id, {
            nombre,
            zona_id: zonaId,
            especialidad_id: especialidadId,
          })
        : await crearPuntoAtencion(nombre, zonaId, especialidadId);

      if (!res.ok) {
        onError(res.error);
        return;
      }
      setModalAbierto(false);
      onExito(puntoEditando ? 'Punto de atención actualizado.' : 'Punto de atención creado correctamente.');
    });
  }

  function onCambiarAgente(puntoId: string, agenteId: string) {
    setPendingId(puntoId);
    startTransition(async () => {
      const res = await asignarAgenteAPunto(agenteId, puntoId);
      setPendingId(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onExito('Agente responsable actualizado.');
    });
  }

  function onCambiarEstado(puntoId: string, estado: EstadoPuntoAdministrable) {
    setPendingId(puntoId);
    startTransition(async () => {
      const res = await cambiarEstadoPunto(puntoId, estado);
      setPendingId(null);
      if (!res.ok) {
        onError(res.error);
        return;
      }
      onExito('Estado del punto de atención actualizado.');
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={abrirCrear}>
          <Plus className="size-4" />
          Nuevo Punto de Atención
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th className="px-6 py-3">Nombre</th>
              <th className="px-6 py-3">Zona</th>
              <th className="px-6 py-3">Servicio</th>
              <th className="px-6 py-3">Agente Responsable</th>
              <th className="px-6 py-3">Estado</th>
              <th className="px-6 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {puntos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-6 text-center text-muted">
                  No hay puntos de atención registrados.
                </td>
              </tr>
            )}
            {puntos.map((punto) => {
              const ocupado = isPending && pendingId === punto.id;
              return (
                <tr key={punto.id}>
                  <td className="px-6 py-4 font-medium text-text">{punto.nombre}</td>
                  <td className="px-6 py-4 text-muted">
                    {punto.zona_id ? zonaNombre.get(punto.zona_id) ?? '—' : '—'}
                  </td>
                  <td className="px-6 py-4 text-muted">
                    {punto.especialidad_id ? especialidadNombre.get(punto.especialidad_id) ?? '—' : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={agenteAsignado.get(punto.id) ?? ''}
                      disabled={ocupado}
                      onChange={(e) => onCambiarAgente(punto.id, e.target.value)}
                      className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-text disabled:opacity-50"
                    >
                      <option value="">Sin asignar</option>
                      {agentes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.nombre_completo}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {punto.estado === 'atendiendo' ? (
                      <Badge tone="primary">Atendiendo</Badge>
                    ) : (
                      <select
                        value={punto.estado}
                        disabled={ocupado}
                        onChange={(e) =>
                          onCambiarEstado(punto.id, e.target.value as EstadoPuntoAdministrable)
                        }
                        className="rounded-md border border-border bg-surface-elevated px-2 py-1.5 text-text disabled:opacity-50"
                      >
                        {ESTADOS_ADMINISTRABLES.map((e) => (
                          <option key={e.value} value={e.value}>
                            {e.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end">
                      <Button variant="ghost" size="default" onClick={() => abrirEditar(punto)}>
                        <Pencil className="size-3.5" />
                        Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <PuntoModal
        open={modalAbierto}
        punto={puntoEditando}
        zonas={zonas}
        especialidades={especialidades}
        loading={isPending}
        onClose={() => setModalAbierto(false)}
        onGuardar={guardar}
      />
    </div>
  );
}

function PuntoModal({
  open,
  punto,
  zonas,
  especialidades,
  loading,
  onClose,
  onGuardar,
}: {
  open: boolean;
  punto: PuntoAtencion | null;
  zonas: Zona[];
  especialidades: Especialidad[];
  loading: boolean;
  onClose: () => void;
  onGuardar: (nombre: string, zonaId: string, especialidadId: string) => void;
}) {
  const [nombre, setNombre] = useState(punto?.nombre ?? '');
  const [zonaId, setZonaId] = useState(punto?.zona_id ?? zonas[0]?.id ?? '');
  const [especialidadId, setEspecialidadId] = useState(punto?.especialidad_id ?? especialidades[0]?.id ?? '');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={punto ? 'Editar Punto de Atención' : 'Nuevo Punto de Atención'}
      key={punto?.id ?? 'nuevo'}
    >
      <div className="flex flex-col gap-4">
        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">Nombre</span>
          <input
            defaultValue={punto?.nombre ?? ''}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Módulo 3"
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">Zona</span>
          <select
            value={zonaId}
            onChange={(e) => setZonaId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {zonas.length === 0 && <option value="">No hay zonas registradas</option>}
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
            Servicio / Especialidad
          </span>
          <select
            value={especialidadId}
            onChange={(e) => setEspecialidadId(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-elevated px-4 py-3 text-text"
          >
            {especialidades.length === 0 && <option value="">No hay servicios registrados</option>}
            {especialidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={loading}
            disabled={!(nombre || punto?.nombre) || !zonaId || !especialidadId}
            onClick={() => onGuardar(nombre || punto?.nombre || '', zonaId, especialidadId)}
          >
            {punto ? 'Guardar Cambios' : 'Crear Punto'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
