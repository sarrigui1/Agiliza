import * as Sentry from '@sentry/nextjs';

/**
 * Runtime Node.js (Server Actions, Route Handlers). Sin NEXT_PUBLIC_SENTRY_DSN configurado
 * (Sentry.init recibe undefined), el SDK queda inerte — no lanza, no envía nada — así que
 * el sistema sigue funcionando igual en cualquier entorno que no lo tenga seteado.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0, // solo captura de errores por ahora, sin tracing de performance
});
