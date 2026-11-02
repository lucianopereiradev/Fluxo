import { cn } from './primitives';

/** Three ribbons converging into one: money flowing in, organized. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn('size-8', className)}>
      <rect width="32" height="32" rx="9" fill="var(--c-accent)" />
      <path
        d="M7 10.5c6 0 7.5 5.5 13 5.5h5"
        fill="none"
        stroke="var(--c-on-accent)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M7 16h18"
        fill="none"
        stroke="var(--c-on-accent)"
        strokeOpacity=".7"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M7 21.5c6 0 7.5-5.5 13-5.5"
        fill="none"
        stroke="var(--c-on-accent)"
        strokeOpacity=".45"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight">{'Fluxo'}</span>
    </span>
  );
}
