import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  neutral: 'bg-surface-high text-muted border-border',
  primary: 'bg-primary/10 text-primary border-primary/40',
  secondary: 'bg-secondary/10 text-secondary border-secondary/40',
  warning: 'bg-warning/10 text-warning border-warning/40',
  danger: 'bg-danger/10 text-danger border-danger/40',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof TONE_CLASSES;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-1 font-mono text-xs font-semibold uppercase tracking-wide',
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}
