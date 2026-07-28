'use client';

import { useEffect } from 'react';
import { WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Error boundary de esta ruta — sin esto, cualquier excepción no controlada en /display
 * cae en la pantalla de error genérica de Next (sin marca, en inglés). Este boundary NO
 * cubre fallas de Realtime (esas se manejan en vivo dentro de DisplayScreen, ver
 * useRealtimeCalls) — es la última red de seguridad para errores de render inesperados.
 */
export default function DisplayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[display] error de render:', error);
  }, [error]);

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-6 bg-bg px-16 text-center">
      <WifiOff className="size-16 text-warning" />
      <div>
        <p className="font-mono text-xl font-bold uppercase tracking-widest text-text">
          Agiliza no pudo cargar esta pantalla
        </p>
        <p className="mt-2 text-muted">Reintentando automáticamente. Si el problema continúa, verifica la conexión a internet.</p>
      </div>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </main>
  );
}
