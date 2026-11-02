import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CreditCard,
  FlaskConical,
  Plus,
} from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { totalBalance } from '@/domain/balances';
import { budgetStatus } from '@/domain/budgets';
import { addDays, monthOf } from '@/domain/dates';
import { forecastBalance } from '@/domain/forecast';
import { computeInvoices } from '@/domain/invoices';
import { safeToSpend } from '@/domain/safeToSpend';
import { useCategoryName, useFinance, useFormat } from '@/features/data/hooks';
import { enterDemo } from '@/features/demo/demoMode';
import { useUi } from '@/stores/ui';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { Money } from '@/ui/Money';
import {
  Badge,
  Button,
  buttonClasses,
  PageHeader,
  Panel,
  PanelHeader,
  ProgressBar,
} from '@/ui/primitives';
import { Sparkline } from '@/ui/Sparkline';
import { SafeToSpendCard } from './SafeToSpendCard';

export default function OverviewPage() {
  const { t } = useTranslation();
  const data = useFinance();
  const { date, month } = useFormat();
  const categoryName = useCategoryName();
  const openEditor = useUi((s) => s.openEditor);
  const { today, accounts, cards, transactions, recurrences, goals, budgets, categories } = data;

  const computed = useMemo(() => {
    const balance = totalBalance(accounts, transactions, today);
    const sts = safeToSpend({ today, accounts, cards, transactions, recurrences, goals });
    const forecast = forecastBalance({
      today,
      accounts,
      cards,
      transactions,
      recurrences,
      days: 90,
    });
    const upcoming = forecast.events.filter((e) => e.date <= addDays(today, 30)).slice(0, 6);
    const invoices = cards
      .map((card) => {
        const list = computeInvoices(card, transactions, today);
        const open = list.find((i) => i.status === 'open');
        const closed = list.filter((i) => i.status === 'closed');
        return { card, open, closed };
      })
      .filter((x) => x.open || x.closed.length);
    const thisMonth = monthOf(today);
    const spending = new Map<string | null, number>();
    for (const tx of transactions) {
      if (tx.type !== 'expense' || monthOf(tx.date) !== thisMonth || tx.date > today) continue;
      const cat = tx.categoryId ? data.categoryById.get(tx.categoryId) : undefined;
      const rootId = cat?.parentId ?? cat?.id ?? null;
      spending.set(rootId, (spending.get(rootId) ?? 0) + tx.amountCents);
    }
    const spendingList = [...spending.entries()].sort((a, b) => b[1] - a[1]);
    const spendingTotal = spendingList.reduce((s, [, v]) => s + v, 0);
    const alerts = budgets
      .map((b) => budgetStatus(b, categories, transactions, thisMonth))
      .filter((s) => s.level !== 'ok')
      .sort((a, b) => b.ratio - a.ratio);
    return { balance, sts, forecast, upcoming, invoices, spendingList, spendingTotal, alerts };
  }, [
    today,
    accounts,
    cards,
    transactions,
    recurrences,
    goals,
    budgets,
    categories,
    data.categoryById,
  ]);

  if (data.ready && accounts.length === 0 && cards.length === 0) {
    return (
      <>
        <PageHeader title={t('overview.title')} />
        <Panel>
          <EmptyState
            art="ledger"
            title={t('overview.empty.title')}
            description={t('overview.empty.body')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link to="/app/accounts?new=1" className={buttonClasses('primary')}>
                  <Plus className="size-4" aria-hidden />
                  {t('accounts.add')}
                </Link>
                <Button icon={<FlaskConical className="size-4" />} onClick={() => void enterDemo()}>
                  {t('landing.tryDemo')}
                </Button>
              </div>
            }
          />
        </Panel>
      </>
    );
  }

  const { balance, sts, forecast, upcoming, invoices, spendingList, spendingTotal, alerts } =
    computed;

  return (
    <>
      <PageHeader
        title={t('overview.title')}
        subtitle={date(today, { weekday: 'long', day: 'numeric', month: 'long' })}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openEditor()}>
            {t('transactions.new')}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <SafeToSpendCard result={sts} />
        <Panel className="p-5">
          <p className="text-muted text-sm font-medium">{t('overview.totalBalance')}</p>
          <p className="font-display mt-2 text-4xl font-medium tracking-tight">
            <Money cents={balance} />
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            {accounts.slice(0, 4).map((a) => (
              <li key={a.id} className="flex justify-between gap-2">
                <span className="text-muted truncate">{a.name}</span>
                <Money cents={accountBalanceOf(a.id)} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {alerts.length > 0 && (
        <Panel className="border-warning/40 mt-4 p-4" aria-labelledby="budget-alerts">
          <h2
            id="budget-alerts"
            className="text-warning mb-3 flex items-center gap-2 text-sm font-medium"
          >
            <AlertTriangle className="size-4" aria-hidden />
            {t('overview.budgetAlerts')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {alerts.slice(0, 4).map((s) => {
              const cat = data.categoryById.get(s.budget.categoryId);
              return (
                <li key={s.budget.id} className="flex items-center gap-3">
                  <CategoryIcon category={cat} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate">{categoryName(cat)}</span>
                      <Badge tone={s.level === 'over' ? 'negative' : 'warning'}>
                        {s.level === 'over' ? t('budgets.over') : t('budgets.near')}
                        {` ${Math.round(s.ratio * 100)}%`}
                      </Badge>
                    </div>
                    <ProgressBar
                      className="mt-1.5"
                      value={s.spentCents}
                      max={s.limitCents + s.carriedCents}
                      tone={s.level === 'over' ? 'negative' : 'warning'}
                      label={categoryName(cat)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" aria-labelledby="forecast-title">
          <PanelHeader
            id="forecast-title"
            title={t('overview.forecast')}
            action={
              <Link
                to="/app/reports#forecast"
                className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
              >
                {t('common.seeAll')}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <div className="px-5 pb-5">
            <Sparkline
              values={forecast.days.map((d) => d.balanceCents)}
              label={t('overview.forecastLabel')}
            />
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-muted">
                {t('overview.in90days')}{' '}
                <Money cents={forecast.endBalanceCents} className="text-text font-medium" />
              </span>
              <span className="text-muted">
                {t('overview.lowest')}{' '}
                <Money cents={forecast.minBalanceCents} className="text-text font-medium" />
                {` · ${date(forecast.minBalanceDate, { day: '2-digit', month: 'short' })}`}
              </span>
              {forecast.firstNegativeDate && (
                <Badge tone="negative">
                  <AlertTriangle className="size-3" aria-hidden />
                  {t('overview.negativeOn', {
                    date: date(forecast.firstNegativeDate, { day: '2-digit', month: 'short' }),
                  })}
                </Badge>
              )}
            </div>
          </div>
        </Panel>

        <Panel aria-labelledby="upcoming-title">
          <PanelHeader id="upcoming-title" title={t('overview.upcoming')} />
          {upcoming.length === 0 ? (
            <EmptyState
              level={3}
              art="calendar"
              title={t('overview.noUpcoming')}
              className="py-6"
            />
          ) : (
            <ul className="divide-border divide-y px-2 pb-2">
              {upcoming.map((e) => (
                <li key={`${e.refId}-${e.date}`} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="bg-surface-2 text-muted grid size-9 shrink-0 place-items-center rounded-xl">
                    {e.kind === 'invoice' ? (
                      <CreditCard className="size-4" aria-hidden />
                    ) : (
                      <CalendarClock className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {e.kind === 'invoice'
                        ? t('overview.invoiceOf', { card: e.label })
                        : e.label || t('overview.kinds.recurring')}
                    </span>
                    <span className="text-muted text-xs">
                      {date(e.date, { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                  </span>
                  <Money cents={e.amountCents} tone="signed" className="text-sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel aria-labelledby="spending-title">
          <PanelHeader
            id="spending-title"
            title={t('overview.spendingByCategory', {
              month: month(monthOf(today), { month: 'long' }),
            })}
          />
          {spendingList.length === 0 ? (
            <EmptyState level={3} art="chart" title={t('overview.noSpending')} className="py-6" />
          ) : (
            <ul className="space-y-3 px-5 pb-5">
              {spendingList.slice(0, 7).map(([catId, cents]) => {
                const cat = catId ? data.categoryById.get(catId) : undefined;
                return (
                  <li key={catId ?? 'none'} className="flex items-center gap-3">
                    <CategoryIcon category={cat} className="size-8" />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="truncate">{categoryName(cat)}</span>
                        <Money cents={cents} />
                      </div>
                      <div
                        className="bg-surface-3 mt-1 h-1.5 overflow-hidden rounded-full"
                        aria-hidden
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(cents / spendingTotal) * 100}%`,
                            background: cat?.color ?? 'var(--c-text-faint)',
                          }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel aria-labelledby="invoices-title">
          <PanelHeader
            id="invoices-title"
            title={t('overview.openInvoices')}
            action={
              <Link
                to="/app/cards"
                className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
              >
                {t('nav.cards')}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {invoices.length === 0 ? (
            <EmptyState level={3} art="card" title={t('overview.noInvoices')} className="py-6" />
          ) : (
            <ul className="divide-border divide-y px-2 pb-2">
              {invoices.flatMap(({ card, open, closed }) =>
                [...closed, ...(open ? [open] : [])].map((inv) => (
                  <li
                    key={`${card.id}-${inv.month}`}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: card.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{card.name}</span>
                      <span className="text-muted text-xs">
                        {t(`cards.status.${inv.status}`)} ·{' '}
                        {t('cards.dueOn', {
                          date: date(inv.dueDate, { day: '2-digit', month: 'short' }),
                        })}
                      </span>
                    </span>
                    {inv.overdue && <Badge tone="negative">{t('cards.overdue')}</Badge>}
                    <Money cents={inv.status === 'closed' ? inv.remainingCents : inv.totalCents} />
                  </li>
                )),
              )}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );

  function accountBalanceOf(id: string) {
    return totalBalance(accounts, transactions, today, (a) => a.id === id);
  }
}
