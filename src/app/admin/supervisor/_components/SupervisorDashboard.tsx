'use client';

import { useState } from 'react';
import { AlertTriangle, Zap, BarChart3 } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SignOutButton } from '@/components/shared/SignOutButton';
import { TerminalCard } from './TerminalCard';
import type { EstadoPuntoAtencion } from '@/types/database';

export interface TerminalInfo {
  id: string;
  nombre: string;
  especialidad: string;
  agenteNombre: string;
  estadoRaw: EstadoPuntoAtencion;
  turnoCodigo: string | null;
  enEspera: number;
  saturado: boolean;
}

export interface TpeArea {
  nombre: string;
  minutos: number;
}

interface SupervisorDashboardProps {
  terminales: TerminalInfo[];
  tpePorArea: TpeArea[];
  atendidosHoy: number;
  ausentesHoy: number;
  haySaturacion: boolean;
}

export function SupervisorDashboard({
  terminales,
  tpePorArea,
  atendidosHoy,
  ausentesHoy,
  haySaturacion,
}: SupervisorDashboardProps) {
  const [aviso, setAviso] = useState<string | null>(null);

  function avisarPendiente(mensaje: string) {
    setAviso(mensaje);
    setTimeout(() => setAviso(null), 4000);
  }

  const maxTpe = Math.max(1, ...tpePorArea.map((a) => a.minutos));

  return (
    <main className="min-h-dvh bg-bg p-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-muted">Queue Center</p>
            <h1 className="text-2xl font-bold text-text">Supervisión Operativa</h1>
          </div>
          {haySaturacion && (
            <span className="flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
              <AlertTriangle className="size-3.5" />
              Alerta Saturación
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => avisarPendiente('La reasignación masiva estará disponible en la próxima fase.')}>
            <Zap className="size-4" />
            Reasignación Masiva
          </Button>
          <SignOutButton className="border-l border-border pl-4" />
        </div>
      </header>

      {aviso && (
        <div className="mb-6 rounded-lg border border-secondary/40 bg-secondary/10 px-4 py-3 text-sm text-secondary">
          {aviso}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <section>
          <h2 className="mb-4 flex items-center gap-2 font-mono text-sm uppercase tracking-widest text-muted">
            Estatus de Terminales
          </h2>
          <div className="flex flex-col gap-4">
            {terminales.length === 0 && (
              <p className="text-sm text-muted">No hay puntos de atención configurados.</p>
            )}
            {terminales.map((t) => (
              <TerminalCard key={t.id} terminal={t} onIntervenir={avisarPendiente} />
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <Card>
            <CardTitle>
              <BarChart3 className="size-5 text-primary" />
              TPE por Área
            </CardTitle>
            <div className="flex flex-col gap-4">
              {tpePorArea.length === 0 && <p className="text-sm text-muted">Sin datos de hoy todavía.</p>}
              {tpePorArea.map((a) => (
                <div key={a.nombre}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-text">{a.nombre}</span>
                    <span className="font-mono text-primary">{a.minutos} min</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface-high">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (a.minutos / maxTpe) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Resumen del Día</CardTitle>
            <div className="flex flex-col gap-6">
              <div>
                <p className="font-mono text-4xl font-bold text-primary">{atendidosHoy}</p>
                <p className="text-sm text-muted">Atendidos</p>
              </div>
              <div>
                <p className="font-mono text-4xl font-bold text-danger">{ausentesHoy}</p>
                <p className="text-sm text-muted">Ausentes</p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
