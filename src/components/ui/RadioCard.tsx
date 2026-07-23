'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RadioCardProps {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
}

export function RadioCard({ name, value, checked, onChange, title, description, icon }: RadioCardProps) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition',
        checked ? 'border-primary bg-primary/5' : 'border-border bg-surface-elevated hover:border-border-strong',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span
        className={cn(
          'mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border',
          checked ? 'border-primary' : 'border-muted',
        )}
      >
        {checked && <span className="size-2 rounded-full bg-primary" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-text">{title}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {icon}
    </label>
  );
}
