import { uuidv7 } from './ids';
import type {
  Account,
  BaseRecord,
  Budget,
  Card,
  Category,
  Goal,
  Recurrence,
  Rule,
  Transaction,
} from './types';

type Input<T extends BaseRecord, Required extends keyof T> = Pick<T, Required> &
  Partial<Omit<T, Required>>;

export function baseRecord(now: string = new Date().toISOString()): BaseRecord {
  return { id: uuidv7(Date.parse(now)), createdAt: now, updatedAt: now, deletedAt: null };
}

export function makeAccount(input: Input<Account, 'name' | 'type'>): Account {
  return {
    ...baseRecord(),
    initialBalanceCents: 0,
    color: '#7a8b6f',
    archived: false,
    ...input,
  };
}

export function makeCard(input: Input<Card, 'name' | 'closingDay' | 'dueDay'>): Card {
  return {
    ...baseRecord(),
    limitCents: 0,
    paymentAccountId: null,
    color: '#b4532a',
    archived: false,
    ...input,
  };
}

export function makeCategory(input: Input<Category, 'kind'>): Category {
  return {
    ...baseRecord(),
    name: '',
    systemKey: null,
    color: '#8a8173',
    icon: 'circle',
    parentId: null,
    ...input,
  };
}

export function makeTransaction(
  input: Input<Transaction, 'type' | 'amountCents' | 'date'>,
): Transaction {
  return {
    ...baseRecord(),
    accountId: null,
    cardId: null,
    toAccountId: null,
    toCardId: null,
    categoryId: null,
    description: '',
    notes: '',
    tags: [],
    installmentGroupId: null,
    installmentIndex: null,
    installmentCount: null,
    recurrenceId: null,
    importId: null,
    externalId: null,
    invoiceMonth: null,
    ...input,
  };
}

export function makeRecurrence(
  input: Input<Recurrence, 'type' | 'amountCents' | 'frequency' | 'startDate'>,
): Recurrence {
  return {
    ...baseRecord(),
    description: '',
    categoryId: null,
    accountId: null,
    cardId: null,
    interval: 1,
    dayOfMonth: null,
    weekday: null,
    endDate: null,
    active: true,
    ...input,
  };
}

export function makeBudget(
  input: Input<Budget, 'categoryId' | 'amountCents' | 'startMonth'>,
): Budget {
  return { ...baseRecord(), rollover: false, ...input };
}

export function makeGoal(input: Input<Goal, 'name' | 'targetCents'>): Goal {
  return {
    ...baseRecord(),
    targetDate: null,
    accountId: null,
    savedCents: 0,
    monthlyContributionCents: 0,
    color: '#5f7d6b',
    icon: 'target',
    ...input,
  };
}

export function makeRule(input: Input<Rule, 'pattern' | 'categoryId'>): Rule {
  return { ...baseRecord(), hits: 1, ...input };
}
