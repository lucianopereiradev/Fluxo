import { describe, expect, it } from 'vitest';
import { forecastBalance } from './forecast';
import { planInstallments } from './installments';
import { makeAccount, makeCard, makeRecurrence, makeTransaction } from './records';

const checking = makeAccount({ name: 'Checking', type: 'checking', initialBalanceCents: 300000 });
const savings = makeAccount({ name: 'Savings', type: 'savings', initialBalanceCents: 1000000 });
const card = makeCard({ name: 'Card', closingDay: 1, dueDay: 10, paymentAccountId: checking.id });

const salary = makeRecurrence({
  type: 'income',
  amountCents: 450000,
  description: 'Salary',
  frequency: 'monthly',
  dayOfMonth: 5,
  startDate: '2026-01-05',
  accountId: checking.id,
});
const rent = makeRecurrence({
  type: 'expense',
  amountCents: 180000,
  description: 'Rent',
  frequency: 'monthly',
  dayOfMonth: 10,
  startDate: '2026-01-10',
  accountId: checking.id,
});

describe('forecastBalance', () => {
  it('projects 91 points (today + 90 days) starting from the liquid balance', () => {
    const f = forecastBalance({
      today: '2026-11-01',
      accounts: [checking, savings],
      cards: [],
      transactions: [],
      recurrences: [],
    });
    expect(f.days).toHaveLength(91);
    expect(f.startBalanceCents).toBe(300000); // savings is not liquid
    expect(f.endBalanceCents).toBe(300000);
    expect(f.firstNegativeDate).toBeNull();
  });

  it('adds recurrences on their dates', () => {
    const f = forecastBalance({
      today: '2026-11-01',
      accounts: [checking],
      cards: [],
      transactions: [],
      recurrences: [salary, rent],
    });
    const at = (d: string) => f.days.find((x) => x.date === d)!.balanceCents;
    expect(at('2026-11-04')).toBe(300000);
    expect(at('2026-11-05')).toBe(750000);
    expect(at('2026-11-10')).toBe(570000);
    // three salaries and three rents within 90 days (Nov, Dec, Jan)
    expect(f.endBalanceCents).toBe(300000 + 3 * 450000 - 3 * 180000);
  });

  it('includes future installments through invoice due dates', () => {
    const plan = planInstallments({
      totalCents: 90000,
      count: 3,
      purchaseDate: '2026-10-20',
      closingDay: 1,
    });
    const txs = plan.map((p) =>
      makeTransaction({
        type: 'expense',
        amountCents: p.amountCents,
        date: p.date,
        cardId: card.id,
      }),
    );
    const f = forecastBalance({
      today: '2026-11-01',
      accounts: [checking],
      cards: [card],
      transactions: txs,
      recurrences: [],
    });
    const invoiceEvents = f.events.filter((e) => e.kind === 'invoice');
    expect(invoiceEvents.map((e) => [e.date, e.amountCents])).toEqual([
      ['2026-11-10', -30000],
      ['2026-12-10', -30000],
      ['2027-01-10', -30000],
    ]);
  });

  it('flags the first day the balance goes negative', () => {
    const big = makeTransaction({
      type: 'expense',
      amountCents: 400000,
      date: '2026-11-20',
      accountId: checking.id,
      description: 'Car repair',
    });
    const f = forecastBalance({
      today: '2026-11-01',
      accounts: [checking],
      cards: [],
      transactions: [big],
      recurrences: [],
    });
    expect(f.firstNegativeDate).toBe('2026-11-20');
    expect(f.minBalanceCents).toBe(-100000);
  });

  it('does not double count materialized recurrences', () => {
    const done = makeTransaction({
      type: 'income',
      amountCents: 450000,
      date: '2026-11-05',
      accountId: checking.id,
      recurrenceId: salary.id,
    });
    const f = forecastBalance({
      today: '2026-11-06',
      accounts: [checking],
      cards: [],
      transactions: [done],
      recurrences: [salary],
      days: 10,
    });
    expect(f.startBalanceCents).toBe(750000);
    expect(f.events).toHaveLength(0);
  });

  it('projects card subscriptions into invoices', () => {
    const streaming = makeRecurrence({
      type: 'expense',
      amountCents: 5590,
      frequency: 'monthly',
      dayOfMonth: 15,
      startDate: '2026-01-15',
      cardId: card.id,
    });
    const f = forecastBalance({
      today: '2026-11-01',
      accounts: [checking],
      cards: [card],
      transactions: [],
      recurrences: [streaming],
    });
    // Nov 15 → invoice closing Dec 1, due Dec 10; Dec 15 → due Jan 10.
    expect(f.events.filter((e) => e.kind === 'invoice').map((e) => e.date)).toEqual([
      '2026-12-10',
      '2027-01-10',
    ]);
  });
});
