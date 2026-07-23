'use client';

/**
 * No estaba en la lista de 5 vistas de esta fase, pero sin ella ninguna ruta protegida
 * (/workspace, /admin/settings, /admin/supervisor) es alcanzable — el diseño ya estaba
 * aprobado desde la Fase 0 (inicio_de_sesión_kinetic_neon_enterprise), así que se
 * implementa aquí como pieza mínima necesaria para poder probar el resto end-to-end.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Mail, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        setError('Credenciales inválidas. Verifique su usuario y contraseña.');
        return;
      }

      // `isPending` se deja en `true` a propósito en el camino feliz: no se apaga
      // antes de navegar, porque este componente se desmonta al completar el
      // redirect y no hay otro momento "correcto" para volver a habilitar el botón.
      // Así se evita el par de segundos donde el botón parecía congelado entre el
      // login exitoso y la redirección real.
      router.push('/');
      router.refresh();
    });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-10">
        <p className="mb-6 font-mono text-sm font-bold tracking-widest text-primary">
          KINETIC_NEON_OPS
        </p>
        <h1 className="mb-1 text-3xl font-bold text-text">Acceso al Sistema</h1>
        <p className="mb-8 text-sm text-muted">Ingrese sus credenciales para continuar</p>

        <form onSubmit={iniciarSesion} className="flex flex-col gap-5">
          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
              Usuario / Email
            </span>
            <div
              className={`flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3 transition-opacity ${isPending ? 'opacity-50' : ''}`}
            >
              <Mail className="size-4 text-muted" />
              <input
                type="email"
                required
                disabled={isPending}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full bg-transparent text-text outline-none disabled:cursor-not-allowed"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
              Contraseña
            </span>
            <div
              className={`flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3 transition-opacity ${isPending ? 'opacity-50' : ''}`}
            >
              <input
                type={mostrarPassword ? 'text' : 'password'}
                required
                disabled={isPending}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-text outline-none disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={isPending}
                onClick={() => setMostrarPassword((v) => !v)}
                className="disabled:cursor-not-allowed"
              >
                {mostrarPassword ? (
                  <EyeOff className="size-4 text-muted" />
                ) : (
                  <Eye className="size-4 text-muted" />
                )}
              </button>
            </div>
          </label>

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" loading={isPending} className="mt-2">
            <LogIn className="size-5" />
            {isPending ? 'Ingresando…' : 'Iniciar Sesión'}
          </Button>
        </form>

        <div className="mt-8 flex items-center justify-center gap-2 border-t border-border pt-6 text-xs text-muted">
          <ShieldCheck className="size-4" />
          Acceso de alta seguridad certificado
        </div>
      </div>
    </main>
  );
}
