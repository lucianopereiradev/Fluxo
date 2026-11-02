import { CalendarCheck, CalendarClock, Pencil, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { availableLimit, cardOutstanding, computeInvoices, type Invoice } from '@/domain/invoices';
import type { Card } from '@/domain/types';
import { useCategoryName, useFinance, useFormat } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { Money } from '@/ui/Money';
import { Badge, Button, cn, IconButton, PageHeader, Panel, ProgressBar } from '@/ui/primitives';
import { CardEditor } from './CardEditor';
import { PayInvoiceDialog } from './PayInvoiceDialog';

const STATUS_TONE = {
  open: 'accent',
  closed: 'warning',
  paid: 'positive',
  future: 'neutral',
} as const;

export default function CardsPage() {
  const { t } = useTranslation();
  const { cards, transactions, today } = useFinance();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Card | 'new' | null>(null);
  const selectedId = params.get('card') ?? cards[0]?.id ?? null;
  const selected = cards.find((c) => c.id === selectedId) ?? cards[0];

  return (
    <>
      <PageHeader
        title={t('cards.title')}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing('new')}
          >
            {t('cards.add')}
          </Button>
        }
      />
      {cards.length === 0 ? (
        <Panel>
          <EmptyState
            art="card"
            title={t('cards.empty.title')}
            description={t('cards.empty.body')}
            action={
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setEditing('new')}
              >
                {t('cards.add')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul
            className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
            aria-label={t('cards.title')}
          >
            {cards.map((card) => {
              const outstanding = Math.max(0, cardOutstanding(card.id, transactions));
              const available = availableLimit(card, transactions);
              const active = card.id === selected?.id;
              return (
                <li key={card.id} className="min-w-64 lg:min-w-0">
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParams({ card: card.id }, { replace: true })}
                    className={cn(
                      'relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-colors',
                      active
                        ? 'border-accent bg-surface shadow-soft'
                        : 'border-border bg-surface/60 hover:bg-surface',
                    )}
                  >
                    <span
                      className="absolute inset-y-0 left-0 w-1.5"
                      style={{ background: card.color }}
                      aria-hidden
                    />
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{card.name}</span>
                      {card.archived && <Badge>{t('accounts.archived')}</Badge>}
                    </span>
                    <span className="text-muted mt-3 block text-xs">{t('cards.available')}</span>
                    <span className="font-display block text-2xl">
                      <Money cents={available} tone={available < 0 ? 'signed' : 'neutral'} />
                    </span>
                    <ProgressBar
                      className="mt-2"
                      value={outstanding}
                      max={card.limitCents}
                      tone={
                        card.limitCents > 0 && outstanding / card.limitCents > 0.9
                          ? 'negative'
                          : 'accent'
                      }
                      label={t('cards.limitUsed')}
                    />
                    <span className="text-muted mt-2 flex justify-between text-xs">
                      <span>{t('cards.closesOn', { day: card.closingDay })}</span>
                      <span>{t('cards.dueOnDay', { day: card.dueDay })}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {selected && (
            <CardDetail
              key={selected.id}
              card={selected}
              today={today}
              onEdit={() => setEditing(selected)}
            />
          )}
        </div>
      )}
      {editing && (
        <CardEditor
          card={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function CardDetail({ card, today, onEdit }: { card: Card; today: string; onEdit: () => void }) {
  const { t } = useTranslation();
  const { transactions, categoryById } = useFinance();
  const { date, month } = useFormat();
  const categoryName = useCategoryName();
  const openEditor = useUi((s) => s.openEditor);
  const invoices = useMemo(
    () => computeInvoices(card, transactions, today),
    [card, transactions, today],
  );
  const defaultMonth =
    invoices.find((i) => i.status === 'closed')?.month ??
    invoices.find((i) => i.status === 'open')?.month ??
    invoices.at(-1)?.month;
  const [monthSel, setMonthSel] = useState(defaultMonth);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const invoice = invoices.find((i) => i.month === monthSel) ?? invoices.at(-1);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, []);

  if (!invoice) return null;

  return (
    <Panel className="min-w-0">
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <h2 className="font-display text-xl font-medium">{card.name}</h2>
        <IconButton size="sm" label={t('cards.editNamed', { name: card.name })} onClick={onEdit}>
          <Pencil className="size-4" />
        </IconButton>
      </header>

      <div
        ref={stripRef}
        role="tablist"
        aria-label={t('cards.invoices')}
        className="mt-3 flex scrollbar-none gap-2 overflow-x-auto px-5 pb-1"
      >
        {invoices.map((inv) => (
          <button
            key={inv.month}
            type="button"
            role="tab"
            aria-selected={inv.month === invoice.month}
            onClick={() => setMonthSel(inv.month)}
            className={cn(
              'shrink-0 rounded-xl border px-3 py-2 text-left text-xs transition-colors',
              inv.month === invoice.month
                ? 'border-accent bg-accent-soft'
                : 'border-border hover:bg-surface-2',
            )}
          >
            <span className="block font-medium capitalize">
              {month(inv.month, { month: 'short', year: '2-digit' })}
            </span>
            <span className="tnum text-muted block">
              <Money cents={inv.totalCents} compact />
            </span>
          </button>
        ))}
      </div>

      <div role="tabpanel" className="px-5 pt-4 pb-5">
        <div className="bg-surface-2 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[invoice.status]}>
                {t(`cards.status.${invoice.status}`)}
              </Badge>
              {invoice.overdue && <Badge tone="negative">{t('cards.overdue')}</Badge>}
            </div>
            <p className="font-display mt-2 text-3xl font-medium">
              <Money cents={invoice.totalCents} />
            </p>
            <dl className="text-muted mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <CalendarCheck className="size-3.5" aria-hidden />
                <dt>{t('cards.closing')}</dt>
                <dd className="text-text">
                  {date(invoice.closingDate, { day: '2-digit', month: 'short' })}
                </dd>
              </div>
              <div className="flex items-center gap-1.5">
                <CalendarClock className="size-3.5" aria-hidden />
                <dt>{t('cards.due')}</dt>
                <dd className="text-text">
                  {date(invoice.dueDate, { day: '2-digit', month: 'short' })}
                </dd>
              </div>
            </dl>
          </div>
          <div className="text-right text-sm">
            {invoice.paidCents > 0 && (
              <p className="text-muted">
                {t('cards.paidAmount')} <Money cents={invoice.paidCents} />
              </p>
            )}
            {invoice.remainingCents > 0 && invoice.status !== 'future' && (
              <p className="text-muted">
                {t('cards.remaining')}{' '}
                <Money cents={invoice.remainingCents} className="text-text font-medium" />
              </p>
            )}
            {invoice.remainingCents > 0 && (
              <Button variant="primary" className="mt-2" onClick={() => setPaying(invoice)}>
                {t('cards.pay')}
              </Button>
            )}
          </div>
        </div>

        {invoice.transactions.length === 0 && invoice.payments.length === 0 ? (
          <EmptyState art="card" title={t('cards.emptyInvoice')} className="py-8" />
        ) : (
          <ul className="divide-border mt-3 divide-y">
            {invoice.transactions.map((tx) => {
              const cat = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openEditor(tx.id)}
                    className="flex w-full items-center gap-3 py-3 text-left"
                  >
                    <CategoryIcon category={cat} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {tx.description || categoryName(cat)}
                      </span>
                      <span className="text-muted flex items-center gap-1.5 text-xs">
                        {date(tx.date, { day: '2-digit', month: 'short' })}
                        {tx.installmentIndex && (
                          <Badge>
                            {t('transactions.installmentShort', {
                              index: tx.installmentIndex,
                              count: tx.installmentCount,
                            })}
                          </Badge>
                        )}
                      </span>
                    </span>
                    <Money
                      cents={tx.amountCents}
                      tone={tx.type === 'income' ? 'income' : 'expense'}
                      className="text-sm"
                    />
                  </button>
                </li>
              );
            })}
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <CategoryIcon transfer />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{t('cards.payment')}</span>
                  <span className="text-muted text-xs">
                    {date(p.date, { day: '2-digit', month: 'short' })}
                  </span>
                </span>
                <Money cents={p.amountCents} tone="income" className="text-sm" />
              </li>
            ))}
          </ul>
        )}
      </div>
      {paying && <PayInvoiceDialog card={card} invoice={paying} onClose={() => setPaying(null)} />}
    </Panel>
  );
}
