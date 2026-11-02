import type { LocalDate, YearMonth } from './dates';
import type { Cents } from './money';

/** Fields shared by every synced record. `deletedAt` marks a tombstone (soft delete). */
export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment';

export interface Account extends BaseRecord {
  name: string;
  type: AccountType;
  initialBalanceCents: Cents;
  color: string;
  archived: boolean;
}

export interface Card extends BaseRecord {
  name: string;
  limitCents: Cents;
  /** Day of month the invoice closes (purchases on or after it go to the next invoice). */
  closingDay: number;
  dueDay: number;
  paymentAccountId: string | null;
  color: string;
  archived: boolean;
}

export type CategoryKind = 'income' | 'expense';

export interface Category extends BaseRecord {
  /** User-given name. Empty for built-in categories, which are translated via `systemKey`. */
  name: string;
  systemKey: string | null;
  kind: CategoryKind;
  color: string;
  icon: string;
  parentId: string | null;
}

export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * A money movement. Amounts are always positive; `type` gives the direction.
 * - income/expense: exactly one of `accountId` / `cardId` is set.
 * - transfer: from `accountId` to `toAccountId` or `toCardId` (a card bill payment).
 */
export interface Transaction extends BaseRecord {
  type: TransactionType;
  amountCents: Cents;
  date: LocalDate;
  accountId: string | null;
  cardId: string | null;
  toAccountId: string | null;
  toCardId: string | null;
  categoryId: string | null;
  description: string;
  notes: string;
  tags: string[];
  installmentGroupId: string | null;
  installmentIndex: number | null;
  installmentCount: number | null;
  recurrenceId: string | null;
  importId: string | null;
  /** Bank-provided unique id (OFX FITID) used to detect duplicate imports. */
  externalId: string | null;
  /** For card bill payments: which invoice (closing month) this payment settles. */
  invoiceMonth: YearMonth | null;
}

export type Frequency = 'weekly' | 'monthly' | 'yearly';

export interface Recurrence extends BaseRecord {
  type: 'income' | 'expense';
  amountCents: Cents;
  description: string;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  frequency: Frequency;
  /** Every N periods (1 = every week/month/year). */
  interval: number;
  /** Monthly: day of month (clamped). Yearly uses the start date's month and this day. */
  dayOfMonth: number | null;
  /** Weekly: 0 = Sunday … 6 = Saturday. */
  weekday: number | null;
  startDate: LocalDate;
  endDate: LocalDate | null;
  active: boolean;
}

export interface Budget extends BaseRecord {
  categoryId: string;
  amountCents: Cents;
  /** Carry unspent money into the following month. */
  rollover: boolean;
  startMonth: YearMonth;
}

export interface Goal extends BaseRecord {
  name: string;
  targetCents: Cents;
  targetDate: LocalDate | null;
  accountId: string | null;
  /** Manually tracked progress, used when no account is linked. */
  savedCents: Cents;
  monthlyContributionCents: Cents;
  color: string;
  icon: string;
}

/** A learned categorization rule: normalized description → category. */
export interface Rule extends BaseRecord {
  pattern: string;
  categoryId: string;
  hits: number;
}

export interface SettingRecord extends BaseRecord {
  /** The setting key doubles as the id so devices merge the same setting. */
  value: unknown;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

/** Local-only sync bookkeeping (never synced itself). */
export interface SyncStateRecord {
  id: 'vault';
  vaultId: string;
  salt: string;
  version: number;
  lastSyncedAt: string | null;
  remember: boolean;
  encKey?: CryptoKey;
  authKey?: CryptoKey;
}

export interface DataSnapshot {
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  rules: Rule[];
  settings: SettingRecord[];
}

export const SYNCED_TABLES = [
  'accounts',
  'cards',
  'categories',
  'transactions',
  'recurrences',
  'budgets',
  'goals',
  'rules',
  'settings',
] as const satisfies readonly (keyof DataSnapshot)[];

export type SyncedTable = (typeof SYNCED_TABLES)[number];

export const isAlive = <T extends BaseRecord>(r: T): boolean => r.deletedAt === null;
