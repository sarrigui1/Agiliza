'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * Última red de seguridad: solo se activa si el propio layout raíz (src/app/layout.tsx)
 * falla al renderizar — algo que ningún error.tsx de ruta puede capturar, porque esos
 * viven DENTRO del layout. Por eso trae sus propias etiquetas <html>/<body>: reemplaza
 * el layout raíz completo, no solo el contenido de una página.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          display: 'flex',
          height: '100dvh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5rem',
          backgroundColor: '#0a0a0a',
          color: '#f4f4f5',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: '0 2rem',
        }}
      >
        <p style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          Agiliza no pudo cargar el sistema
        </p>
        <p style={{ color: '#a1a1aa' }}>Verifica la conexión a internet e inténtalo de nuevo.</p>
        <button
          type="button"
          onClick={reset}
          style={{
            padding: '0.75rem 2rem',
            borderRadius: '0.5rem',
            backgroundColor: '#39ff14',
            color: '#0a0a0a',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
