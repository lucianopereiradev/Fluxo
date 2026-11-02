import { eachMonth, monthOf, type YearMonth } from './dates';
import type { Cents } from './money';
import type { Category, CategoryKind, Transaction } from './types';

export interface MonthTotals {
  month: YearMonth;
  incomeCents: Cents;
  expenseCents: Cents;
  netCents: Cents;
  /** Share of income kept (null when there was no income). */
  savingsRate: number | null;
}

const counts = (t: Transaction) => t.deletedAt === null && t.type !== 'transfer';

/** Income, expenses and savings rate per month in [from, to]. */
export function monthlyTotals(
  transactions: readonly Transaction[],
  from: YearMonth,
  to: YearMonth,
): MonthTotals[] {
  const map = new Map(eachMonth(from, to).map((m) => [m, { income: 0, expense: 0 }]));
  for (const t of transactions) {
    if (!counts(t)) continue;
    const entry = map.get(monthOf(t.date));
    if (!entry) continue;
    if (t.type === 'income') entry.income += t.amountCents;
    else entry.expense += t.amountCents;
  }
  return [...map.entries()].map(([month, { income, expense }]) => ({
    month,
    incomeCents: income,
    expenseCents: expense,
    netCents: income - expense,
    savingsRate: income > 0 ? (income - expense) / income : null,
  }));
}

/** Rolls a category up to its top-level parent. */
export function rootCategoryId(
  categoryId: string | null,
  byId: ReadonlyMap<string, Category>,
): string | null {
  let current = categoryId ? byId.get(categoryId) : undefined;
  for (let depth = 0; current?.parentId && depth < 8; depth++) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current?.id ?? categoryId;
}

/** Totals per top-level category for one kind within [from, to] months. */
export function categoryTotals(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  kind: CategoryKind,
  from: YearMonth,
  to: YearMonth,
): { categoryId: string | null; cents: Cents }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<string | null, Cents>();
  for (const t of transactions) {
    if (!counts(t) || t.type !== kind) continue;
    const m = monthOf(t.date);
    if (m < from || m > to) continue;
    const root = rootCategoryId(t.categoryId, byId);
    totals.set(root, (totals.get(root) ?? 0) + t.amountCents);
  }
  return [...totals.entries()]
    .map(([categoryId, cents]) => ({ categoryId, cents }))
    .sort((a, b) => b.cents - a.cents);
}

/** Monthly spending of one category (and its children). */
export function categoryTrend(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  categoryId: string,
  from: YearMonth,
  to: YearMonth,
): { month: YearMonth; cents: Cents }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const map = new Map(eachMonth(from, to).map((m) => [m, 0]));
  for (const t of transactions) {
    if (!counts(t) || rootCategoryId(t.categoryId, byId) !== categoryId) continue;
    const m = monthOf(t.date);
    if (map.has(m)) map.set(m, map.get(m)! + t.amountCents);
  }
  return [...map.entries()].map(([month, cents]) => ({ month, cents }));
}

export interface SankeyGraph {
  nodes: { id: string; kind: 'income' | 'hub' | 'expense' | 'savings' | 'deficit' }[];
  links: { source: string; target: string; cents: Cents }[];
}

export const SANKEY_HUB = '__hub__';
export const SANKEY_SAVINGS = '__savings__';
export const SANKEY_DEFICIT = '__deficit__';
export const SANKEY_UNCATEGORIZED = '__none__';

/**
 * Income categories → a central "budget" node → expense categories (+ savings, or a deficit
 * input when expenses exceed income). Always a DAG, as Sankey diagrams require.
 */
export function sankeyGraph(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  from: YearMonth,
  to: YearMonth,
): SankeyGraph {
  const income = categoryTotals(transactions, categories, 'income', from, to);
  const expense = categoryTotals(transactions, categories, 'expense', from, to);
  const totalIn = income.reduce((s, x) => s + x.cents, 0);
  const totalOut = expense.reduce((s, x) => s + x.cents, 0);
  const key = (id: string | null, side: string) => `${side}:${id ?? SANKEY_UNCATEGORIZED}`;

  const nodes: SankeyGraph['nodes'] = [{ id: SANKEY_HUB, kind: 'hub' }];
  const links: SankeyGraph['links'] = [];
  for (const i of income) {
    nodes.push({ id: key(i.categoryId, 'in'), kind: 'income' });
    links.push({ source: key(i.categoryId, 'in'), target: SANKEY_HUB, cents: i.cents });
  }
  for (const e of expense) {
    nodes.push({ id: key(e.categoryId, 'out'), kind: 'expense' });
    links.push({ source: SANKEY_HUB, target: key(e.categoryId, 'out'), cents: e.cents });
  }
  if (totalIn > totalOut) {
    nodes.push({ id: SANKEY_SAVINGS, kind: 'savings' });
    links.push({ source: SANKEY_HUB, target: SANKEY_SAVINGS, cents: totalIn - totalOut });
  } else if (totalOut > totalIn) {
    nodes.push({ id: SANKEY_DEFICIT, kind: 'deficit' });
    links.push({ source: SANKEY_DEFICIT, target: SANKEY_HUB, cents: totalOut - totalIn });
  }
  return { nodes, links: links.filter((l) => l.cents > 0) };
}
