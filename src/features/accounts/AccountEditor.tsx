import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { insert, softDelete, update } from '@/db/repo';
import { formatAmountInput, parseMoney } from '@/domain/money';
import { makeAccount } from '@/domain/records';
import type { Account, AccountType } from '@/domain/types';
import { useLocale } from '@/features/data/hooks';
import { ColorPicker, SWATCHES } from '@/ui/ColorPicker';
import { ConfirmDialog } from '@/ui/ConfirmDialog';
import { Field, Input, Select, Switch } from '@/ui/Field';
import { Modal } from '@/ui/Modal';
import { Button } from '@/ui/primitives';

export const ACCOUNT_TYPES: AccountType[] = ['checking', 'savings', 'wallet', 'investment'];

export function AccountEditor({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { t } = useTranslation();
  const locale = useLocale();
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [initial, setInitial] = useState(
    account ? formatAmountInput(account.initialBalanceCents, locale) : '',
  );
  const [color, setColor] = useState(account?.color ?? SWATCHES[4]!);
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [errors, setErrors] = useState<{ name?: string; initial?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cents = initial.trim() ? parseMoney(initial) : 0;
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('common.required');
    if (cents === null) next.initial = t('transactions.errors.amount');
    setErrors(next);
    if (Object.keys(next).length) return;
    const fields = { name: name.trim(), type, initialBalanceCents: cents!, color, archived };
    if (account) await update('accounts', account.id, fields);
    else await insert('accounts', makeAccount(fields));
    toast.success(account ? t('accounts.updated') : t('accounts.created'));
    onClose();
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={account ? t('accounts.edit') : t('accounts.add')}
        footer={
          <>
            {account && (
              <Button
                variant="ghost"
                className="text-negative mr-auto"
                onClick={() => setConfirmDelete(true)}
              >
                {t('common.delete')}
              </Button>
            )}
            <Button onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant="primary" type="submit" form="account-form">
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="account-form" className="grid gap-4" onSubmit={submit} noValidate>
          <Field label={t('accounts.name')} error={errors.name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t('accounts.namePlaceholder')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('accounts.type')}>
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {ACCOUNT_TYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(`accounts.types.${v}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('accounts.initialBalance')} error={errors.initial}>
              <Input
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
                placeholder={formatAmountInput(0, locale)}
                className="tnum"
              />
            </Field>
          </div>
          <ColorPicker label={t('common.color')} value={color} onChange={setColor} />
          {account && (
            <Switch
              checked={archived}
              onChange={setArchived}
              label={t('accounts.archived')}
              description={t('accounts.archivedHint')}
            />
          )}
        </form>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={t('accounts.deleteTitle')}
        body={t('accounts.deleteBody')}
        confirmLabel={t('common.delete')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (account) await softDelete('accounts', [account.id]);
          setConfirmDelete(false);
          toast.success(t('accounts.deleted'));
          onClose();
        }}
      />
    </>
  );
}
