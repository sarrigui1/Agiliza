import * as Sentry from '@sentry/nextjs';

/**
 * Inicialización del SDK en el navegador (TV Display, Check-In, paneles de staff).
 *
 * A propósito NO se activa Session Replay (`replaysSessionSampleRate`): grabaría la
 * pantalla de Check-In, que muestra nombre/documento/teléfono del paciente — un riesgo de
 * privacidad innecesario para lo que se busca acá (saber que algo se rompió, no grabar
 * sesiones). Si más adelante hace falta, debe habilitarse con enmascarado explícito de
 * los campos de PII, no por defecto.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
