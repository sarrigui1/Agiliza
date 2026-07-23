import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANT_CLASSES = {
  primary: 'bg-primary text-primary-foreground glow-primary hover:brightness-110',
  secondary:
    'bg-transparent text-secondary border border-secondary/60 hover:bg-secondary/10',
  danger: 'bg-danger text-danger-foreground hover:brightness-110',
  ghost: 'bg-surface-high text-text hover:bg-border-strong border border-border',
  outline: 'bg-transparent text-text border border-border hover:bg-surface-high',
} as const;

const SIZE_CLASSES = {
  default: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-4 text-base',
  xl: 'px-8 py-6 text-lg',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-mono font-semibold uppercase tracking-wide transition',
          'disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale',
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
