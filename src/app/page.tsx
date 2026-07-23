import Link from 'next/link';

/**
 * En la práctica `src/proxy.ts` redirige toda visita a "/" hacia /login o al home
 * del rol autenticado antes de que este componente llegue a renderizarse.
 * Se deja como fallback mínimo (ej. si el proxy está deshabilitado en desarrollo).
 */
export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <p className="font-mono text-sm tracking-[0.3em] text-primary">FLOWQ</p>
      <h1 className="text-3xl font-semibold text-text">Sistema de Llamado y Gestión de Turnos</h1>
      <Link
        href="/login"
        className="rounded-lg bg-primary px-6 py-3 font-mono font-semibold text-primary-foreground glow-primary"
      >
        Ir a Iniciar Sesión
      </Link>
    </main>
  );
}
