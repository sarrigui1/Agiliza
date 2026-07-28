'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';

export default function LoginError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
        <p className="mt-2 text-muted">Intenta de nuevo en unos segundos.</p>
      </div>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
