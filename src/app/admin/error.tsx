'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';

/** Cubre /admin/* (settings, dashboard, supervisor, infraestructura, citas, reportes, usuarios, notificaciones). */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-bg px-16 text-center">
      <AlertTriangle className="size-16 text-warning" />
      <div>
        <p className="font-mono text-xl font-bold uppercase tracking-widest text-text">
          Ocurrió un error inesperado
        </p>
        <p className="mt-2 text-muted">El equipo ya fue notificado. Puedes intentar de nuevo.</p>
      </div>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
