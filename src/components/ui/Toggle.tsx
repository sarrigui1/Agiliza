'use client';

import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, description, disabled }: ToggleProps) {
  return (
    <label
      className={cn(
        'flex items-center justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-medium text-text">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors',
          checked ? 'border-primary bg-primary/40' : 'border-border bg-surface-high',
        )}
      >
        {/*
          El thumb es un hijo flex normal (no absolute) a propósito: `items-center` en el
          track lo centra verticalmente sin depender de números mágicos. Antes usaba
          `absolute top-0.5` sobre un track de 26px de alto interior con un thumb de 20px,
          lo que dejaba 2px arriba y 4px abajo — descentrado. El desplazamiento horizontal
          (22px) es exacto: ancho interior del track (48 - 1px borde×2 - 2px padding×2 = 42px)
          menos el ancho del thumb (20px), así el thumb queda pegado al borde con el mismo
          inset de 3px (borde + padding) a ambos lados, tanto activo como inactivo.
        */}
        <span
          className={cn(
            'size-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[22px]' : 'translate-x-0',
          )}
        />
      </button>
    </label>
  );
}
