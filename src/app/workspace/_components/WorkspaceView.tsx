'use client';

import { useMemo, useState, useTransition } from 'react';
import { PhoneCall, RefreshCw, CheckCircle2, UserX, Shuffle, Radio } from 'lucide-react';
import { useRealtimeTurnos } from '@/hooks/useRealtimeTurnos';
import { useElapsedTime } from '@/hooks/useElapsedTime';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  llamarSiguienteTurno,
  reLlamarTurno,
  marcarTurnoAusente,
  iniciarAtencion,
  finalizarAtencion,
} from '@/actions/workspace';
import type { ConfiguracionGlobal, Especialidad, Perfil, PuntoAtencion, Turno } from '@/types/database';
import { SignOutButton } from '@/components/shared/SignOutButton';
import { ColaTable } from './ColaTable';
import { DerivarModal } from './DerivarModal';
import { RendimientoPanel } from './RendimientoPanel';

interface WorkspaceViewProps {
  perfil: Perfil;
  puntoAtencion: PuntoAtencion;
  especialidades: Especialidad[];
  config: ConfiguracionGlobal | null;
  turnosIniciales: Turno[];
  finalizadosHoy: { hora_atencion: string | null; hora_finalizacion: string | null }[];
}

export function WorkspaceView({
  perfil,
  puntoAtencion,
  especialidades,
  config,
  turnosIniciales,
  finalizadosHoy,
}: WorkspaceViewProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [derivarAbierto, setDerivarAbierto] = useState(false);

  const turnos = useRealtimeTurnos(puntoAtencion.especialidad_id, puntoAtencion.zona_id, turnosIniciales);

  const turnoActivo = useMemo(
    () =>
      turnos.find(
        (t) => t.punto_atencion_id === puntoAtencion.id && ['llamado', 'en_atencion'].includes(t.estado),
      ) ?? null,
    [turnos, puntoAtencion.id],
  );

  const cola = useMemo(
    () =>
      turnos
        .filter((t) => t.estado === 'en_espera')
        .sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime()),
    [turnos],
  );

  const cronometro = useElapsedTime(
    turnoActivo ? turnoActivo.hora_atencion ?? turnoActivo.hora_llamado : null,
  );

  const limiteAusencia = config?.limite_llamados_ausencia ?? 3;

  function mostrarError(mensaje: string) {
    setErrorMsg(mensaje);
    setTimeout(() => setErrorMsg(null), 5000);
  }

  function ejecutar<T>(promesa: Promise<{ ok: boolean; error?: string; data?: T }>, alExito?: (data: T) => void) {
    startTransition(async () => {
      const res = await promesa;
      if (!res.ok) {
        mostrarError(res.error ?? 'Ocurrió un error inesperado.');
        return;
      }
      alExito?.(res.data as T);
    });
  }

  const onLlamarSiguiente = () =>
    ejecutar(llamarSiguienteTurno(puntoAtencion.id), (data) => {
      if (!data) mostrarError('No hay turnos en espera en esta cola.');
    });

  const onIniciarAtencion = () => {
    if (!turnoActivo) return;
    ejecutar(iniciarAtencion(turnoActivo.id, puntoAtencion.id));
  };

  const onReLlamar = () => {
    if (!turnoActivo) return;
    ejecutar(reLlamarTurno(turnoActivo.id));
  };

  const onFinalizar = () => {
    if (!turnoActivo) return;
    ejecutar(finalizarAtencion(turnoActivo.id, puntoAtencion.id));
  };

  const onMarcarAusente = () => {
    if (!turnoActivo) return;
    ejecutar(marcarTurnoAusente(turnoActivo.id));
  };

  const puedeReLlamar = turnoActivo?.estado === 'llamado';
  const puedeIniciarAtencion = turnoActivo?.estado === 'llamado';
  const puedeFinalizar = turnoActivo?.estado === 'en_atencion';
  const puedeMarcarAusente = turnoActivo?.estado === 'llamado' && turnoActivo.intentos_llamado >= limiteAusencia;
  const puedeDerivar = turnoActivo?.estado === 'llamado' || turnoActivo?.estado === 'en_atencion';

  return (
    <main className="min-h-dvh bg-bg p-8">
      {errorMsg && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-danger/50 bg-surface px-6 py-3 text-sm text-danger shadow-xl">
          {errorMsg}
        </div>
      )}

      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Panel Operaciones</h1>
          <p className="font-mono text-xs uppercase tracking-widest text-muted">
            {puntoAtencion.nombre}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-2">
          <span
            className={`size-2.5 rounded-full ${turnoActivo ? 'bg-primary animate-pulse' : 'bg-secondary'}`}
          />
          <div className="text-right">
            <p className="text-sm font-semibold text-text">{perfil.nombre_completo}</p>
            <p className="font-mono text-xs uppercase tracking-wide text-muted">
              {turnoActivo ? 'Atendiendo' : 'Disponible'}
            </p>
          </div>
          <SignOutButton className="border-l border-border pl-3" />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          {/* Hero */}
          <Card className="border-l-4 border-l-primary">
            {turnoActivo ? (
              <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-muted">
                    {turnoActivo.estado === 'llamado' ? 'Turno Llamado' : 'Turno en Atención'}
                  </p>
                  <p className="font-mono text-6xl font-bold text-primary">{turnoActivo.codigo}</p>
                  {cronometro && (
                    <p className="mt-2 font-mono text-3xl text-text">{cronometro} <span className="text-sm text-muted">min</span></p>
                  )}
                </div>
                {puedeIniciarAtencion && (
                  <Button size="xl" onClick={onIniciarAtencion} loading={isPending}>
                    <Radio className="size-5" />
                    Iniciar Atención
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-6">
                <p className="text-lg text-muted">No hay ningún turno activo en este momento.</p>
                <Button size="xl" onClick={onLlamarSiguiente} loading={isPending}>
                  <PhoneCall className="size-5" />
                  Llamar Siguiente
                </Button>
              </div>
            )}
          </Card>

          {/* Acciones rápidas 2x2 */}
          <div className="grid grid-cols-2 gap-4">
            <Button variant="ghost" disabled={!puedeReLlamar || isPending} onClick={onReLlamar}>
              <RefreshCw className="size-4" />
              Re-Llamar
            </Button>
            <Button variant="ghost" disabled={!puedeFinalizar || isPending} onClick={onFinalizar}>
              <CheckCircle2 className="size-4" />
              Finalizar
            </Button>
            <Button
              variant="ghost"
              disabled={!puedeMarcarAusente || isPending}
              onClick={onMarcarAusente}
              title={
                turnoActivo && !puedeMarcarAusente && turnoActivo.estado === 'llamado'
                  ? `Requiere ${limiteAusencia} intentos (lleva ${turnoActivo.intentos_llamado})`
                  : undefined
              }
            >
              <UserX className="size-4" />
              Marcar Ausente
            </Button>
            <Button variant="ghost" disabled={!puedeDerivar || isPending} onClick={() => setDerivarAbierto(true)}>
              <Shuffle className="size-4" />
              Derivar
            </Button>
          </div>

          {/* Cola en vivo */}
          <ColaTable turnos={cola} />
        </div>

        <RendimientoPanel finalizadosHoy={finalizadosHoy} tamanoCola={cola.length} />
      </div>

      {turnoActivo && (
        <DerivarModal
          open={derivarAbierto}
          onClose={() => setDerivarAbierto(false)}
          turno={turnoActivo}
          puntoAtencion={puntoAtencion}
          especialidades={especialidades}
          onError={mostrarError}
        />
      )}
    </main>
  );
}
