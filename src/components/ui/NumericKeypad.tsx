'use client';

import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface NumericKeypadProps {
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  maxLength?: number;
  label?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function NumericKeypad({
  value,
  onChange,
  onConfirm,
  maxLength = 12,
  label = 'Ingrese su número de documento',
  confirmLabel = 'Confirmar',
  confirmDisabled,
  confirmLoading,
}: NumericKeypadProps) {
  const press = (digit: string) => {
    if (value.length >= maxLength) return;
    onChange(value + digit);
  };
  const backspace = () => onChange(value.slice(0, -1));

  return (
    <div className="mx-auto w-full max-w-xl">
      {label && (
        <p className="mb-4 text-center font-mono text-sm uppercase tracking-widest text-muted">
          {label}
        </p>
      )}

      <div className="mb-6 flex h-20 items-center justify-center gap-2 rounded-lg border-2 border-primary bg-bg px-4">
        {Array.from({ length: maxLength }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'size-3 rounded-full transition-colors',
              i < value.length ? 'bg-primary' : 'bg-border-strong',
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => press(digit)}
            className="rounded-lg bg-surface-elevated py-6 text-3xl font-semibold text-text transition hover:bg-surface-high active:scale-95"
          >
            {digit}
          </button>
        ))}

        <Button variant="danger" size="xl" onClick={backspace} className="normal-case">
          <Delete className="size-6" />
          Borrar
        </Button>
        <button
          type="button"
          onClick={() => press('0')}
          className="rounded-lg bg-surface-elevated py-6 text-3xl font-semibold text-text transition hover:bg-surface-high active:scale-95"
        >
          0
        </button>
        <Button
          variant="primary"
          size="xl"
          onClick={onConfirm}
          disabled={confirmDisabled || value.length === 0}
          loading={confirmLoading}
          className="normal-case"
        >
          <Check className="size-6" />
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
