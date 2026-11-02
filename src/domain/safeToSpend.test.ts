import { describe, expect, it } from 'vitest';
import { makeAccount, makeCard, makeGoal, makeRecurrence, makeTransaction } from './records';
import { safeToSpend } from './safeToSpend';

const checking = makeAccount({ name: 'Checking', type: 'checking', initialBalanceCents: 200000 });
const wallet = makeAccount({ name: 'Wallet', type: 'wallet', initialBalanceCents: 10000 });
const savings = makeAccount({ name: 'Savings', type: 'savings', initialBalanceCents: 500000 });
const card = makeCard({ name: 'Card', closingDay: 10, dueDay: 20, paymentAccountId: checking.id });

const base = {
  accounts: [checking, wallet, savings],
  cards: [card],
  transactions: [],
  recurrences: [],
  goals: [],
};

describe('safeToSpend', () => {
  it('divides the liquid balance by the days left, today included', () => {
    const r = safeToSpend({ ...base, today: '2026-11-21' });
    expect(r.liquidBalanceCents).toBe(210000);
    expect(r.daysLeft).toBe(10);
    expect(r.perDayCents).toBe(21000);
  });

  it('counts the last day of the month as one day', () => {
    const r = safeToSpend({ ...base, today: '2026-11-30' });
    expect(r.daysLeft).toBe(1);
    expect(r.perDayCents).toBe(210000);
  });

  it('subtracts recurring expenses still due this month', () => {
    const internet = makeRecurrence({
      type: 'expense',
      amountCents: 10000,
      frequency: 'monthly',
      dayOfMonth: 25,
      startDate: '2026-01-25',
      accountId: checking.id,
    });
    const paidAlready = makeRecurrence({
      type: 'expense',
      amountCents: 99999,
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-01-05',
      accountId: checking.id,
    });
    const r = safeToSpend({ ...base, today: '2026-11-21', recurrences: [internet, paidAlready] });
    expect(r.upcomingExpensesCents).toBe(10000);
    expect(r.availableCents).toBe(200000);
  });

  it('subtracts unpaid invoices due by the end of the month', () => {
    const purchase = makeTransaction({
      type: 'expense',
      amountCents: 50000,
      date: '2026-11-05',
      cardId: card.id,
    });
    const partial = makeTransaction({
      type: 'transfer',
      amountCents: 20000,
      date: '2026-11-12',
      accountId: checking.id,
      toCardId: card.id,
      invoiceMonth: '2026-11',
    });
    const r = safeToSpend({ ...base, today: '2026-11-15', transactions: [purchase, partial] });
    expect(r.unpaidInvoicesCents).toBe(30000);
    expect(r.liquidBalanceCents).toBe(190000);
    expect(r.availableCents).toBe(160000);
  });

  it('ignores invoices that are due next month', () => {
    const purchase = makeTransaction({
      type: 'expense',
      amountCents: 50000,
      date: '2026-11-15',
      cardId: card.id,
    });
    const r = safeToSpend({ ...base, today: '2026-11-16', transactions: [purchase] });
    expect(r.unpaidInvoicesCents).toBe(0);
  });

  it('subtracts the part of planned goal contributions not yet made', () => {
    const goal = makeGoal({
      name: 'Trip',
      targetCents: 1000000,
      monthlyContributionCents: 50000,
      accountId: savings.id,
    });
    const contributed = makeTransaction({
      type: 'transfer',
      amountCents: 20000,
      date: '2026-11-02',
      accountId: checking.id,
      toAccountId: savings.id,
    });
    const r = safeToSpend({
      ...base,
      today: '2026-11-21',
      goals: [goal],
      transactions: [contributed],
    });
    expect(r.goalContributionsCents).toBe(30000);
    expect(r.availableCents).toBe(190000 - 30000);
  });

  it('never reports a negative amount as spendable and exposes the deficit', () => {
    const big = makeRecurrence({
      type: 'expense',
      amountCents: 300000,
      frequency: 'monthly',
      dayOfMonth: 28,
      startDate: '2026-01-28',
      accountId: checking.id,
    });
    const r = safeToSpend({ ...base, today: '2026-11-21', recurrences: [big] });
    expect(r.availableCents).toBe(-90000);
    expect(r.perDayCents).toBe(0);
    expect(r.deficitCents).toBe(90000);
  });

  it('rounds the daily amount down to whole cents', () => {
    const odd = makeAccount({ name: 'Odd', type: 'checking', initialBalanceCents: 1000 });
    const r = safeToSpend({ ...base, accounts: [odd], today: '2026-11-28' });
    expect(r.daysLeft).toBe(3);
    expect(r.perDayCents).toBe(333);
  });

  it('explains every line of the calculation', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 5000,
      description: 'Gym',
      frequency: 'monthly',
      dayOfMonth: 25,
      startDate: '2026-01-25',
      accountId: checking.id,
    });
    const r = safeToSpend({ ...base, today: '2026-11-21', recurrences: [rec] });
    expect(r.lines).toEqual([
      { kind: 'recurring', label: 'Gym', date: '2026-11-25', amountCents: 5000, refId: rec.id },
    ]);
  });
});
