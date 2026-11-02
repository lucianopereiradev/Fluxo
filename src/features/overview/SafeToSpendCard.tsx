import { AlertTriangle, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SafeToSpend } from '@/domain/safeToSpend';
import { useFormat } from '@/features/data/hooks';
import { Modal } from '@/ui/Modal';
import { Money } from '@/ui/Money';
import { Panel } from '@/ui/primitives';

export function SafeToSpendCard({ result }: { result: SafeToSpend }) {
  const { t } = useTranslation();
  const { date } = useFormat();
  const [open, setOpen] = useState(false);
  const deficit = result.deficitCents > 0;

  return (
    <Panel className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="group block w-full p-5 text-left"
      >
        <span className="text-muted flex items-center justify-between text-sm font-medium">
          {t('overview.safeToSpend')}
          <ChevronRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        {deficit ? (
          <span className="text-negative mt-3 flex items-start gap-2">
            <AlertTriangle className="mt-1 size-5 shrink-0" aria-hidden />
            <span>
              <span className="font-display block text-2xl font-medium">
                {t('overview.deficitTitle')}
              </span>
              <span className="text-sm">
                {t('overview.deficitBody')}{' '}
                <Money cents={result.deficitCents} className="font-semibold" />
              </span>
            </span>
          </span>
        ) : (
          <>
            <span className="font-display mt-2 block text-4xl font-medium tracking-tight md:text-5xl">
              <Money cents={result.perDayCents} />
            </span>
            <span className="text-muted mt-1 block text-sm">
              {t('overview.perDay', { count: result.daysLeft })}
            </span>
          </>
        )}
        <span className="text-faint mt-3 block text-xs">{t('overview.tapForDetails')}</span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('overview.breakdownTitle')}
        description={t('overview.breakdownBody')}
      >
        <dl className="tnum divide-border divide-y text-sm">
          <Row label={t('overview.lines.balance')} cents={result.liquidBalanceCents} />
          <Row label={t('overview.lines.upcoming')} cents={-result.upcomingExpensesCents} />
          <Row label={t('overview.lines.invoices')} cents={-result.unpaidInvoicesCents} />
          <Row label={t('overview.lines.goals')} cents={-result.goalContributionsCents} />
          <Row label={t('overview.lines.available')} cents={result.availableCents} strong />
          <div className="flex justify-between py-2.5">
            <dt className="text-muted">{t('overview.lines.daysLeft')}</dt>
            <dd>{result.daysLeft}</dd>
          </div>
          <div className="flex justify-between py-2.5 font-semibold">
            <dt>{t('overview.lines.perDay')}</dt>
            <dd>
              <Money cents={result.perDayCents} />
            </dd>
          </div>
        </dl>
        {result.lines.length > 0 && (
          <>
            <h3 className="text-muted mt-5 mb-2 text-sm font-medium">
              {t('overview.lines.itemsTitle')}
            </h3>
            <ul className="divide-border border-border divide-y rounded-xl border text-sm">
              {result.lines.map((l) => (
                <li
                  key={`${l.kind}-${l.refId}-${l.date}`}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate">
                      {l.label || t(`overview.kinds.${l.kind}`)}
                    </span>
                    <span className="text-muted text-xs">
                      {t(`overview.kinds.${l.kind}`)}
                      {l.date ? ` · ${date(l.date, { day: '2-digit', month: 'short' })}` : ''}
                    </span>
                  </span>
                  <Money cents={l.amountCents} tone="expense" />
                </li>
              ))}
            </ul>
          </>
        )}
      </Modal>
    </Panel>
  );
}

function Row({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-2.5 ${strong ? 'font-semibold' : ''}`}>
      <dt className={strong ? '' : 'text-muted'}>{label}</dt>
      <dd>
        <Money cents={cents} tone={cents < 0 ? 'signed' : 'neutral'} />
      </dd>
    </div>
  );
}
