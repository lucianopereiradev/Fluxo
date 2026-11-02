import { describe, expect, it } from 'vitest';
import { snapshotSchema } from '@/db/schemas';
import { accountBalance } from '../balances';
import { budgetStatus } from '../budgets';
import { safeToSpend } from '../safeToSpend';
import { addMonthsToMonth, monthOf } from '../dates';
import { computeInvoices } from '../invoices';
import { materializeRecurrences } from '../recurrences';
import { generateDemo, mulberry32 } from './generate';

const TODAY = '2026-11-15';

describe('demo generator', () => {
  it('is deterministic for the same seed and day', () => {
    const a = generateDemo({ today: TODAY, language: 'en' });
    const b = generateDemo({ today: TODAY, language: 'en' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('changes with the seed', () => {
    const a = generateDemo({ today: TODAY, seed: 1 });
    const b = generateDemo({ today: TODAY, seed: 2 });
    expect(JSON.stringify(a.transactions)).not.toBe(JSON.stringify(b.transactions));
  });

  it('the PRNG is stable across platforms', () => {
    const r = mulberry32(42);
    expect([r(), r(), r()].map((x) => x.toFixed(6))).toEqual(['0.601104', '0.448291', '0.852466']);
  });

  it('produces valid records that pass backup validation', () => {
    for (const day of [TODAY, '2026-11-01', '2027-02-28', '2026-12-31']) {
      const data = generateDemo({ today: day, language: 'pt-BR' });
      expect(snapshotSchema.safeParse(data).success).toBe(true);
      expect(new Set(data.transactions.map((t) => t.id)).size).toBe(data.transactions.length);
    }
  });

  it('covers about six months with the expected features', () => {
    const data = generateDemo({ today: TODAY });
    const months = new Set(
      data.transactions.filter((t) => t.date <= TODAY).map((t) => monthOf(t.date)),
    );
    expect(months.size).toBe(6);
    expect([...months].sort()[0]).toBe(addMonthsToMonth('2026-11', -5));
    expect(data.transactions.some((t) => t.installmentGroupId && t.date > TODAY)).toBe(true);
    expect(data.transactions.some((t) => t.type === 'transfer' && t.toCardId)).toBe(true);
    expect(data.goals).toHaveLength(2);
    expect(data.recurrences.length).toBeGreaterThanOrEqual(5);
  });

  it('includes a budget over its limit and one close to it this month', () => {
    for (const day of [TODAY, '2026-11-01', '2026-11-02']) {
      const data = generateDemo({ today: day });
      const levels = data.budgets.map(
        (b) => budgetStatus(b, data.categories, data.transactions, monthOf(day)).level,
      );
      expect(levels).toContain('over');
      expect(levels).toContain('warning');
    }
  });

  it('pays past invoices and leaves upcoming ones open', () => {
    const data = generateDemo({ today: TODAY });
    const invoices = computeInvoices(data.cards[0]!, data.transactions, TODAY);
    for (const inv of invoices) {
      if (inv.dueDate < TODAY && inv.totalCents > 0) expect(inv.status).toBe('paid');
    }
    expect(invoices.some((i) => i.status === 'open' || i.status === 'closed')).toBe(true);
  });

  it('looks healthy: no negative accounts and something safe to spend', () => {
    for (const day of ['2026-11-01', TODAY, '2026-11-30', '2027-03-04']) {
      const data = generateDemo({ today: day });
      for (const account of data.accounts) {
        expect(accountBalance(account, data.transactions, day)).toBeGreaterThan(0);
      }
      const sts = safeToSpend({ today: day, ...data });
      expect(sts.perDayCents).toBeGreaterThan(0);
    }
  });

  it('has nothing left to materialize on first open', () => {
    const data = generateDemo({ today: TODAY });
    expect(materializeRecurrences(data.recurrences, data.transactions, TODAY)).toEqual([]);
  });
});
