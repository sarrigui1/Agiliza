import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { RolUsuario } from '@/types/database';

/**
 * Next.js 16 renombró la convención `middleware.ts` a `proxy.ts` (misma función, mismo
 * runtime Node.js, mismo `config.matcher`). Ver: https://nextjs.org/docs/messages/middleware-to-proxy
 *
 * Rutas públicas (sin sesión de usuario):
 * - /login            pantalla de acceso
 * - /display/[zone]   TV pública (anon, RLS de `llamados`)
 * - /checkin          tótem de autoservicio (paciente, sin cuenta personal)
 * - /api/cron         Vercel Cron invoca sin cookies de sesión; se autentica solo con
 *                     CRON_SECRET dentro del propio Route Handler. Si no se excluye aquí,
 *                     el proxy lo redirige a /login antes de que el handler pueda correr.
 */
const PUBLIC_PREFIXES = ['/login', '/display', '/checkin', '/api/cron'];

/** Prefijo de ruta protegida -> roles permitidos (cubre /admin/settings y /admin/supervisor) */
const PROTECTED_ROUTES: { prefix: string; roles: RolUsuario[] }[] = [
  // Más específica primero: `.find()` se queda con la primera coincidencia, así que
  // /admin/usuarios (gestión de credenciales/roles) queda restringido a admin aunque
  // el resto de /admin ya permita también a supervisor.
  { prefix: '/admin/usuarios', roles: ['admin'] },
  { prefix: '/admin', roles: ['admin', 'supervisor'] },
  { prefix: '/workspace', roles: ['agente', 'admin', 'supervisor'] },
];

/** Home por defecto al iniciar sesión, según rol */
const ROLE_HOME: Record<RolUsuario, string> = {
  admin: '/admin/settings',
  supervisor: '/admin/supervisor',
  agente: '/workspace',
  recepcion: '/checkin',
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca el token de sesión en cada request (requerido por @supabase/ssr).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  // Sin sesión intentando entrar a una ruta protegida -> /login
  if (!user && !publicPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Con sesión: resolver rol y aplicar RBAC de borde + redirecciones de conveniencia.
  if (user) {
    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol, activo')
      .eq('id', user.id)
      .single();

    const rol = perfil?.rol as RolUsuario | undefined;
    const home = rol ? ROLE_HOME[rol] : '/login';

    // Perfil inexistente/inactivo -> se cierra el acceso (defensa en profundidad; RLS
    // ya lo bloquearía a nivel de datos, esto evita además servirle la UI).
    if (!perfil || perfil.activo === false) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Ya autenticado y visitando /login o la raíz -> a su home por rol.
    if (pathname === '/login' || pathname === '/') {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }

    // Verifica que el rol tenga permiso sobre el grupo de rutas protegidas visitado.
    const matched = PROTECTED_ROUTES.find(
      (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
    );
    if (matched && rol && !matched.roles.includes(rol)) {
      const url = request.nextUrl.clone();
      url.pathname = home;
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
};
