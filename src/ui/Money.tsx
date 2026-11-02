import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Cents } from '@/domain/money';
import { useFormat } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { cn } from './primitives';

export type MoneyTone = 'income' | 'expense' | 'neutral' | 'signed';

/**
 * Renders an amount with tabular figures. Direction is always shown with a sign and,
 * optionally, an arrow icon; color only reinforces it. Blurred in privacy mode.
 */
export function Money({
  cents,
  tone = 'neutral',
  icon = false,
  compact = false,
  className,
}: {
  cents: Cents;
  tone?: MoneyTone;
  icon?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { money } = useFormat();
  const { t } = useTranslation();
  const privacy = useUi((s) => s.privacy);

  let direction: 'in' | 'out' | null = null;
  if (tone === 'income') direction = 'in';
  else if (tone === 'expense') direction = 'out';
  else if (tone === 'signed' && cents !== 0) direction = cents > 0 ? 'in' : 'out';

  const abs = Math.abs(cents);
  const text =
    direction === 'in'
      ? `+${money(abs, { compact })}`
      : direction === 'out'
        ? `−${money(abs, { compact })}`
        : money(cents, { compact });

  return (
    <span
      className={cn(
        'money tnum inline-flex items-center gap-0.5 whitespace-nowrap',
        direction === 'in' && 'text-positive',
        direction === 'out' && tone !== 'expense' && 'text-negative',
        className,
      )}
      aria-label={privacy ? t('privacy.hiddenAmount') : undefined}
    >
      {icon && direction === 'in' && <ArrowUpRight aria-hidden className="size-[1em]" />}
      {icon && direction === 'out' && <ArrowDownRight aria-hidden className="size-[1em]" />}
      <span aria-hidden={privacy || undefined}>{text}</span>
    </span>
  );
}
