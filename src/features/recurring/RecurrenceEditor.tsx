import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { dayOf, isValidLocalDate, weekday } from '@/domain/dates';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { makeRecurrence } from '@/domain/records';
import type { Frequency, Recurrence } from '@/domain/types';
import { useFinance, useLocale } from '@/features/data/hooks';
import { parseSource, toSource } from '@/features/transactions/form';
import { CategoryOptions, SourceOptions } from '@/features/transactions/options';
import { Field, Input, Segmented, Select, Switch } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/primitives';

export function RecurrenceEditor({
  recurrence,
  onClose,
}: {
  recurrence?: Recurrence;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { today, accounts } = useFinance();
  const [type, setType] = useState<'income' | 'expense'>(recurrence?.type ?? 'expense');
  const [amount, setAmount] = useState(
    recurrence ? formatAmountInput(recurrence.amountCents, locale) : '',
  );
  const [description, setDescription] = useState(recurrence?.description ?? '');
  const [categoryId, setCategoryId] = useState(recurrence?.categoryId ?? '');
  const [source, setSource] = useState<string>(
    recurrence
      ? toSource(recurrence.accountId, recurrence.cardId)
      : accounts[0]
        ? `account:${accounts[0].id}`
        : '',
  );
  const [frequency, setFrequency] = useState<Frequency>(recurrence?.frequency ?? 'monthly');
  const [interval, setInterval] = useState(String(recurrence?.interval ?? 1));
  const [startDate, setStartDate] = useState(recurrence?.startDate ?? today);
  const [endDate, setEndDate] = useState(recurrence?.endDate ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(String(recurrence?.dayOfMonth ?? dayOf(today)));
  const [weekdayValue, setWeekdayValue] = useState(String(recurrence?.weekday ?? weekday(today)));
  const [active, setActive] = useState(recurrence?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 10, 1 + i)),
    ),
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    const next: Record<string, string> = {};
    if (!cents || cents <= 0) next.amount = t('transactions.errors.amount');
    if (!source) next.source = t('transactions.errors.source');
    if (!isValidLocalDate(startDate)) next.startDate = t('transactions.errors.date');
    if (endDate && (!isValidLocalDate(endDate) || endDate < startDate))
      next.endDate = t('transactions.errors.date');
    setErrors(next);
    if (Object.keys(next).length) return;
    const { accountId, cardId } = parseSource(source);
    const fields = {
      type,
      amountCents: cents!,
      description: description.trim(),
      categoryId: categoryId || null,
      accountId,
      cardId,
      frequency,
      interval: Math.min(60, Math.max(1, Number(interval) || 1)),
      dayOfMonth:
        frequency === 'weekly' ? null : Math.min(31, Math.max(1, Number(dayOfMonth) || 1)),
      weekday: frequency === 'weekly' ? Number(weekdayValue) : null,
      startDate,
      endDate: endDate || null,
      active,
    };
    if (recurrence) await update('recurrences', recurrence.id, fields);
    else await insert('recurrences', makeRecurrence(fields));
    toast.success(t('recurring.saved'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={recurrence ? t('recurring.edit') : t('recurring.add')}
      description={t('recurring.editorHint')}
      footer={
        <>
          {recurrence && (
            <Button
              variant="ghost"
              className="text-negative mr-auto"
              onClick={async () => {
                await softDelete('recurrences', [recurrence.id]);
                toast.success(t('recurring.deleted'));
                onClose();
              }}
            >
              {t('common.delete')}
            </Button>
          )}
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="recurrence-form">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form id="recurrence-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Segmented
          label={t('transactions.type')}
          value={type}
          onChange={(v) => {
            setType(v);
            setCategoryId('');
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
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('transactions.amount')} error={errors.amount}>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum text-lg"
            />
          </Field>
          <Field
            label={type === 'income' ? t('transactions.receivedIn') : t('transactions.paidWith')}
            error={errors.source}
          >
            <Select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{t('common.choose')}</option>
              <SourceOptions cards={type === 'expense'} />
            </Select>
          </Field>
        </div>
        <Field label={t('transactions.description')}>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder={t('recurring.descriptionPlaceholder')}
          />
        </Field>
        <Field label={t('transactions.category')}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">{t('categories.uncategorized')}</option>
            <CategoryOptions kind={type} />
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('recurring.frequency')}>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              <option value="weekly">{t('recurring.frequencies.weekly')}</option>
              <option value="monthly">{t('recurring.frequencies.monthly')}</option>
              <option value="yearly">{t('recurring.frequencies.yearly')}</option>
            </Select>
          </Field>
          <Field label={t('recurring.interval')} hint={t('recurring.intervalHint')}>
            <Input
              type="number"
              min={1}
              max={60}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            />
          </Field>
        </div>
        {frequency === 'weekly' ? (
          <Field label={t('recurring.weekday')}>
            <Select value={weekdayValue} onChange={(e) => setWeekdayValue(e.target.value)}>
              {weekdays.map((name, i) => (
                <option key={name} value={i} className="capitalize">
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={t('recurring.dayOfMonth')} hint={t('recurring.dayHint')}>
            <Input
              type="number"
              min={1}
              max={31}
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
            />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('recurring.startDate')} error={errors.startDate}>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label={t('recurring.endDate')} error={errors.endDate}>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <Switch
          checked={active}
          onChange={setActive}
          label={t('recurring.active')}
          description={t('recurring.activeHint')}
        />
      </form>
    </Modal>
  );
}
