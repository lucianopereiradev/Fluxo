import type { ReactNode } from 'react';
import { cn } from './primitives';

type Art = 'ledger' | 'card' | 'target' | 'calendar' | 'chart' | 'inbox' | 'search';

/** Small line illustrations drawn with the theme's colors. */
function Illustration({ art }: { art: Art }) {
  const stroke = 'var(--c-text-faint)';
  const accent = 'var(--c-accent)';
  const common = {
    fill: 'none',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg viewBox="0 0 120 84" className="h-20 w-auto" aria-hidden>
      <ellipse cx="60" cy="76" rx="40" ry="4" fill="var(--c-surface-3)" />
      {art === 'ledger' && (
        <g {...common} stroke={stroke}>
          <rect x="30" y="10" width="60" height="58" rx="6" fill="var(--c-surface)" />
          <path d="M40 24h40M40 34h28M40 44h34M40 54h20" />
          <path d="M70 52c4-8 8-8 12-16" stroke={accent} />
          <circle cx="82" cy="36" r="2.5" fill={accent} stroke="none" />
        </g>
      )}
      {art === 'card' && (
        <g {...common} stroke={stroke}>
          <rect x="22" y="22" width="66" height="42" rx="7" fill="var(--c-surface)" />
          <rect x="34" y="14" width="66" height="42" rx="7" fill="var(--c-surface)" />
          <path d="M34 26h66" />
          <path d="M44 44h16" stroke={accent} />
        </g>
      )}
      {art === 'target' && (
        <g {...common} stroke={stroke}>
          <circle cx="60" cy="40" r="26" fill="var(--c-surface)" />
          <circle cx="60" cy="40" r="16" />
          <circle cx="60" cy="40" r="6" stroke={accent} />
          <path d="M60 40l22-22M78 14l4 4 6-1" stroke={accent} />
        </g>
      )}
      {art === 'calendar' && (
        <g {...common} stroke={stroke}>
          <rect x="28" y="14" width="64" height="54" rx="7" fill="var(--c-surface)" />
          <path d="M28 28h64M44 10v8M76 10v8" />
          <circle cx="46" cy="42" r="3" />
          <circle cx="60" cy="42" r="3" stroke={accent} />
          <circle cx="74" cy="42" r="3" />
          <circle cx="46" cy="56" r="3" />
        </g>
      )}
      {art === 'chart' && (
        <g {...common} stroke={stroke}>
          <path d="M26 64h70M26 64V14" />
          <path
            d="M34 54c10-2 14-22 24-22s12 12 22 6 10-18 14-22"
            stroke={accent}
            strokeWidth="2"
          />
        </g>
      )}
      {art === 'inbox' && (
        <g {...common} stroke={stroke}>
          <path d="M28 44l10-28h44l10 28v20H28z" fill="var(--c-surface)" />
          <path d="M28 44h18l4 8h20l4-8h18" />
          <path d="M60 22v14M54 30l6 6 6-6" stroke={accent} />
        </g>
      )}
      {art === 'search' && (
        <g {...common} stroke={stroke}>
          <circle cx="54" cy="38" r="18" fill="var(--c-surface)" />
          <path d="M67 51l14 14" stroke={accent} strokeWidth="2.4" />
          <path d="M46 38h16" />
        </g>
      )}
    </svg>
  );
}

export function EmptyState({
  art = 'ledger',
  title,
  description,
  action,
  className,
  level = 2,
}: {
  art?: Art;
  /** Heading level: 2 directly under a page title, 3 inside a titled panel. */
  level?: 2 | 3;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <Illustration art={art} />
      <Heading className="font-display mt-4 text-lg font-medium">{title}</Heading>
      {description && <p className="text-muted mt-1 max-w-sm text-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
