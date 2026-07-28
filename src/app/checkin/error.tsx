'use client';

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/Button';

/**
 * Error boundary de esta ruta — ver la nota equivalente en src/app/display/error.tsx.
 * Las fallas de red durante el envío de un turno ya se manejan en CheckinFlow (ver
 * conManejoDeRed) sin llegar hasta acá; este boundary es la última red de seguridad para
 * errores de render inesperados, para no dejar al paciente frente a la pantalla en inglés
 * de Next por defecto.
 */
export default function CheckinError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-bg px-16 text-center">
      <WifiOff className="size-16 text-warning" />
      <div>
        <p className="font-mono text-xl font-bold uppercase tracking-widest text-text">
          Agiliza no pudo cargar el registro
        </p>
        <p className="mt-2 text-muted">Verifica la conexión a internet e inténtalo de nuevo.</p>
      </div>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
