import type { LocalDate } from './dates';
import type { Cents } from './money';
import type { Account, AccountType, Transaction } from './types';

/** Accounts whose money can be spent today (used by safe-to-spend and the forecast). */
export const LIQUID_ACCOUNT_TYPES: readonly AccountType[] = ['checking', 'wallet'];

export const isLiquid = (a: Pick<Account, 'type'>) => LIQUID_ACCOUNT_TYPES.includes(a.type);

/** Signed effect of a transaction on an account balance. */
export function accountDelta(t: Transaction, accountId: string): Cents {
  if (t.deletedAt !== null) return 0;
  let delta = 0;
  if (t.accountId === accountId) {
    if (t.type === 'income') delta += t.amountCents;
    else delta -= t.amountCents; // expense or outgoing transfer
  }
  if (t.type === 'transfer' && t.toAccountId === accountId) delta += t.amountCents;
  return delta;
}

export function accountBalance(
  account: Pick<Account, 'id' | 'initialBalanceCents'>,
  transactions: readonly Transaction[],
  asOf?: LocalDate,
): Cents {
  let balance = account.initialBalanceCents;
  for (const t of transactions) {
    if (asOf && t.date > asOf) continue;
    balance += accountDelta(t, account.id);
  }
  return balance;
}

export function totalBalance(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf?: LocalDate,
  filter: (a: Account) => boolean = () => true,
): Cents {
  return accounts
    .filter((a) => a.deletedAt === null && filter(a))
    .reduce((sum, a) => sum + accountBalance(a, transactions, asOf), 0);
}

export function liquidBalance(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  asOf?: LocalDate,
): Cents {
  return totalBalance(accounts, transactions, asOf, isLiquid);
}
