import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  List,
  Plus,
  Repeat,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { monthEvents, monthGrid } from '@/domain/calendar';
import { addMonthsToMonth, dayOf, monthOf, type LocalDate } from '@/domain/dates';
import { nextOccurrence } from '@/domain/recurrences';
import type { Recurrence } from '@/domain/types';
import { useCategoryName, useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { Segmented } from '@/ui/Field';
import { Money } from '@/ui/Money';
import { Badge, Button, cn, IconButton, PageHeader, Panel } from '@/ui/primitives';
import { RecurrenceEditor } from './RecurrenceEditor';

export default function RecurringPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [editing, setEditing] = useState<Recurrence | 'new' | null>(null);
  return (
    <>
      <PageHeader
        title={t('recurring.title')}
        subtitle={t('recurring.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing('new')}
          >
            {t('recurring.add')}
          </Button>
        }
      />
      <Segmented
        className="mb-4 max-w-xs"
        label={t('recurring.view')}
        value={view}
        onChange={setView}
        options={[
          {
            value: 'list',
            label: t('recurring.list'),
            icon: <List className="size-4" aria-hidden />,
          },
          {
            value: 'calendar',
            label: t('recurring.calendar'),
            icon: <CalendarDays className="size-4" aria-hidden />,
          },
        ]}
      />
      {view === 'list' ? <RecurrenceList onEdit={setEditing} /> : <BillsCalendar />}
      {editing && (
        <RecurrenceEditor
          recurrence={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function RecurrenceList({ onEdit }: { onEdit: (r: Recurrence | 'new') => void }) {
  const { t } = useTranslation();
  const { recurrences, today, categoryById, accountById, cardById } = useFinance();
  const { date } = useFormat();
  const categoryName = useCategoryName();
  const rows = useMemo(
    () =>
      recurrences
        .map((r) => ({ r, next: nextOccurrence(r, today) }))
        .sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999')),
    [recurrences, today],
  );
  const monthlyOut = recurrences
    .filter(
      (r) => r.active && r.type === 'expense' && r.frequency === 'monthly' && r.interval === 1,
    )
    .reduce((s, r) => s + r.amountCents, 0);
  const monthlyIn = recurrences
    .filter((r) => r.active && r.type === 'income' && r.frequency === 'monthly' && r.interval === 1)
    .reduce((s, r) => s + r.amountCents, 0);

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState
          art="calendar"
          title={t('recurring.empty.title')}
          description={t('recurring.empty.body')}
          action={
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => onEdit('new')}
            >
              {t('recurring.add')}
            </Button>
          }
        />
      </Panel>
    );
  }

  const frequencyText = (r: Recurrence) =>
    r.frequency === 'monthly'
      ? t('recurring.everyMonthOn', { count: r.interval, day: r.dayOfMonth ?? dayOf(r.startDate) })
      : r.frequency === 'weekly'
        ? t('recurring.everyWeek', { count: r.interval })
        : t('recurring.everyYear', { count: r.interval });

  return (
    <>
      <div className="tnum text-muted mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          {t('recurring.monthlyIn')} <Money cents={monthlyIn} tone="income" />
        </span>
        <span>
          {t('recurring.monthlyOut')} <Money cents={monthlyOut} tone="expense" />
        </span>
      </div>
      <Panel>
        <ul className="divide-border divide-y">
          {rows.map(({ r, next }) => {
            const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined;
            const where = r.accountId
              ? accountById.get(r.accountId)?.name
              : r.cardId
                ? cardById.get(r.cardId)?.name
                : '';
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onEdit(r)}
                  className={cn(
                    'hover:bg-surface-2/60 flex w-full items-center gap-3 px-4 py-3 text-left',
                    !r.active && 'opacity-60',
                  )}
                >
                  <CategoryIcon category={cat} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {r.description || categoryName(cat)}
                    </span>
                    <span className="text-muted flex flex-wrap items-center gap-x-1.5 text-xs">
                      <Repeat className="size-3" aria-hidden />
                      {frequencyText(r)}
                      {where ? ` · ${where}` : ''}
                      {!r.active && <Badge>{t('recurring.paused')}</Badge>}
                    </span>
                  </span>
                  <span className="text-right">
                    <Money
                      cents={r.amountCents}
                      tone={r.type === 'income' ? 'income' : 'expense'}
                      className="text-sm font-medium"
                    />
                    {next && (
                      <span className="text-muted block text-xs">
                        {t('recurring.next', {
                          date: date(next, { day: '2-digit', month: 'short' }),
                        })}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}

function BillsCalendar() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { recurrences, cards, transactions, today } = useFinance();
  const { month: formatMonth, date } = useFormat();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<LocalDate | null>(
    monthOf(today) === month ? today : null,
  );
  const weekStartsOn = 0;
  const weeks = useMemo(() => monthGrid(month, weekStartsOn), [month, weekStartsOn]);
  const events = useMemo(
    () => monthEvents({ month, recurrences, cards, transactions, today }),
    [month, recurrences, cards, transactions, today],
  );
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 10, 1 + ((i + weekStartsOn) % 7))),
    ),
  );
  const totals = [...events.values()]
    .flat()
    .reduce(
      (s, e) =>
        e.direction === 'in'
          ? { ...s, in: s.in + e.amountCents }
          : { ...s, out: s.out + e.amountCents },
      { in: 0, out: 0 },
    );
  const dayEvents = selected ? (events.get(selected) ?? []) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Panel className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center">
            <IconButton
              label={t('common.previousMonth')}
              onClick={() => setMonth(addMonthsToMonth(month, -1))}
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <h2 className="min-w-40 text-center font-medium capitalize" aria-live="polite">
              {formatMonth(month)}
            </h2>
            <IconButton
              label={t('common.nextMonth')}
              onClick={() => setMonth(addMonthsToMonth(month, 1))}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
          <p className="tnum flex gap-4 text-sm">
            <Money cents={totals.in} tone="income" icon />
            <Money cents={totals.out} tone="expense" icon />
          </p>
        </div>
        <table
          className="w-full table-fixed border-separate border-spacing-1"
          aria-label={formatMonth(month)}
        >
          <thead>
            <tr>
              {weekdayNames.map((d) => (
                <th key={d} scope="col" className="text-muted pb-1 text-xs font-medium capitalize">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week, wi) => (
              <tr key={wi}>
                {week.map((day, di) => {
                  if (!day) return <td key={di} />;
                  const list = events.get(day) ?? [];
                  return (
                    <td key={day} className="align-top">
                      <button
                        type="button"
                        onClick={() => setSelected(day)}
                        aria-pressed={selected === day}
                        aria-label={`${date(day, { day: 'numeric', month: 'long' })}${list.length ? ` · ${t('recurring.itemsCount', { count: list.length })}` : ''}`}
                        className={cn(
                          'flex h-16 w-full flex-col items-start rounded-lg border p-1.5 text-left text-xs transition-colors md:h-20',
                          selected === day
                            ? 'border-accent bg-accent-soft'
                            : 'hover:bg-surface-2 border-transparent',
                          day === today && 'ring-accent ring-1',
                        )}
                      >
                        <span className={cn('font-medium', day < today && 'text-faint')}>
                          {dayOf(day)}
                        </span>
                        {list.length > 0 && (
                          <span className="mt-auto flex gap-0.5" aria-hidden>
                            {list.slice(0, 4).map((e, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'size-1.5 rounded-full',
                                  e.direction === 'in' ? 'bg-positive' : 'bg-accent',
                                  e.done && 'opacity-40',
                                )}
                              />
                            ))}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel className="p-4" aria-live="polite">
        <h3 className="font-medium capitalize">
          {selected
            ? date(selected, { weekday: 'long', day: 'numeric', month: 'long' })
            : t('recurring.pickDay')}
        </h3>
        {selected && dayEvents.length === 0 && (
          <p className="text-muted mt-3 text-sm">{t('recurring.nothingDue')}</p>
        )}
        <ul className="mt-3 space-y-2">
          {dayEvents.map((e) => (
            <li
              key={`${e.refId}-${e.kind}`}
              className="bg-surface-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm"
            >
              <span className="bg-surface text-muted grid size-8 place-items-center rounded-lg">
                {e.kind === 'invoice' ? (
                  <CreditCard className="size-4" aria-hidden />
                ) : (
                  <Repeat className="size-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {e.kind === 'invoice'
                    ? t('overview.invoiceOf', { card: e.label })
                    : e.label ||
                      t(`overview.kinds.${e.kind === 'recurrence' ? 'recurring' : 'scheduled'}`)}
                </span>
                {e.done && (
                  <span className="text-positive inline-flex items-center gap-1 text-xs">
                    <Check className="size-3" aria-hidden />
                    {e.kind === 'invoice' ? t('cards.status.paid') : t('recurring.recorded')}
                  </span>
                )}
              </span>
              <Money cents={e.amountCents} tone={e.direction === 'in' ? 'income' : 'expense'} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
