'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { OPCIONES_RANGO, type RangoId } from '@/lib/dateRanges';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface RangoFilterBarProps {
  rangoActual: RangoId;
  desdeActual: string;
  hastaActual: string;
}

export function RangoFilterBar({ rangoActual, desdeActual, hastaActual }: RangoFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [desdeInput, setDesdeInput] = useState(desdeActual.slice(0, 10));
  const [hastaInput, setHastaInput] = useState(hastaActual.slice(0, 10));

  function aplicar(rango: RangoId, desde?: string, hasta?: string) {
    const params = new URLSearchParams();
    params.set('rango', rango);
    if (rango === 'personalizado') {
      params.set('desde', desde ?? desdeInput);
      params.set('hasta', hasta ?? hastaInput);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
        {OPCIONES_RANGO.map((op) => (
          <button
            key={op.value}
            type="button"
            onClick={() => aplicar(op.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              rangoActual === op.value ? 'bg-primary/10 text-primary' : 'text-muted hover:text-text',
            )}
          >
            {op.label}
          </button>
        ))}
      </div>

      {rangoActual === 'personalizado' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={desdeInput}
            onChange={(e) => setDesdeInput(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text"
          />
          <span className="text-muted">a</span>
          <input
            type="date"
            value={hastaInput}
            onChange={(e) => setHastaInput(e.target.value)}
            className="rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm text-text"
          />
          <Button size="default" onClick={() => aplicar('personalizado', desdeInput, hastaInput)}>
            Aplicar
          </Button>
        </div>
      )}
    </div>
  );
}
