import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Vercel Cron Job — Cierre de jornada (ver vercel.json, "0 5 * * *" = 00:00 hora Colombia).
 *
 * Vercel firma cada invocación de cron con `Authorization: Bearer $CRON_SECRET`
 * automáticamente cuando esa env var está configurada en el proyecto — este handler
 * valida ese secreto para que el endpoint no sea invocable públicamente.
 *
 * Usa el cliente Service Role porque `fn_cerrar_jornada` intencionalmente no otorga
 * EXECUTE a `authenticated` (ninguna sesión de usuario debería poder cerrar la jornada).
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('fn_cerrar_jornada');

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      turnosExpirados: data,
      cerradoEn: new Date().toISOString(),
    });
  } catch (err) {
    // Ej. SUPABASE_SERVICE_ROLE_KEY ausente/inválida: createAdminClient() lanza en vez de
    // devolver un `error` — se captura acá para que el cron siempre reciba JSON, no un 500
    // con stack trace HTML.
    const mensaje = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
  }
}
