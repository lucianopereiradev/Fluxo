import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';

export const cn = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-strong shadow-[inset_0_-1px_0_rgb(0_0_0/15%)]',
  secondary:
    'bg-surface text-text border border-border hover:border-border-strong hover:bg-surface-2',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-negative text-white hover:opacity-90 dark:text-bg',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

const BUTTON_BASE =
  'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-[background-color,border-color,transform,opacity] duration-150 select-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

/** Button styles for elements that are not <button>, such as router links. */
export function buttonClasses(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'text-muted hover:bg-surface-2 hover:text-text inline-flex shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40',
        size === 'sm' ? 'size-8' : 'size-10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Panel({
  className,
  children,
  as: Tag = 'section',
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: 'section' | 'div' | 'article' | 'li' }) {
  return (
    <Tag
      className={cn('border-border bg-surface shadow-soft rounded-2xl border', className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  title,
  action,
  id,
}: {
  title: ReactNode;
  action?: ReactNode;
  id?: string;
}) {
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
      <h2 id={id} className="text-muted text-sm font-medium tracking-wide uppercase">
        {title}
      </h2>
      {action}
    </header>
  );
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: 'neutral' | 'accent' | 'positive' | 'negative' | 'warning';
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted',
    accent: 'bg-accent-soft text-accent-strong',
    positive: 'bg-positive-soft text-positive',
    negative: 'bg-negative-soft text-negative',
    warning: 'bg-warning-soft text-warning',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-3xl leading-tight font-medium tracking-tight md:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ProgressBar({
  value,
  max = 1,
  tone = 'accent',
  label,
  className,
}: {
  value: number;
  max?: number;
  tone?: 'accent' | 'positive' | 'warning' | 'negative';
  label: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tones = {
    accent: 'bg-accent',
    positive: 'bg-positive',
    warning: 'bg-warning',
    negative: 'bg-negative',
  } as const;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn('bg-surface-3 h-2 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500 ease-out', tones[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="border-border bg-surface-2 text-muted inline-flex min-w-6 items-center justify-center rounded-md border px-1.5 py-0.5 font-sans text-xs">
      {children}
    </kbd>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-surface-2 animate-pulse rounded-xl', className)} aria-hidden />;
}
