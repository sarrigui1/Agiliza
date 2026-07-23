import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Cliente con la Service Role Key — bypassea RLS por completo.
 *
 * Uso exclusivamente server-side y en contextos de confianza total (Cron Jobs, tareas
 * administrativas internas de plataforma). NUNCA importar este módulo desde un Client
 * Component ni desde código que también corra en el navegador: `SUPABASE_SERVICE_ROLE_KEY`
 * no lleva prefijo `NEXT_PUBLIC_` justamente para que Next.js nunca la incluya en el
 * bundle del cliente.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
