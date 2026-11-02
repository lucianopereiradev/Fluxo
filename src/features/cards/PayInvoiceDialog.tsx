import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Invoice } from '@/domain/invoices';
import { formatAmountInput, parseMoney } from '@/domain/money';
import type { Card } from '@/domain/types';
import { payInvoice } from '@/features/data/actions';
import { useFinance, useFormat, useLocale } from '@/features/data/hooks';
import { Field, Input, Select } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Money } from '@/ui/Money';
import { Button } from '@/ui/primitives';

/** Paying an invoice is a transfer from an account to the card. Partial payments are fine. */
export function PayInvoiceDialog({
  card,
  invoice,
  onClose,
}: {
  card: Card;
  invoice: Invoice;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { accounts, today } = useFinance();
  const { month } = useFormat();
  const [amount, setAmount] = useState(formatAmountInput(invoice.remainingCents, locale));
  const [fromAccountId, setFromAccountId] = useState(
    card.paymentAccountId ?? accounts[0]?.id ?? '',
  );
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = parseMoney(amount);
    if (!cents || cents <= 0) return setError(t('transactions.errors.amount'));
    if (!fromAccountId) return setError(t('transactions.errors.source'));
    await payInvoice({
      card,
      invoiceMonth: invoice.month,
      amountCents: cents,
      fromAccountId,
      date,
      description: t('cards.paymentDescription', { card: card.name, month: month(invoice.month) }),
    });
    toast.success(cents < invoice.remainingCents ? t('cards.partialPaid') : t('cards.paid'));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={t('cards.payTitle', { card: card.name })}
      description={
        <>
          {t('cards.remaining')}{' '}
          <Money cents={invoice.remainingCents} className="text-text font-medium" />
        </>
      }
      footer={
        <>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" type="submit" form="pay-form">
            {t('cards.pay')}
          </Button>
        </>
      }
    >
      <form id="pay-form" className="grid gap-4" onSubmit={submit} noValidate>
        <Field label={t('transactions.amount')} error={error} hint={t('cards.partialHint')}>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="tnum text-lg"
          />
        </Field>
        <Field label={t('transactions.from')}>
          <Select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('transactions.date')}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </form>
    </Modal>
  );
}
