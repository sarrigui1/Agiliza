'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Stethoscope, Building2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Especialidad, Perfil, PuntoAtencion, Zona } from '@/types/database';
import { ZonasTab } from './ZonasTab';
import { ServiciosTab } from './ServiciosTab';
import { PuntosTab } from './PuntosTab';

export interface Asignacion {
  perfil_id: string;
  punto_atencion_id: string;
}

interface InfraestructuraViewProps {
  zonas: Zona[];
  especialidades: Especialidad[];
  puntos: PuntoAtencion[];
  agentes: Perfil[];
  asignaciones: Asignacion[];
}

type Pestana = 'zonas' | 'servicios' | 'puntos';

const PESTANAS: { id: Pestana; label: string; icon: typeof MapPin }[] = [
  { id: 'zonas', label: 'Zonas', icon: MapPin },
  { id: 'servicios', label: 'Servicios y Especialidades', icon: Stethoscope },
  { id: 'puntos', label: 'Puestos / Puntos de Atención', icon: Building2 },
];

export function InfraestructuraView({
  zonas,
  especialidades,
  puntos,
  agentes,
  asignaciones,
}: InfraestructuraViewProps) {
  const router = useRouter();
  const [pestana, setPestana] = useState<Pestana>('zonas');
  const [toast, setToast] = useState<{ mensaje: string; tono: 'exito' | 'error' } | null>(null);

  function notificar(mensaje: string, tono: 'exito' | 'error' = 'exito') {
    setToast({ mensaje, tono });
    setTimeout(() => setToast(null), 4000);
  }

  /** Server Action exitosa -> avisa y refresca los datos de la RSC (revalidatePath ya invalidó el cache). */
  function onExito(mensaje: string) {
    notificar(mensaje, 'exito');
    router.refresh();
  }

  function onError(mensaje: string) {
    notificar(mensaje, 'error');
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

      <header className="mb-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Panel de Administración</p>
        <h1 className="text-2xl font-bold text-text">Infraestructura Operativa</h1>
      </header>

      <div className="mb-6 flex gap-1 border-b border-border">
        {PESTANAS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPestana(id)}
            className={cn(
              'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition',
              pestana === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-text',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {pestana === 'zonas' && <ZonasTab zonas={zonas} onExito={onExito} onError={onError} />}
      {pestana === 'servicios' && (
        <ServiciosTab especialidades={especialidades} onExito={onExito} onError={onError} />
      )}
      {pestana === 'puntos' && (
        <PuntosTab
          puntos={puntos}
          zonas={zonas}
          especialidades={especialidades}
          agentes={agentes}
          asignaciones={asignaciones}
          onExito={onExito}
          onError={onError}
        />
      )}
    </main>
  );
}
