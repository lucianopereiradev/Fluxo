import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { InstallmentScope } from '@/domain/installments';
import { Modal } from '@/ui/Modal';
import { Button, cn } from '@/ui/primitives';

/** Asks whether an installment change applies to just this one or to the following ones too. */
export function ScopeDialog({
  open,
  action,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  action: 'save' | 'delete';
  onCancel: () => void;
  onConfirm: (scope: InstallmentScope) => void;
}) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<InstallmentScope>('this');
  const options: { value: InstallmentScope; label: string }[] = [
    { value: 'this', label: t('transactions.scope.this') },
    { value: 'thisAndNext', label: t('transactions.scope.thisAndNext') },
  ];
  return (
    <Modal
      open={open}
      onClose={onCancel}
      size="sm"
      title={
        action === 'delete'
          ? t('transactions.scope.deleteTitle')
          : t('transactions.scope.editTitle')
      }
      footer={
        <>
          <Button onClick={onCancel}>{t('common.cancel')}</Button>
          <Button
            variant={action === 'delete' ? 'danger' : 'primary'}
            onClick={() => onConfirm(scope)}
          >
            {action === 'delete' ? t('common.delete') : t('common.save')}
          </Button>
        </>
      }
    >
      <fieldset className="grid gap-2">
        <legend className="sr-only">{t('transactions.scope.legend')}</legend>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm',
              scope === o.value ? 'border-accent bg-accent-soft' : 'border-border',
            )}
          >
            <input
              type="radio"
              name="installment-scope"
              value={o.value}
              checked={scope === o.value}
              onChange={() => setScope(o.value)}
              className="accent-[var(--c-accent)]"
            />
            {o.label}
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}
