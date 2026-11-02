import {
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { softDelete } from '@/db/repo';
import { addMonthsToMonth, endOfMonth, monthOf, type LocalDate } from '@/domain/dates';
import { formatAmountInput } from '@/domain/money';
import { matchesQuery } from '@/domain/search';
import type { Transaction, TransactionType } from '@/domain/types';
import { bulkAddTag, bulkUpdateTransactions } from '@/features/data/actions';
import { useCategoryName, useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Input, Select } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Money } from '@/ui/Money';
import { Badge, Button, cn, IconButton, PageHeader, Panel } from '@/ui/primitives';
import { CategoryOptions, SourceOptions } from './options';

type Period =
  | { kind: 'month'; month: string }
  | { kind: 'range'; from: LocalDate; to: LocalDate }
  | { kind: 'all' };

interface Filters {
  source: string;
  categoryId: string;
  type: '' | TransactionType;
  tag: string;
}

const NO_FILTERS: Filters = { source: '', categoryId: '', type: '', tag: '' };

export default function TransactionsPage() {
  const { t } = useTranslation();
  const data = useFinance();
  const { date, month: formatMonthLabel } = useFormat();
  const locale = useLocale();
  const categoryName = useCategoryName();
  const openEditor = useUi((s) => s.openEditor);
  const searchRequest = useUi((s) => s.searchRequest);
  const [params] = useSearchParams();
  const searchRef = useRef<HTMLInputElement>(null);

  const [period, setPeriod] = useState<Period>({ kind: 'month', month: monthOf(data.today) });
  const [filters, setFilters] = useState<Filters>(() => ({
    ...NO_FILTERS,
    source: params.get('source') ?? '',
  }));
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bulk, setBulk] = useState<null | 'category' | 'tag' | 'delete'>(null);

  useEffect(() => {
    if (searchRequest > 0) searchRef.current?.focus();
  }, [searchRequest]);

  const describe = (tx: Transaction) => {
    const cat = tx.categoryId ? data.categoryById.get(tx.categoryId) : undefined;
    const from = tx.accountId
      ? data.accountById.get(tx.accountId)?.name
      : tx.cardId
        ? data.cardById.get(tx.cardId)?.name
        : '';
    const to = tx.toAccountId
      ? data.accountById.get(tx.toAccountId)?.name
      : tx.toCardId
        ? data.cardById.get(tx.toCardId)?.name
        : '';
    return { cat, from: from ?? '', to: to ?? '' };
  };

  const visible = useMemo(() => {
    const { from, to } =
      period.kind === 'month'
        ? { from: `${period.month}-01`, to: endOfMonth(`${period.month}-01`) }
        : period.kind === 'range'
          ? period
          : { from: '0000-01-01', to: '9999-12-31' };
    return data.transactions.filter((tx) => {
      if (tx.date < from || tx.date > to) return false;
      if (filters.type && tx.type !== filters.type) return false;
      if (filters.source) {
        const id = filters.source.split(':')[1];
        if (![tx.accountId, tx.cardId, tx.toAccountId, tx.toCardId].includes(id ?? null))
          return false;
      }
      if (filters.categoryId) {
        const cat = tx.categoryId ? data.categoryById.get(tx.categoryId) : undefined;
        if (tx.categoryId !== filters.categoryId && cat?.parentId !== filters.categoryId)
          return false;
      }
      if (filters.tag && !tx.tags.includes(filters.tag)) return false;
      if (query) {
        const d = describe(tx);
        const hay = [
          tx.description,
          tx.notes,
          tx.tags.join(' '),
          categoryName(d.cat),
          d.from,
          d.to,
          formatAmountInput(tx.amountCents, locale),
        ].join(' ');
        if (!matchesQuery(hay, query)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.transactions, period, filters, query, locale]);

  const groups = useMemo(() => {
    const map = new Map<LocalDate, Transaction[]>();
    for (const tx of visible) {
      const list = map.get(tx.date);
      if (list) list.push(tx);
      else map.set(tx.date, [tx]);
    }
    return [...map.entries()];
  }, [visible]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of visible) {
      if (tx.type === 'income') income += tx.amountCents;
      if (tx.type === 'expense') expense += tx.amountCents;
    }
    return { income, expense };
  }, [visible]);

  const allTags = useMemo(
    () => [...new Set(data.transactions.flatMap((tx) => tx.tags))].sort(),
    [data.transactions],
  );
  const activeFilterCount =
    Object.values(filters).filter(Boolean).length + (period.kind === 'range' ? 1 : 0);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = async () => {
    const { transactionsToCsv } = await import('@/domain/csvExport');
    const csv = transactionsToCsv(visible, {
      category: (tx) => categoryName(describe(tx).cat),
      source: (tx) => describe(tx).from,
      target: (tx) => describe(tx).to,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fluxo-transactions-${data.today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title={t('transactions.title')}
        actions={
          <>
            <Button
              icon={<Download className="size-4" />}
              onClick={() => void exportCsv()}
              disabled={visible.length === 0}
            >
              {t('transactions.exportCsv')}
            </Button>
            <Button
              icon={<ArrowLeftRight className="size-4" />}
              onClick={() => openEditor(undefined, 'transfer')}
            >
              {t('transactions.newTransfer')}
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => openEditor()}
            >
              {t('transactions.new')}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {period.kind === 'month' ? (
          <div className="border-border bg-surface flex items-center rounded-xl border">
            <IconButton
              label={t('common.previousMonth')}
              onClick={() =>
                setPeriod({ kind: 'month', month: addMonthsToMonth(period.month, -1) })
              }
            >
              <ChevronLeft className="size-4" />
            </IconButton>
            <span className="cap-first min-w-36 text-center text-sm font-medium" aria-live="polite">
              {formatMonthLabel(period.month)}
            </span>
            <IconButton
              label={t('common.nextMonth')}
              onClick={() => setPeriod({ kind: 'month', month: addMonthsToMonth(period.month, 1) })}
            >
              <ChevronRight className="size-4" />
            </IconButton>
          </div>
        ) : (
          <Badge tone="accent" className="h-10 rounded-xl px-3 text-sm">
            {period.kind === 'all'
              ? t('transactions.allTime')
              : `${date(period.from)} – ${date(period.to)}`}
            <button
              type="button"
              aria-label={t('transactions.backToMonth')}
              onClick={() => setPeriod({ kind: 'month', month: monthOf(data.today) })}
            >
              <X className="size-3.5" />
            </button>
          </Badge>
        )}
        <div className="relative min-w-48 flex-1">
          <Search
            className="text-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('transactions.searchPlaceholder')}
            aria-label={t('transactions.search')}
            className="pl-9"
          />
        </div>
        <Button
          icon={<Filter className="size-4" />}
          onClick={() => setFiltersOpen(true)}
          aria-haspopup="dialog"
        >
          {t('transactions.filters')}
          {activeFilterCount > 0 && <Badge tone="accent">{activeFilterCount}</Badge>}
        </Button>
      </div>

      <div
        className="tnum text-muted mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm"
        aria-live="polite"
      >
        <span>{t('transactions.count', { count: visible.length })}</span>
        <span>
          {t('transactions.types.income')}: <Money cents={totals.income} tone="income" />
        </span>
        <span>
          {t('transactions.types.expense')}: <Money cents={totals.expense} tone="expense" />
        </span>
      </div>

      {selected.size > 0 && (
        <div
          className="border-accent/40 bg-accent-soft sticky top-14 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border p-2 pl-4 text-sm md:top-2"
          role="region"
          aria-label={t('transactions.bulk.title')}
        >
          <span className="mr-auto font-medium">
            {t('transactions.bulk.selected', { count: selected.size })}
          </span>
          <Button size="sm" onClick={() => setBulk('category')}>
            {t('transactions.bulk.category')}
          </Button>
          <Button size="sm" icon={<Tag className="size-3.5" />} onClick={() => setBulk('tag')}>
            {t('transactions.bulk.tag')}
          </Button>
          <Button
            size="sm"
            variant="danger"
            icon={<Trash2 className="size-3.5" />}
            onClick={() => setBulk('delete')}
          >
            {t('common.delete')}
          </Button>
          <IconButton
            size="sm"
            label={t('transactions.bulk.clear')}
            onClick={() => setSelected(new Set())}
          >
            <X className="size-4" />
          </IconButton>
        </div>
      )}

      {groups.length === 0 ? (
        <Panel>
          <EmptyState
            art={query || activeFilterCount ? 'search' : 'ledger'}
            title={
              query || activeFilterCount
                ? t('transactions.noResults')
                : t('transactions.empty.title')
            }
            description={query || activeFilterCount ? undefined : t('transactions.empty.body')}
            action={
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => openEditor()}
              >
                {t('transactions.new')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groups.map(([day, txs]) => {
            const net = txs.reduce(
              (s, tx) =>
                s +
                (tx.type === 'income'
                  ? tx.amountCents
                  : tx.type === 'expense'
                    ? -tx.amountCents
                    : 0),
              0,
            );
            const allSelected = txs.every((tx) => selected.has(tx.id));
            return (
              <Panel key={day} as="section" aria-label={date(day, { dateStyle: 'full' })}>
                <header className="border-border flex items-center gap-3 border-b px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--c-accent)]"
                    checked={allSelected}
                    onChange={() =>
                      setSelected((s) => {
                        const next = new Set(s);
                        for (const tx of txs) {
                          if (allSelected) next.delete(tx.id);
                          else next.add(tx.id);
                        }
                        return next;
                      })
                    }
                    aria-label={t('transactions.selectDay', { date: date(day) })}
                  />
                  <h2 className="cap-first flex-1 text-sm font-medium">
                    {day === data.today
                      ? t('common.today')
                      : date(day, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <Money cents={net} tone="signed" className="text-muted text-sm" />
                </header>
                <ul className="divide-border divide-y">
                  {txs.map((tx) => {
                    const d = describe(tx);
                    const isTransfer = tx.type === 'transfer';
                    return (
                      <li
                        key={tx.id}
                        className={cn(
                          'group hover:bg-surface-2/60 flex items-center gap-3 px-4 py-3 transition-colors',
                          selected.has(tx.id) && 'bg-accent-soft/50',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-4 accent-[var(--c-accent)]"
                          checked={selected.has(tx.id)}
                          onChange={() => toggle(tx.id)}
                          aria-label={t('transactions.select', {
                            name: tx.description || categoryName(d.cat),
                          })}
                        />
                        <button
                          type="button"
                          onClick={() => openEditor(tx.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <CategoryIcon category={d.cat} transfer={isTransfer} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {tx.description ||
                                (isTransfer
                                  ? t('transactions.types.transfer')
                                  : categoryName(d.cat))}
                            </span>
                            <span className="text-muted flex flex-wrap items-center gap-x-1.5 text-xs">
                              <span>
                                {isTransfer
                                  ? `${d.from} → ${d.to}`
                                  : `${categoryName(d.cat)} · ${d.from}`}
                              </span>
                              {tx.installmentIndex && (
                                <Badge>
                                  {t('transactions.installmentShort', {
                                    index: tx.installmentIndex,
                                    count: tx.installmentCount,
                                  })}
                                </Badge>
                              )}
                              {tx.recurrenceId && <Badge>{t('recurring.badge')}</Badge>}
                              {tx.date > data.today && (
                                <Badge tone="accent">{t('transactions.scheduled')}</Badge>
                              )}
                              {tx.tags.map((tag) => (
                                <span key={tag} className="text-faint">{`#${tag}`}</span>
                              ))}
                            </span>
                          </span>
                          <Money
                            cents={tx.amountCents}
                            tone={
                              tx.type === 'income'
                                ? 'income'
                                : tx.type === 'expense'
                                  ? 'expense'
                                  : 'neutral'
                            }
                            className="text-sm font-medium"
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('transactions.filters')}
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                setFilters(NO_FILTERS);
                setPeriod({ kind: 'month', month: monthOf(data.today) });
              }}
            >
              {t('transactions.clearFilters')}
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              {t('common.done')}
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label={t('transactions.period')}>
            <Select
              value={period.kind}
              onChange={(e) => {
                const kind = e.target.value as Period['kind'];
                if (kind === 'month') setPeriod({ kind, month: monthOf(data.today) });
                else if (kind === 'all') setPeriod({ kind });
                else setPeriod({ kind, from: `${monthOf(data.today)}-01`, to: data.today });
              }}
            >
              <option value="month">{t('transactions.periods.month')}</option>
              <option value="range">{t('transactions.periods.range')}</option>
              <option value="all">{t('transactions.periods.all')}</option>
            </Select>
          </Field>
          {period.kind === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('transactions.fromDate')}>
                <Input
                  type="date"
                  value={period.from}
                  onChange={(e) => setPeriod({ ...period, from: e.target.value })}
                />
              </Field>
              <Field label={t('transactions.toDate')}>
                <Input
                  type="date"
                  value={period.to}
                  onChange={(e) => setPeriod({ ...period, to: e.target.value })}
                />
              </Field>
            </div>
          )}
          <Field label={t('transactions.accountOrCard')}>
            <Select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              <SourceOptions />
            </Select>
          </Field>
          <Field label={t('transactions.category')}>
            <Select
              value={filters.categoryId}
              onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              <CategoryOptions />
            </Select>
          </Field>
          <Field label={t('transactions.type')}>
            <Select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value as Filters['type'] })}
            >
              <option value="">{t('common.all')}</option>
              <option value="expense">{t('transactions.types.expense')}</option>
              <option value="income">{t('transactions.types.income')}</option>
              <option value="transfer">{t('transactions.types.transfer')}</option>
            </Select>
          </Field>
          <Field label={t('transactions.tag')}>
            <Select
              value={filters.tag}
              onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
            >
              <option value="">{t('common.all')}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>{`#${tag}`}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <BulkDialog
        mode={bulk}
        ids={[...selected]}
        onClose={(done) => {
          setBulk(null);
          if (done) setSelected(new Set());
        }}
      />
    </>
  );
}

function BulkDialog({
  mode,
  ids,
  onClose,
}: {
  mode: null | 'category' | 'tag' | 'delete';
  ids: string[];
  onClose: (done: boolean) => void;
}) {
  const { t } = useTranslation();
  const [categoryId, setCategoryId] = useState('');
  const [tag, setTag] = useState('');
  const apply = async () => {
    if (mode === 'category') await bulkUpdateTransactions(ids, { categoryId: categoryId || null });
    if (mode === 'tag' && tag.trim()) await bulkAddTag(ids, tag.trim().replace(/^#/, ''));
    if (mode === 'delete') await softDelete('transactions', ids);
    toast.success(t('transactions.bulk.done', { count: ids.length }));
    onClose(true);
  };
  return (
    <Modal
      open={mode !== null}
      onClose={() => onClose(false)}
      size="sm"
      title={
        mode === 'delete'
          ? t('transactions.bulk.deleteTitle', { count: ids.length })
          : mode === 'tag'
            ? t('transactions.bulk.tag')
            : t('transactions.bulk.category')
      }
      footer={
        <>
          <Button onClick={() => onClose(false)}>{t('common.cancel')}</Button>
          <Button variant={mode === 'delete' ? 'danger' : 'primary'} onClick={() => void apply()}>
            {mode === 'delete' ? t('common.delete') : t('common.apply')}
          </Button>
        </>
      }
    >
      {mode === 'category' && (
        <Field label={t('transactions.category')}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('categories.uncategorized')}</option>
            <CategoryOptions />
          </Select>
        </Field>
      )}
      {mode === 'tag' && (
        <Field label={t('transactions.tag')}>
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder={t('transactions.tagPlaceholder')}
          />
        </Field>
      )}
      {mode === 'delete' && (
        <p className="text-muted text-sm">{t('transactions.bulk.deleteBody')}</p>
      )}
    </Modal>
  );
}
