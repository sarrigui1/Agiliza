'use client';

/**
 * No estaba en la lista de 5 vistas de esta fase, pero sin ella ninguna ruta protegida
 * (/workspace, /admin/settings, /admin/supervisor) es alcanzable — el diseño ya estaba
 * aprobado desde la Fase 0 (inicio_de_sesión_kinetic_neon_enterprise), así que se
 * implementa aquí como pieza mínima necesaria para poder probar el resto end-to-end.
 */

import { useState } from 'react';
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
  const [cargando, setCargando] = useState(false);

  async function iniciarSesion(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    setCargando(false);
    if (authError) {
      setError('Credenciales inválidas. Verifique su usuario y contraseña.');
      return;
    }

    router.push('/');
    router.refresh();
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
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3">
              <Mail className="size-4 text-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className="w-full bg-transparent text-text outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block font-mono text-xs uppercase tracking-widest text-muted">
              Contraseña
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated px-4 py-3">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-text outline-none"
              />
              <button type="button" onClick={() => setMostrarPassword((v) => !v)}>
                {mostrarPassword ? (
                  <EyeOff className="size-4 text-muted" />
                ) : (
                  <Eye className="size-4 text-muted" />
                )}
              </button>
            </div>
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" size="lg" loading={cargando} className="mt-2">
            <LogIn className="size-5" />
            Iniciar Sesión
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
