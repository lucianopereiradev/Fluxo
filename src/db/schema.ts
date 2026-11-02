import Dexie, { type EntityTable } from 'dexie';
import type {
  Account,
  Budget,
  Card,
  Category,
  Goal,
  Recurrence,
  Rule,
  SettingRecord,
  SyncStateRecord,
  Transaction,
} from '@/domain/types';

export const REAL_DB_NAME = 'fluxo';
export const DEMO_DB_NAME = 'fluxo-demo';

/**
 * IndexedDB schema. Every version bump must keep the previous `stores()` definitions and
 * add an `upgrade()` when existing rows need to change shape.
 */
export class FluxoDatabase extends Dexie {
  accounts!: EntityTable<Account, 'id'>;
  cards!: EntityTable<Card, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  transactions!: EntityTable<Transaction, 'id'>;
  recurrences!: EntityTable<Recurrence, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  rules!: EntityTable<Rule, 'id'>;
  settings!: EntityTable<SettingRecord, 'id'>;
  syncState!: EntityTable<SyncStateRecord, 'id'>;

  constructor(name: string) {
    super(name);

    this.version(1).stores({
      accounts: 'id, type, updatedAt',
      cards: 'id, updatedAt',
      categories: 'id, kind, parentId, updatedAt',
      transactions:
        'id, date, type, accountId, cardId, categoryId, installmentGroupId, recurrenceId, importId, updatedAt, *tags',
      recurrences: 'id, updatedAt',
      budgets: 'id, categoryId, updatedAt',
      goals: 'id, updatedAt',
      rules: 'id, pattern, updatedAt',
      settings: 'id, updatedAt',
      syncState: 'id',
    });

    // v2: duplicate detection on import by bank id, and explicit bill-payment invoices.
    this.version(2)
      .stores({
        transactions:
          'id, date, type, accountId, cardId, toCardId, categoryId, installmentGroupId, recurrenceId, importId, externalId, updatedAt, *tags',
      })
      .upgrade((tx) =>
        tx
          .table('transactions')
          .toCollection()
          .modify((t: Partial<Transaction>) => {
            t.externalId ??= null;
            t.invoiceMonth ??= null;
          }),
      );
  }
}

export const DB_VERSION = 2;
