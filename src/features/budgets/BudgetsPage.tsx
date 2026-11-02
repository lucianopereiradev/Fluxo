import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { budgetStatus, type BudgetStatus } from '@/domain/budgets';
import { addMonthsToMonth, monthOf } from '@/domain/dates';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { makeBudget } from '@/domain/records';
import type { Budget } from '@/domain/types';
import { useCategoryName, useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { CategoryOptions } from '@/features/transactions/options';
import { CategoryIcon } from '@/ui/CategoryIcon';
import { EmptyState } from '@/ui/EmptyState';
import { Field, Input, Select, Switch } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Money } from '@/ui/Money';
import { Badge, Button, IconButton, PageHeader, Panel, ProgressBar } from '@/ui/primitives';

const TONE = { ok: 'positive', warning: 'warning', over: 'negative' } as const;

export default function BudgetsPage() {
  const { t } = useTranslation();
  const { budgets, categories, transactions, today, categoryById } = useFinance();
  const { month: formatMonth } = useFormat();
  const categoryName = useCategoryName();
  const [month, setMonth] = useState(monthOf(today));
  const [editing, setEditing] = useState<Budget | 'new' | null>(null);

  const statuses = useMemo(
    () =>
      budgets
        .filter((b) => b.startMonth <= month)
        .map((b) => budgetStatus(b, categories, transactions, month))
        .sort((a, b) => b.ratio - a.ratio),
    [budgets, categories, transactions, month],
  );
  const totals = statuses.reduce(
    (s, x) => ({ limit: s.limit + x.limitCents + x.carriedCents, spent: s.spent + x.spentCents }),
    { limit: 0, spent: 0 },
  );

  return (
    <>
      <PageHeader
        title={t('budgets.title')}
        subtitle={t('budgets.subtitle')}
        actions={
          <Button
            variant="primary"
            icon={<Plus className="size-4" />}
            onClick={() => setEditing('new')}
          >
            {t('budgets.add')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="border-border bg-surface flex items-center rounded-xl border">
          <IconButton
            label={t('common.previousMonth')}
            onClick={() => setMonth(addMonthsToMonth(month, -1))}
          >
            <ChevronLeft className="size-4" />
          </IconButton>
          <span className="min-w-36 text-center text-sm font-medium capitalize" aria-live="polite">
            {formatMonth(month)}
          </span>
          <IconButton
            label={t('common.nextMonth')}
            onClick={() => setMonth(addMonthsToMonth(month, 1))}
          >
            <ChevronRight className="size-4" />
          </IconButton>
        </div>
        {statuses.length > 0 && (
          <p className="tnum text-muted text-sm">
            <Money cents={totals.spent} className="text-text font-medium" /> {t('budgets.of')}{' '}
            <Money cents={totals.limit} />
          </p>
        )}
      </div>

      {statuses.length === 0 ? (
        <Panel>
          <EmptyState
            art="chart"
            title={t('budgets.empty.title')}
            description={t('budgets.empty.body')}
            action={
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setEditing('new')}
              >
                {t('budgets.add')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {statuses.map((s) => (
            <BudgetRow
              key={s.budget.id}
              status={s}
              name={categoryName(categoryById.get(s.budget.categoryId))}
              category={categoryById.get(s.budget.categoryId)}
              onEdit={() => setEditing(s.budget)}
            />
          ))}
        </ul>
      )}
      {editing && (
        <BudgetEditor
          budget={editing === 'new' ? undefined : editing}
          month={month}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function BudgetRow({
  status: s,
  name,
  category,
  onEdit,
}: {
  status: BudgetStatus;
  name: string;
  category: Parameters<typeof CategoryIcon>[0]['category'];
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const pct = Number.isFinite(s.ratio) ? Math.round(s.ratio * 100) : 100;
  return (
    <Panel as="li" className="animate-rise">
      <button
        type="button"
        onClick={onEdit}
        className="block w-full p-4 text-left"
        aria-label={t('budgets.editNamed', { name })}
      >
        <div className="flex items-center gap-3">
          <CategoryIcon category={category} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{name}</span>
              <Badge tone={TONE[s.level]}>
                {s.level === 'over' ? (
                  <AlertTriangle className="size-3" aria-hidden />
                ) : s.level === 'warning' ? (
                  <AlertTriangle className="size-3" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-3" aria-hidden />
                )}
                {`${pct}%`}
              </Badge>
            </div>
            <p className="tnum text-muted mt-0.5 text-xs">
              <Money cents={s.spentCents} /> {t('budgets.of')}{' '}
              <Money cents={s.limitCents + s.carriedCents} />
            </p>
          </div>
        </div>
        <ProgressBar
          className="mt-3"
          value={s.spentCents}
          max={s.limitCents + s.carriedCents}
          tone={TONE[s.level]}
          label={t('budgets.progressLabel', { name })}
        />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
          <span className={s.leftCents < 0 ? 'text-negative font-medium' : 'text-muted'}>
            {s.leftCents < 0 ? (
              <>
                {t('budgets.overBy')} <Money cents={-s.leftCents} />
              </>
            ) : (
              <>
                {t('budgets.left')} <Money cents={s.leftCents} />
              </>
            )}
          </span>
          {s.carriedCents > 0 && (
            <span className="text-muted inline-flex items-center gap-1">
              <Undo2 className="size-3" aria-hidden />
              {t('budgets.carried')} <Money cents={s.carriedCents} />
            </span>
          )}
        </div>
      </button>
    </Panel>
  );
}

function BudgetEditor({
  budget,
  month,
  onClose,
}: {
  budget?: Budget;
  month: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { budgets } = useFinance();
  const [categoryId, setCategoryId] = useState(budget?.categoryId ?? '');
  const [amount, setAmount] = useState(budget ? formatAmountInput(budget.amountCents, locale) : '');
  const [rollover, setRollover] = useState(budget?.rollover ?? false);
  const [errors, setErrors] = useState<{ category?: string; amount?: string }>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    const next: typeof errors = {};
    if (!categoryId) next.category = t('common.required');
    else if (budgets.some((b) => b.categoryId === categoryId && b.id !== budget?.id))
      next.category = t('budgets.duplicate');
    if (!cents || cents <= 0) next.amount = t('transactions.errors.amount');
    setErrors(next);
    if (Object.keys(next).length) return;
    if (budget) await update('budgets', budget.id, { categoryId, amountCents: cents!, rollover });
    else
      await insert(
        'budgets',
        makeBudget({ categoryId, amountCents: cents!, rollover, startMonth: month }),
      );
    toast.success(t('budgets.saved'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={budget ? t('budgets.edit') : t('budgets.add')}
      footer={
        <>
          {budget && (
            <Button
              variant="ghost"
              className="text-negative mr-auto"
              onClick={async () => {
                await softDelete('budgets', [budget.id]);
                toast.success(t('budgets.deleted'));
                onClose();
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="budget-form">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="budget-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('transactions.category')} error={errors.category}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('common.choose')}</option>
            <CategoryOptions kind="expense" />
          </Select>
        </Field>
        <Field label={t('budgets.monthlyLimit')} error={errors.amount}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum"
            placeholder={formatAmountInput(0, locale)}
          />
        </Field>
        <Switch
          checked={rollover}
          onChange={setRollover}
          label={t('budgets.rollover')}
          description={t('budgets.rolloverHint')}
        />
      </form>
    </Modal>
  );
}
