import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { makeCard } from '@/domain/records';
import type { Card } from '@/domain/types';
import { useFinance, useLocale } from '@/features/data/hooks';
import { ColorPicker, SWATCHES } from '@/ui/ColorPicker';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field, Input, Select, Switch } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/primitives';

const clampDay = (v: string) => Math.min(31, Math.max(1, Math.floor(Number(v) || 1)));

export function CardEditor({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const { accounts } = useFinance();
  const [name, setName] = useState(card?.name ?? '');
  const [limit, setLimit] = useState(card ? formatAmountInput(card.limitCents, locale) : '');
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? 1));
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 10));
  const [paymentAccountId, setPaymentAccountId] = useState(
    card?.paymentAccountId ?? accounts.find((a) => a.type === 'checking')?.id ?? '',
  );
  const [color, setColor] = useState(card?.color ?? SWATCHES[0]!);
  const [archived, setArchived] = useState(card?.archived ?? false);
  const [errors, setErrors] = useState<{ name?: string; limit?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = limit.trim() ? parseMoney(limit) : 0;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (cents === null || cents < 0) next.limit = t('transactions.errors.amount');
    setErrors(next);
    if (Object.keys(next).length) return;
    const fields = {
      name: name.trim(),
      limitCents: cents!,
      closingDay: clampDay(closingDay),
      dueDay: clampDay(dueDay),
      paymentAccountId: paymentAccountId || null,
      color,
      archived,
    };
    if (card) await update('cards', card.id, fields);
    else await insert('cards', makeCard(fields));
    toast.success(card ? t('cards.updated') : t('cards.created'));
    onClose();
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={card ? t('cards.edit') : t('cards.add')}
        footer={
          <>
            {card && (
              <Button
                variant="ghost"
                className="text-negative mr-auto"
                onClick={() => setConfirmDelete(true)}
              >
                {t('common.delete')}
              </Button>
            )}
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="card-form">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="card-form" className="grid gap-4" onSubmit={submit} noValidate>
          <Field label={t('cards.name')} error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t('cards.namePlaceholder')}
            />
          </Field>
          <Field label={t('cards.limit')} error={errors.limit}>
            <Input
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="tnum"
              placeholder={formatAmountInput(0, locale)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('cards.closingDay')} hint={t('cards.closingHint')}>
              <Input
                type="number"
                min={1}
                max={31}
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
              />
            </Field>
            <Field label={t('cards.dueDay')}>
              <Input
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t('cards.paymentAccount')}>
            <Select value={paymentAccountId} onChange={(e) => setPaymentAccountId(e.target.value)}>
              <option value="">{t('common.none')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <ColorPicker label={t('common.color')} value={color} onChange={setColor} />
          {card && (
            <Switch checked={archived} onChange={setArchived} label={t('accounts.archived')} />
          )}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t('cards.deleteTitle')}
        body={t('cards.deleteBody')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (card) await softDelete('cards', [card.id]);
          setConfirmDelete(false);
          toast.success(t('cards.deleted'));
          onClose();
        }}
      />
    </>
  );
}
