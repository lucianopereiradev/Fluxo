import { describe, expect, it } from 'vitest';
import { budgetLevel, budgetStatus } from './budgets';
import { makeBudget, makeCategory, makeTransaction } from './records';

const food = makeCategory({ kind: 'expense', name: 'Food' });
const restaurants = makeCategory({ kind: 'expense', name: 'Restaurants', parentId: food.id });
const other = makeCategory({ kind: 'expense', name: 'Other' });
const categories = [food, restaurants, other];

const spend = (date: string, amountCents: number, categoryId = food.id) =>
  makeTransaction({ type: 'expense', amountCents, date, categoryId, accountId: 'a' });

describe('budgets', () => {
  it('sums spending of the category and its children in the month', () => {
    const budget = makeBudget({ categoryId: food.id, amountCents: 100000, startMonth: '2026-11' });
    const txs = [
      spend('2026-11-02', 20000),
      spend('2026-11-03', 10000, restaurants.id),
      spend('2026-11-04', 99999, other.id),
      spend('2026-10-30', 50000),
    ];
    const s = budgetStatus(budget, categories, txs, '2026-11');
    expect(s.spentCents).toBe(30000);
    expect(s.leftCents).toBe(70000);
    expect(s.level).toBe('ok');
  });

  it('warns at 80% and flags over 100%', () => {
    expect(budgetLevel(0.79)).toBe('ok');
    expect(budgetLevel(0.8)).toBe('warning');
    expect(budgetLevel(1)).toBe('warning');
    expect(budgetLevel(1.01)).toBe('over');
  });

  it('carries unspent money forward when rollover is on', () => {
    const budget = makeBudget({
      categoryId: food.id,
      amountCents: 100000,
      startMonth: '2026-09',
      rollover: true,
    });
    const txs = [
      spend('2026-09-10', 70000),
      spend('2026-10-10', 110000),
      spend('2026-11-10', 50000),
    ];
    // Sep: 30000 left → Oct available 130000, spent 110000 → 20000 carried to Nov.
    const s = budgetStatus(budget, categories, txs, '2026-11');
    expect(s.carriedCents).toBe(20000);
    expect(s.leftCents).toBe(70000);
  });

  it('does not carry overspending', () => {
    const budget = makeBudget({
      categoryId: food.id,
      amountCents: 100000,
      startMonth: '2026-10',
      rollover: true,
    });
    const s = budgetStatus(budget, categories, [spend('2026-10-10', 150000)], '2026-11');
    expect(s.carriedCents).toBe(0);
  });

  it('ignores deleted transactions', () => {
    const budget = makeBudget({ categoryId: food.id, amountCents: 100000, startMonth: '2026-11' });
    const deleted = { ...spend('2026-11-02', 20000), deletedAt: '2026-11-03T00:00:00Z' };
    expect(budgetStatus(budget, categories, [deleted], '2026-11').spentCents).toBe(0);
  });
});
