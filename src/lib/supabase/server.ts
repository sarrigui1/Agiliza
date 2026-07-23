import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Cliente Supabase para Server Components (RSC) y Server Actions.
 * Lee/escribe las cookies de sesión de Next.js para que la petición al backend
 * de Supabase viaje autenticada como el usuario actual (respeta RLS por rol).
 *
 * El bloque try/catch en `setAll` es necesario porque un Server Component puro
 * no puede escribir cookies (solo lo puede hacer un Server Action o Route Handler);
 * en ese caso el error se ignora porque `middleware.ts` ya se encarga de refrescar
 * la sesión en cada request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Se ignora si se invoca desde un Server Component (no puede mutar cookies).
          }
        },
      },
    },
  );
}
