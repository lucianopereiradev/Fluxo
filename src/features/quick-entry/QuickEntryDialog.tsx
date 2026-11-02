import { ArrowDownRight, ArrowUpRight, Repeat, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert } from '@/db/repo';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { parseQuickEntry, type ParsedEntry } from '@/domain/quickEntry/parse';
import { makeRecurrence } from '@/domain/records';
import { createTransactions } from '@/features/data/actions';
import { bootstrap } from '@/features/data/bootstrap';
import { useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { rememberCategory } from '@/features/data/learning';
import { parseSource, toSource } from '@/features/transactions/form';
import { CategoryOptions, SourceOptions } from '@/features/transactions/options';
import { useUi } from '@/stores/ui';
import { Field, Input, Segmented, Select } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Badge, Button, Kbd } from '@/ui/primitives';

type Overrides = Partial<{
  type: ParsedEntry['type'];
  amount: string;
  date: string;
  source: string;
  categoryId: string;
  description: string;
  installments: number;
  recurring: boolean;
}>;

const EXAMPLES: Record<string, string[]> = {
  'pt-BR': [
    'almoço 32,50 ontem nubank',
    'tênis 600 em 3x cartão inter',
    'aluguel 1800 todo dia 5',
    'salário 4500 dia 5',
  ],
  en: [
    'coffee 12.90 yesterday',
    'groceries 85 today',
    'rent 1800 every month on the 5th',
    'salary 4500 on the 5th',
  ],
};

/**
 * One line in, a structured transaction out. Parsing happens locally with rules (no AI,
 * nothing leaves the device); every guess is editable before saving.
 */
export function QuickEntryDialog() {
  const { t } = useTranslation();
  const data = useFinance();
  const locale = useLocale();
  const { money, date: formatDate } = useFormat();
  const close = () => useUi.getState().setQuickEntryOpen(false);
  const openEditor = useUi((s) => s.openEditor);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [overrides, setOverrides] = useState<Overrides>({});
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(
    () =>
      parseQuickEntry(text, {
        today: data.today,
        accounts: data.accounts.filter((a) => !a.archived),
        cards: data.cards.filter((c) => !c.archived),
        categories: data.categories,
        rules: data.rules,
      }),
    [text, data.today, data.accounts, data.cards, data.categories, data.rules],
  );

  const defaultSource = data.accounts.find((a) => a.type === 'checking') ?? data.accounts[0];
  const values = {
    type: overrides.type ?? parsed.type,
    amount:
      overrides.amount ??
      (parsed.amountCents !== null ? formatAmountInput(parsed.amountCents, locale) : ''),
    date: overrides.date ?? parsed.date,
    source:
      overrides.source ??
      (toSource(parsed.accountId, parsed.cardId) ||
        (defaultSource ? `account:${defaultSource.id}` : '')),
    categoryId: overrides.categoryId ?? parsed.categoryId ?? '',
    description: overrides.description ?? parsed.description,
    installments: overrides.installments ?? parsed.installments,
    recurring: overrides.recurring ?? parsed.recurrence !== null,
  };
  const set = <K extends keyof Overrides>(key: K, value: Overrides[K]) =>
    setOverrides((o) => ({ ...o, [key]: value }));

  const amountCents = parseMoney(values.amount);
  const canSave = !!text.trim() && amountCents !== null && amountCents > 0 && !!values.source;

  const recurrenceLabel = (() => {
    const r = parsed.recurrence;
    if (!r || !values.recurring) return null;
    if (r.frequency === 'weekly' && r.weekday !== null) {
      const name = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2026, 10, 1 + r.weekday)),
      );
      return t('quickEntry.weeklyOn', { day: name });
    }
    if (r.frequency === 'monthly')
      return t('recurring.everyMonthOn', { count: 1, day: r.dayOfMonth });
    return t(`recurring.frequencies.${r.frequency}`);
  })();

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const { accountId, cardId } = parseSource(values.source);
      const categoryId = values.categoryId || null;
      if (values.recurring && parsed.recurrence) {
        await insert(
          'recurrences',
          makeRecurrence({
            type: values.type,
            amountCents: amountCents!,
            description: values.description,
            categoryId,
            accountId,
            cardId,
            frequency: parsed.recurrence.frequency,
            dayOfMonth: parsed.recurrence.dayOfMonth,
            weekday: parsed.recurrence.weekday,
            startDate: values.date,
          }),
        );
        await bootstrap();
        toast.success(t('quickEntry.recurringCreated'));
      } else {
        const created = await createTransactions({
          type: values.type,
          amountCents: amountCents!,
          date: values.date,
          accountId,
          cardId,
          toAccountId: null,
          toCardId: null,
          categoryId,
          description: values.description,
          notes: '',
          tags: [],
          installments: values.type === 'expense' ? values.installments : 1,
          invoiceMonth: null,
        });
        toast.success(
          created.length > 1
            ? t('transactions.createdInstallments', { count: created.length })
            : t('quickEntry.saved', {
                amount: money(amountCents!),
                description: values.description || t(`transactions.types.${values.type}`),
              }),
        );
      }
      if (categoryId && categoryId !== parsed.categoryId && values.description) {
        await rememberCategory(values.description, categoryId);
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const noSources = data.accounts.length === 0 && data.cards.length === 0;

  return (
    <Modal
      open
      onClose={close}
      title={t('quickEntry.title')}
      description={t('quickEntry.description')}
      initialFocusRef={inputRef}
      footer={
        <>
          <Button
            variant="ghost"
            className="mr-auto"
            onClick={() => {
              close();
              openEditor();
            }}
          >
            {t('quickEntry.fullForm')}
          </Button>
          <Button onClick={close}>{t('common.cancel')}</Button>
          <Button
            variant="primary"
            type="submit"
            form="quick-entry-form"
            disabled={!canSave || saving}
          >
            {t('common.save')}
            <Kbd>{'↵'}</Kbd>
          </Button>
        </>
      }
    >
      {noSources ? (
        <p className="bg-warning-soft text-warning rounded-xl p-3 text-sm">
          {t('transactions.needAccount')}
        </p>
      ) : (
        <form id="quick-entry-form" onSubmit={save} className="grid gap-4" noValidate>
          <div className="relative">
            <Wand2
              className="text-accent pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <label htmlFor="quick-entry-input" className="sr-only">
              {t('quickEntry.inputLabel')}
            </label>
            <Input
              id="quick-entry-input"
              data-testid="quick-entry-input"
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOverrides({});
              }}
              placeholder={EXAMPLES[locale]![0]}
              autoComplete="off"
              spellCheck={false}
              className="h-12 pl-10 text-base"
            />
          </div>

          {!text.trim() ? (
            <div>
              <p className="text-muted mb-2 flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="size-3.5" aria-hidden />
                {t('quickEntry.tryOne')}
              </p>
              <ul className="flex flex-wrap gap-2">
                {EXAMPLES[locale]!.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      onClick={() => {
                        setText(ex);
                        inputRef.current?.focus();
                      }}
                      className="border-border bg-surface-2 text-muted hover:border-accent hover:text-text rounded-full border px-3 py-1 text-sm"
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <section
              aria-label={t('quickEntry.preview')}
              aria-live="polite"
              className="border-border bg-surface-2/60 grid gap-3 rounded-2xl border p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Segmented
                  className="min-w-56"
                  label={t('transactions.type')}
                  value={values.type}
                  onChange={(v) => {
                    set('type', v);
                    set('categoryId', '');
                  }}
                  options={[
                    {
                      value: 'expense',
                      label: t('transactions.types.expense'),
                      icon: <ArrowDownRight className="size-4" aria-hidden />,
                    },
                    {
                      value: 'income',
                      label: t('transactions.types.income'),
                      icon: <ArrowUpRight className="size-4" aria-hidden />,
                    },
                  ]}
                />
                {recurrenceLabel && (
                  <Badge tone="accent">
                    <Repeat className="size-3" aria-hidden />
                    {recurrenceLabel}
                  </Badge>
                )}
                {values.installments > 1 && !values.recurring && (
                  <Badge tone="accent">
                    {t('quickEntry.installments', { count: values.installments })}
                  </Badge>
                )}
                {parsed.categorySource === 'rule' && <Badge>{t('quickEntry.learned')}</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('transactions.amount')}>
                  <Input
                    inputMode="decimal"
                    value={values.amount}
                    onChange={(e) => set('amount', e.target.value)}
                    className="tnum font-medium"
                  />
                </Field>
                <Field
                  label={values.recurring ? t('recurring.startDate') : t('transactions.date')}
                  hint={formatDate(values.date, {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                  })}
                >
                  <Input
                    type="date"
                    value={values.date}
                    onChange={(e) => set('date', e.target.value)}
                  />
                </Field>
                <Field
                  label={
                    values.type === 'income'
                      ? t('transactions.receivedIn')
                      : t('transactions.paidWith')
                  }
                >
                  <Select value={values.source} onChange={(e) => set('source', e.target.value)}>
                    <SourceOptions />
                  </Select>
                </Field>
                <Field label={t('transactions.category')}>
                  <Select
                    value={values.categoryId}
                    onChange={(e) => set('categoryId', e.target.value)}
                  >
                    <option value="">{t('categories.uncategorized')}</option>
                    <CategoryOptions kind={values.type} />
                  </Select>
                </Field>
              </div>
              <Field label={t('transactions.description')}>
                <Input
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </Field>
              {parsed.recurrence && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={values.recurring}
                    onChange={(e) => set('recurring', e.target.checked)}
                    className="size-4 accent-[var(--c-accent)]"
                  />
                  {t('quickEntry.makeRecurring')}
                </label>
              )}
            </section>
          )}
        </form>
      )}
    </Modal>
  );
}
