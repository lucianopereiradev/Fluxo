import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getDb } from '@/db';
import { today as todayLocal, type LocalDate } from '@/domain/dates';
import type {
  Account,
  Budget,
  Card,
  Category,
  Goal,
  Recurrence,
  Rule,
  SettingRecord,
  Transaction,
} from '@/domain/types';
import { bootstrap } from './bootstrap';

export interface FinanceData {
  ready: boolean;
  today: LocalDate;
  accounts: Account[];
  cards: Card[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  rules: Rule[];
  settings: Map<string, unknown>;
  accountById: Map<string, Account>;
  cardById: Map<string, Card>;
  categoryById: Map<string, Category>;
}

const EMPTY: Omit<FinanceData, 'today'> = {
  ready: false,
  accounts: [],
  cards: [],
  categories: [],
  transactions: [],
  recurrences: [],
  budgets: [],
  goals: [],
  rules: [],
  settings: new Map(),
  accountById: new Map(),
  cardById: new Map(),
  categoryById: new Map(),
};

export const FinanceContext = createContext<FinanceData>({ ...EMPTY, today: todayLocal() });

const alive = <T extends { deletedAt: string | null }>(rows: T[]) =>
  rows.filter((r) => r.deletedAt === null);

/** The day changes at local midnight; re-render so "today" never goes stale. */
function useToday(): LocalDate {
  const [value, setValue] = useState(todayLocal);
  useEffect(() => {
    const id = window.setInterval(() => setValue(todayLocal()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  return value;
}

/**
 * Loads every live record once into memory and keeps it in sync with IndexedDB.
 * Personal finance data is small (thousands of rows), so pure domain functions can run
 * over plain arrays instead of hand-written queries.
 */
export function FinanceProvider({ children }: { children: ReactNode }) {
  const today = useToday();
  // Seeds categories and records due recurring entries; the UI does not wait for it.
  useEffect(() => {
    bootstrap().catch((error: unknown) => console.error('bootstrap failed', error));
  }, [today]);

  const raw = useLiveQuery(async () => {
    const db = getDb();
    const [
      accounts,
      cards,
      categories,
      transactions,
      recurrences,
      budgets,
      goals,
      rules,
      settings,
    ] = await Promise.all([
      db.accounts.toArray(),
      db.cards.toArray(),
      db.categories.toArray(),
      db.transactions.toArray(),
      db.recurrences.toArray(),
      db.budgets.toArray(),
      db.goals.toArray(),
      db.rules.toArray(),
      db.settings.toArray(),
    ]);
    return {
      accounts,
      cards,
      categories,
      transactions,
      recurrences,
      budgets,
      goals,
      rules,
      settings,
    };
  });

  const value = useMemo<FinanceData>(() => {
    if (!raw) return { ...EMPTY, today };
    const accounts = alive(raw.accounts).sort((a, b) => a.name.localeCompare(b.name));
    const cards = alive(raw.cards).sort((a, b) => a.name.localeCompare(b.name));
    const categories = alive(raw.categories);
    const transactions = alive(raw.transactions).sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    return {
      ready: true,
      today,
      accounts,
      cards,
      categories,
      transactions,
      recurrences: alive(raw.recurrences),
      budgets: alive(raw.budgets),
      goals: alive(raw.goals),
      rules: alive(raw.rules),
      settings: new Map(alive(raw.settings as SettingRecord[]).map((s) => [s.id, s.value])),
      accountById: new Map(accounts.map((a) => [a.id, a])),
      cardById: new Map(cards.map((c) => [c.id, c])),
      categoryById: new Map(categories.map((c) => [c.id, c])),
    };
  }, [raw, today]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}
