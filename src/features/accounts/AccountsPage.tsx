import {
  ArrowLeftRight,
  Banknote,
  Landmark,
  LineChart,
  Pencil,
  PiggyBank,
  Plus,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';
import { accountBalance } from '@/domain/balances';
import type { Account, AccountType } from '@/domain/types';
import { useFinance } from '@/features/data/hooks';
import { useUi } from '@/stores/ui';
import { EmptyState } from '@/ui/EmptyState';
import { Money } from '@/ui/Money';
import { Badge, Button, IconButton, PageHeader, Panel } from '@/ui/primitives';
import { AccountEditor } from './AccountEditor';

const TYPE_ICON: Record<AccountType, typeof Landmark> = {
  checking: Landmark,
  savings: PiggyBank,
  wallet: Wallet,
  investment: LineChart,
};

export default function AccountsPage() {
  const { t } = useTranslation();
  const { accounts, transactions, today } = useFinance();
  const openEditor = useUi((s) => s.openEditor);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Account | 'new' | null>(params.get('new') ? 'new' : null);

  const rows = useMemo(
    () =>
      accounts.map((a) => ({
        account: a,
        balance: accountBalance(a, transactions, today),
        scheduled: accountBalance(a, transactions) - accountBalance(a, transactions, today),
      })),
    [accounts, transactions, today],
  );
  const total = rows.filter((r) => !r.account.archived).reduce((s, r) => s + r.balance, 0);

  const close = () => {
    setEditing(null);
    if (params.get('new')) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title={t('accounts.title')}
        subtitle={
          rows.length > 0 ? (
            <>
              {t('accounts.total')} <Money cents={total} className="text-text font-medium" />
            </>
          ) : undefined
        }
        actions={
          <>
            {rows.length > 1 && (
              <Button
                icon={<ArrowLeftRight className="size-4" />}
                onClick={() => openEditor(undefined, 'transfer')}
              >
                {t('transactions.newTransfer')}
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setEditing('new')}
            >
              {t('accounts.add')}
            </Button>
          </>
        }
      />
      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            art="ledger"
            title={t('accounts.empty.title')}
            description={t('accounts.empty.body')}
            action={
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => setEditing('new')}
              >
                {t('accounts.add')}
              </Button>
            }
          />
        </Panel>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ account, balance, scheduled }) => {
            const Icon = TYPE_ICON[account.type] ?? Banknote;
            return (
              <Panel as="li" key={account.id} className="animate-rise flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span
                      className="grid size-10 place-items-center rounded-xl"
                      style={{
                        background: `color-mix(in oklab, ${account.color} 16%, transparent)`,
                        color: account.color,
                      }}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span>
                      <span className="block font-medium">{account.name}</span>
                      <span className="text-muted text-xs">
                        {t(`accounts.types.${account.type}`)}
                      </span>
                    </span>
                  </span>
                  <IconButton
                    size="sm"
                    label={t('accounts.editNamed', { name: account.name })}
                    onClick={() => setEditing(account)}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                </div>
                <p className="font-display mt-5 text-3xl font-medium tracking-tight">
                  <Money cents={balance} tone={balance < 0 ? 'signed' : 'neutral'} />
                </p>
                <div className="text-muted mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {account.archived && <Badge>{t('accounts.archived')}</Badge>}
                  {scheduled !== 0 && (
                    <span>
                      {t('accounts.scheduled')} <Money cents={scheduled} tone="signed" />
                    </span>
                  )}
                </div>
                <Link
                  to={`/app/transactions?source=account:${account.id}`}
                  className="text-accent mt-4 text-sm hover:underline"
                >
                  {t('accounts.viewTransactions')}
                </Link>
              </Panel>
            );
          })}
        </ul>
      )}
      {editing && (
        <AccountEditor account={editing === 'new' ? undefined : editing} onClose={close} />
      )}
    </>
  );
}
