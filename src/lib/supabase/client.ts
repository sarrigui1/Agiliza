'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Client Components.
 * Uso principal: suscripciones Realtime (WebSockets) en TV Display y Operator Workspace,
 * y formularios interactivos (Check-In, Configuración) que necesitan reactividad inmediata.
 *
 * Se instancia una vez por componente/hook que lo use (no es un singleton global) para
 * evitar compartir estado de sesión entre pestañas del navegador de forma inesperada.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
