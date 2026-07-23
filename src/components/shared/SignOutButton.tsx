'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function cerrarSesion() {
    setSaliendo(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={cerrarSesion}
      disabled={saliendo}
      className={cn(
        'flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted transition hover:text-danger disabled:opacity-50',
        className,
      )}
    >
      <LogOut className="size-4" />
      {saliendo ? 'Saliendo…' : 'Cerrar Sesión'}
    </button>
  );
}
