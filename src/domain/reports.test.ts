import { describe, expect, it } from 'vitest';
import { makeCategory, makeTransaction } from './records';
import {
  categoryTotals,
  categoryTrend,
  monthlyTotals,
  sankeyGraph,
  SANKEY_DEFICIT,
  SANKEY_HUB,
  SANKEY_SAVINGS,
} from './reports';

const salary = makeCategory({ kind: 'income', name: 'Salary' });
const food = makeCategory({ kind: 'expense', name: 'Food' });
const restaurants = makeCategory({ kind: 'expense', name: 'Restaurants', parentId: food.id });
const rent = makeCategory({ kind: 'expense', name: 'Rent' });
const categories = [salary, food, restaurants, rent];

const tx = (
  type: 'income' | 'expense',
  amountCents: number,
  date: string,
  categoryId: string | null,
) => makeTransaction({ type, amountCents, date, categoryId, accountId: 'a' });

const data = [
  tx('income', 500000, '2026-09-05', salary.id),
  tx('expense', 180000, '2026-09-10', rent.id),
  tx('expense', 40000, '2026-09-12', restaurants.id),
  tx('expense', 30000, '2026-09-20', food.id),
  tx('income', 500000, '2026-10-05', salary.id),
  tx('expense', 180000, '2026-10-10', rent.id),
  tx('expense', 20000, '2026-10-11', null),
  makeTransaction({
    type: 'transfer',
    amountCents: 99999,
    date: '2026-10-12',
    accountId: 'a',
    toAccountId: 'b',
  }),
];

describe('reports', () => {
  it('computes monthly totals and savings rate, ignoring transfers', () => {
    const totals = monthlyTotals(data, '2026-08', '2026-10');
    expect(totals.map((t) => [t.month, t.incomeCents, t.expenseCents])).toEqual([
      ['2026-08', 0, 0],
      ['2026-09', 500000, 250000],
      ['2026-10', 500000, 200000],
    ]);
    expect(totals[0]!.savingsRate).toBeNull();
    expect(totals[1]!.savingsRate).toBe(0.5);
    expect(totals[2]!.savingsRate).toBe(0.6);
  });

  it('rolls subcategories up to their parent', () => {
    const totals = categoryTotals(data, categories, 'expense', '2026-09', '2026-09');
    expect(totals).toEqual([
      { categoryId: rent.id, cents: 180000 },
      { categoryId: food.id, cents: 70000 },
    ]);
  });

  it('builds a category trend', () => {
    expect(categoryTrend(data, categories, food.id, '2026-09', '2026-10')).toEqual([
      { month: '2026-09', cents: 70000 },
      { month: '2026-10', cents: 0 },
    ]);
  });

  it('builds a Sankey graph with savings', () => {
    const g = sankeyGraph(data, categories, '2026-09', '2026-10');
    const sum = (pred: (l: (typeof g.links)[number]) => boolean) =>
      g.links.filter(pred).reduce((s, l) => s + l.cents, 0);
    expect(sum((l) => l.target === SANKEY_HUB)).toBe(1000000);
    expect(sum((l) => l.source === SANKEY_HUB)).toBe(1000000);
    expect(g.links.find((l) => l.target === SANKEY_SAVINGS)?.cents).toBe(550000);
    expect(g.nodes.some((n) => n.id === 'out:__none__')).toBe(true);
  });

  it('adds a deficit node when spending exceeds income', () => {
    const g = sankeyGraph(
      [tx('income', 100, '2026-09-01', salary.id), tx('expense', 300, '2026-09-02', rent.id)],
      categories,
      '2026-09',
      '2026-09',
    );
    expect(g.links.find((l) => l.source === SANKEY_DEFICIT)?.cents).toBe(200);
    expect(g.nodes.some((n) => n.id === SANKEY_SAVINGS)).toBe(false);
  });
});
