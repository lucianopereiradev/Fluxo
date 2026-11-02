import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { computeInvoices } from '@/domain/invoices';
import type { InstallmentScope } from '@/domain/installments';
import { formatAmountInput, parseMoney } from '@/domain/money';
import type { TransactionType } from '@/domain/types';
import { createTransactions, deleteTransaction, updateTransaction } from '@/features/data/actions';
import { useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { Field, Input, Segmented, Select, Textarea } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/primitives';
import {
  parseSource,
  parseTags,
  toSource,
  transactionFormSchema,
  type TransactionFormValues,
} from './form';
import { CategoryOptions, SourceOptions } from './options';
import { ScopeDialog } from './ScopeDialog';

export function TransactionEditor() {
  const { t } = useTranslation();
  const data = useFinance();
  const locale = useLocale();
  const { month } = useFormat();
  const editor = useUi((s) => s.editor)!;
  const close = useUi((s) => s.closeEditor);
  const amountRef = useRef<HTMLInputElement>(null);
  const existing =
    editor.id === 'new' ? undefined : data.transactions.find((x) => x.id === editor.id);

  const [values, setValues] = useState<TransactionFormValues>(() => {
    if (existing) {
      return {
        type: existing.type,
        amount: formatAmountInput(existing.amountCents, locale),
        date: existing.date,
        source: toSource(existing.accountId, existing.cardId),
        target: toSource(existing.toAccountId, existing.toCardId),
        categoryId: existing.categoryId ?? '',
        description: existing.description,
        notes: existing.notes,
        tags: existing.tags.join(', '),
        installments: 1,
        invoiceMonth: existing.invoiceMonth ?? '',
      };
    }
    const type: TransactionType = editor.type ?? 'expense';
    const defaultAccount = data.accounts.find((a) => a.type === 'checking') ?? data.accounts[0];
    return {
      type,
      amount: '',
      date: data.today,
      source: defaultAccount
        ? `account:${defaultAccount.id}`
        : data.cards[0]
          ? `card:${data.cards[0].id}`
          : '',
      target: '',
      categoryId: '',
      description: '',
      notes: '',
      tags: '',
      installments: 1,
      invoiceMonth: '',
    };
  });
  const [errors, setErrors] = useState<Partial<Record<keyof TransactionFormValues, string>>>({});
  const [scopeFor, setScopeFor] = useState<'save' | 'delete' | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const targetCard = values.target.startsWith('card:')
    ? data.cardById.get(values.target.slice(5))
    : undefined;
  const sourceIsCard = values.source.startsWith('card:');
  const payableInvoices = useMemo(() => {
    if (!targetCard) return [];
    return computeInvoices(targetCard, data.transactions, data.today).filter(
      (i) => i.status === 'closed' || i.status === 'open' || i.month === values.invoiceMonth,
    );
  }, [targetCard, data.transactions, data.today, values.invoiceMonth]);

  const validate = () => {
    const result = transactionFormSchema.safeParse(values);
    if (result.success) {
      setErrors({});
      return true;
    }
    const next: typeof errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof TransactionFormValues;
      next[key] ??= t(`transactions.errors.${issue.message}`);
    }
    setErrors(next);
    return false;
  };

  const toPatch = () => {
    const { accountId, cardId } = parseSource(values.source);
    const target = parseSource(values.target);
    return {
      type: values.type,
      amountCents: parseMoney(values.amount)!,
      date: values.date,
      accountId,
      cardId: values.type === 'transfer' ? null : cardId,
      toAccountId: values.type === 'transfer' ? target.accountId : null,
      toCardId: values.type === 'transfer' ? target.cardId : null,
      categoryId: values.type === 'transfer' ? null : values.categoryId || null,
      description: values.description.trim(),
      notes: values.notes.trim(),
      tags: parseTags(values.tags),
      invoiceMonth:
        values.type === 'transfer' && target.cardId ? values.invoiceMonth || null : null,
    };
  };

  const save = async (scope: InstallmentScope = 'this') => {
    setSaving(true);
    try {
      const patch = toPatch();
      if (existing) {
        await updateTransaction(existing, patch, scope);
        toast.success(t('transactions.updated'));
      } else {
        const created = await createTransactions({ ...patch, installments: values.installments });
        toast.success(
          created.length > 1
            ? t('transactions.createdInstallments', { count: created.length })
            : t('transactions.created'),
        );
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (existing?.installmentGroupId) setScopeFor('save');
    else void save();
  };

  const remove = async (scope: InstallmentScope = 'this') => {
    if (!existing) return;
    await deleteTransaction(existing, scope);
    toast.success(t('transactions.deleted'));
    close();
  };

  const typeOptions = [
    {
      value: 'expense' as const,
      label: t('transactions.types.expense'),
      icon: <ArrowDownRight className="size-4" aria-hidden />,
    },
    {
      value: 'income' as const,
      label: t('transactions.types.income'),
      icon: <ArrowUpRight className="size-4" aria-hidden />,
    },
    {
      value: 'transfer' as const,
      label: t('transactions.types.transfer'),
      icon: <ArrowLeftRight className="size-4" aria-hidden />,
    },
  ];

  const noAccounts = data.accounts.length === 0 && data.cards.length === 0;

  return (
    <>
      <Modal
        open
        onClose={close}
        title={existing ? t('transactions.edit') : t('transactions.new')}
        description={
          existing?.installmentIndex
            ? t('transactions.installmentOf', {
                index: existing.installmentIndex,
                count: existing.installmentCount,
              })
            : undefined
        }
        initialFocusRef={amountRef}
        footer={
          <>
            {existing && (
              <Button
                variant="ghost"
                className="text-negative mr-auto"
                icon={<Trash2 className="size-4" />}
                onClick={() =>
                  existing.installmentGroupId ? setScopeFor('delete') : void remove()
                }
              >
                {t('common.delete')}
              </Button>
            )}
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              type="submit"
              form="transaction-form"
              disabled={saving || noAccounts}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        {noAccounts ? (
          <p className="bg-warning-soft text-warning rounded-xl p-3 text-sm">
            {t('transactions.needAccount')}
          </p>
        ) : (
          <form id="transaction-form" onSubmit={onSubmit} className="grid gap-4" noValidate>
            <Segmented
              label={t('transactions.type')}
              value={values.type}
              onChange={(type) => {
                set('type', type);
                if (type === 'transfer' && sourceIsCard) set('source', '');
                set('categoryId', '');
              }}
              options={typeOptions}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('transactions.amount')} error={errors.amount}>
                <Input
                  ref={amountRef}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder={formatAmountInput(0, locale)}
                  value={values.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  className="tnum text-lg font-medium"
                />
              </Field>
              <Field label={t('transactions.date')} error={errors.date}>
                <Input
                  type="date"
                  value={values.date}
                  onChange={(e) => set('date', e.target.value)}
                />
              </Field>
            </div>

            {values.type === 'transfer' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('transactions.from')} error={errors.source}>
                  <Select value={values.source} onChange={(e) => set('source', e.target.value)}>
                    <option value="">{t('common.choose')}</option>
                    <SourceOptions cards={false} />
                  </Select>
                </Field>
                <Field
                  label={t('transactions.to')}
                  error={errors.target}
                  hint={targetCard ? t('transactions.billPaymentHint') : undefined}
                >
                  <Select value={values.target} onChange={(e) => set('target', e.target.value)}>
                    <option value="">{t('common.choose')}</option>
                    <SourceOptions />
                  </Select>
                </Field>
                {targetCard && payableInvoices.length > 0 && (
                  <Field label={t('cards.invoice')} className="sm:col-span-2">
                    <Select
                      value={values.invoiceMonth}
                      onChange={(e) => set('invoiceMonth', e.target.value)}
                    >
                      <option value="">{t('cards.latestClosed')}</option>
                      {payableInvoices.map((inv) => (
                        <option key={inv.month} value={inv.month}>
                          {month(inv.month)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label={
                    values.type === 'income'
                      ? t('transactions.receivedIn')
                      : t('transactions.paidWith')
                  }
                  error={errors.source}
                >
                  <Select value={values.source} onChange={(e) => set('source', e.target.value)}>
                    <option value="">{t('common.choose')}</option>
                    <SourceOptions />
                  </Select>
                </Field>
                <Field label={t('transactions.category')}>
                  <Select
                    value={values.categoryId}
                    onChange={(e) => set('categoryId', e.target.value)}
                  >
                    <option value="">{t('categories.uncategorized')}</option>
                    <CategoryOptions kind={values.type === 'income' ? 'income' : 'expense'} />
                  </Select>
                </Field>
              </div>
            )}

            <Field label={t('transactions.description')}>
              <Input
                value={values.description}
                maxLength={500}
                onChange={(e) => set('description', e.target.value)}
                placeholder={t('transactions.descriptionPlaceholder')}
              />
            </Field>

            {!existing && values.type === 'expense' && (
              <Field
                label={t('transactions.installments')}
                hint={
                  values.installments > 1 && parseMoney(values.amount)
                    ? t('transactions.installmentsHint', { count: values.installments })
                    : t('transactions.installmentsHelp')
                }
              >
                <Input
                  type="number"
                  min={1}
                  max={72}
                  value={values.installments}
                  onChange={(e) =>
                    set('installments', Math.min(72, Math.max(1, Number(e.target.value) || 1)))
                  }
                />
              </Field>
            )}

            <Field label={t('transactions.tags')} hint={t('transactions.tagsHint')}>
              <Input value={values.tags} onChange={(e) => set('tags', e.target.value)} />
            </Field>
            <Field label={t('transactions.notes')}>
              <Textarea
                value={values.notes}
                onChange={(e) => set('notes', e.target.value)}
                maxLength={5000}
              />
            </Field>
          </form>
        )}
      </Modal>
      <ScopeDialog
        open={scopeFor !== null}
        action={scopeFor ?? 'save'}
        onCancel={() => setScopeFor(null)}
        onConfirm={(scope) => {
          const action = scopeFor;
          setScopeFor(null);
          if (action === 'delete') void remove(scope);
          else void save(scope);
        }}
      />
    </>
  );
}
