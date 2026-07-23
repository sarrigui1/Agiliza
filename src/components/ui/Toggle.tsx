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
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'border-primary bg-primary/40' : 'border-border bg-surface-high',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-6' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}
