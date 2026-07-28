import * as Sentry from '@sentry/nextjs';

/** Runtime Edge (proxy.ts / middleware). Ver la nota de sentry.server.config.ts. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0,
});
