import { describe, expect, it } from 'vitest';
import { installmentsInScope, planInstallments } from './installments';
import { invoiceMonthFor } from './invoices';
import { sumCents } from './money';
import { makeTransaction } from './records';

describe('planInstallments', () => {
  it('splits the total with the remainder on the first installment', () => {
    const plan = planInstallments({ totalCents: 10000, count: 3, purchaseDate: '2026-01-15' });
    expect(plan.map((p) => p.amountCents)).toEqual([3334, 3333, 3333]);
    expect(plan.map((p) => p.date)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(plan.map((p) => `${p.index}/${p.count}`)).toEqual(['1/3', '2/3', '3/3']);
  });

  it('places each installment in consecutive invoices', () => {
    const plan = planInstallments({
      totalCents: 60000,
      count: 3,
      purchaseDate: '2026-03-10',
      closingDay: 10,
    });
    expect(plan.map((p) => invoiceMonthFor(p.date, 10))).toEqual(['2026-04', '2026-05', '2026-06']);
  });

  it('keeps consecutive invoices when short months clamp the day', () => {
    // Bought on Jan 30, closing on the 31st: Feb 28 would otherwise hit February's closing.
    const plan = planInstallments({
      totalCents: 40000,
      count: 4,
      purchaseDate: '2026-01-30',
      closingDay: 31,
    });
    expect(plan.map((p) => invoiceMonthFor(p.date, 31))).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
    expect(plan[1]!.date).toBe('2026-02-27');
  });

  it('crosses the year boundary', () => {
    const plan = planInstallments({
      totalCents: 30000,
      count: 3,
      purchaseDate: '2026-11-20',
      closingDay: 5,
    });
    expect(plan.map((p) => invoiceMonthFor(p.date, 5))).toEqual(['2026-12', '2027-01', '2027-02']);
  });

  it('always sums to the purchase total', () => {
    for (let n = 1; n <= 18; n++) {
      const plan = planInstallments({
        totalCents: 99999,
        count: n,
        purchaseDate: '2026-05-31',
        closingDay: 29,
      });
      expect(sumCents(plan.map((p) => p.amountCents))).toBe(99999);
      const invoices = plan.map((p) => invoiceMonthFor(p.date, 29));
      expect(new Set(invoices).size).toBe(n);
    }
  });
});

describe('installmentsInScope', () => {
  const group = 'g1';
  const all = [1, 2, 3, 4].map((i) =>
    makeTransaction({
      type: 'expense',
      amountCents: 100,
      date: `2026-0${i}-01`,
      installmentGroupId: group,
      installmentIndex: i,
      installmentCount: 4,
    }),
  );

  it('returns only the chosen installment', () => {
    expect(installmentsInScope(all, all[1]!, 'this')).toEqual([all[1]]);
  });

  it('returns this and the following installments', () => {
    expect(installmentsInScope(all, all[1]!, 'thisAndNext').map((t) => t.installmentIndex)).toEqual(
      [2, 3, 4],
    );
  });
});
