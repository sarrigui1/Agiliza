import * as Sentry from '@sentry/nextjs';

/** Next.js invoca register() una vez al arrancar cada runtime (Node.js y Edge por separado). */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/** Captura errores de Server Actions / Route Handlers que no pasaron por un try/catch propio. */
export const onRequestError = Sentry.captureRequestError;
