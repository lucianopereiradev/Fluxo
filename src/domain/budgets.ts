import { addMonthsToMonth, monthOf, type YearMonth } from './dates';
import type { Cents } from './money';
import type { Budget, Category, Transaction } from './types';

export type BudgetLevel = 'ok' | 'warning' | 'over';

export const BUDGET_WARNING_RATIO = 0.8;

export interface BudgetStatus {
  budget: Budget;
  month: YearMonth;
  limitCents: Cents;
  carriedCents: Cents;
  spentCents: Cents;
  /** limit + carried − spent (negative when over budget). */
  leftCents: Cents;
  ratio: number;
  level: BudgetLevel;
}

/** A category and all its descendants. */
export function categoryFamily(categoryId: string, categories: readonly Category[]): Set<string> {
  const family = new Set([categoryId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of categories) {
      if (c.deletedAt === null && c.parentId && family.has(c.parentId) && !family.has(c.id)) {
        family.add(c.id);
        grew = true;
      }
    }
  }
  return family;
}

/** Expenses per month for a set of categories (card purchases count on their purchase date). */
export function spentByMonth(
  family: Set<string>,
  transactions: readonly Transaction[],
): Map<YearMonth, Cents> {
  const out = new Map<YearMonth, Cents>();
  for (const t of transactions) {
    if (t.deletedAt !== null || t.type !== 'expense' || !t.categoryId || !family.has(t.categoryId))
      continue;
    const m = monthOf(t.date);
    out.set(m, (out.get(m) ?? 0) + t.amountCents);
  }
  return out;
}

export function budgetLevel(ratio: number): BudgetLevel {
  if (ratio > 1) return 'over';
  if (ratio >= BUDGET_WARNING_RATIO) return 'warning';
  return 'ok';
}

export function budgetStatus(
  budget: Budget,
  categories: readonly Category[],
  transactions: readonly Transaction[],
  month: YearMonth,
): BudgetStatus {
  const spent = spentByMonth(categoryFamily(budget.categoryId, categories), transactions);

  // Rollover: unspent money carries forward month by month; overspending does not.
  let carriedCents = 0;
  if (budget.rollover) {
    for (let m = budget.startMonth; m < month; m = addMonthsToMonth(m, 1)) {
      carriedCents = Math.max(0, budget.amountCents + carriedCents - (spent.get(m) ?? 0));
    }
  }

  const spentCents = spent.get(month) ?? 0;
  const available = budget.amountCents + carriedCents;
  const ratio = available > 0 ? spentCents / available : spentCents > 0 ? Infinity : 0;
  return {
    budget,
    month,
    limitCents: budget.amountCents,
    carriedCents,
    spentCents,
    leftCents: available - spentCents,
    ratio,
    level: budgetLevel(ratio),
  };
}
