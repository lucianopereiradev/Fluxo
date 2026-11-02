import { describe, expect, it } from 'vitest';
import {
  availableLimit,
  computeInvoices,
  dueDateOf,
  invoiceMonthFor,
  invoicePeriod,
} from './invoices';
import { planInstallments } from './installments';
import { makeCard, makeTransaction } from './records';

const card = makeCard({ name: 'Nubank', closingDay: 10, dueDay: 17, limitCents: 500000 });

const purchase = (date: string, amountCents: number, cardId = card.id) =>
  makeTransaction({ type: 'expense', amountCents, date, cardId });

const payment = (date: string, amountCents: number, invoiceMonth: string | null = null) =>
  makeTransaction({
    type: 'transfer',
    amountCents,
    date,
    accountId: 'checking',
    toCardId: card.id,
    invoiceMonth,
  });

describe('invoice month', () => {
  it('purchases before the closing day stay in the current invoice', () => {
    expect(invoiceMonthFor('2026-03-09', 10)).toBe('2026-03');
  });

  it('a purchase on the closing day goes to the next invoice', () => {
    expect(invoiceMonthFor('2026-03-10', 10)).toBe('2026-04');
    expect(invoiceMonthFor('2026-03-11', 10)).toBe('2026-04');
  });

  it('turns the year', () => {
    expect(invoiceMonthFor('2026-12-10', 10)).toBe('2027-01');
    expect(invoiceMonthFor('2026-12-31', 5)).toBe('2027-01');
    expect(dueDateOf('2026-12', { closingDay: 25, dueDay: 5 })).toBe('2027-01-05');
  });

  it.each([
    // closingDay, date, expected invoice
    [29, '2026-02-27', '2026-02'],
    [29, '2026-02-28', '2026-03'], // Feb 2026 has 28 days: closing clamps to the 28th
    [29, '2028-02-28', '2028-02'], // leap year: closes on the 29th
    [29, '2028-02-29', '2028-03'],
    [30, '2026-02-28', '2026-03'],
    [30, '2026-04-29', '2026-04'],
    [30, '2026-04-30', '2026-05'],
    [31, '2026-01-30', '2026-01'],
    [31, '2026-01-31', '2026-02'],
    [31, '2026-02-27', '2026-02'],
    [31, '2026-02-28', '2026-03'],
    [31, '2026-04-30', '2026-05'],
    [31, '2026-12-31', '2027-01'],
  ])('closing day %i: %s belongs to %s', (closingDay, date, expected) => {
    expect(invoiceMonthFor(date, closingDay)).toBe(expected);
  });

  it('computes due dates in the same or the next month', () => {
    expect(dueDateOf('2026-03', { closingDay: 10, dueDay: 17 })).toBe('2026-03-17');
    expect(dueDateOf('2026-03', { closingDay: 25, dueDay: 5 })).toBe('2026-04-05');
    expect(dueDateOf('2026-03', { closingDay: 10, dueDay: 10 })).toBe('2026-04-10');
    expect(dueDateOf('2026-01', { closingDay: 20, dueDay: 31 })).toBe('2026-01-31');
    expect(dueDateOf('2026-02', { closingDay: 20, dueDay: 31 })).toBe('2026-02-28');
  });

  it('describes the purchase period of an invoice', () => {
    expect(invoicePeriod('2026-03', 31)).toEqual({
      startDate: '2026-02-28',
      endDate: '2026-03-30',
      closingDate: '2026-03-31',
    });
  });
});

describe('computeInvoices', () => {
  it('groups purchases and sets the status relative to today', () => {
    const txs = [
      purchase('2026-02-15', 10000),
      purchase('2026-03-05', 5000),
      purchase('2026-03-12', 2000),
    ];
    const invoices = computeInvoices(card, txs, '2026-03-20');
    const march = invoices.find((i) => i.month === '2026-03')!;
    const april = invoices.find((i) => i.month === '2026-04')!;
    expect(march.totalCents).toBe(15000);
    expect(march.status).toBe('closed');
    expect(march.closingDate).toBe('2026-03-10');
    expect(march.dueDate).toBe('2026-03-17');
    expect(march.overdue).toBe(true);
    expect(april.totalCents).toBe(2000);
    expect(april.status).toBe('open');
  });

  it('marks future invoices for installments', () => {
    const plan = planInstallments({
      totalCents: 60000,
      count: 3,
      purchaseDate: '2026-03-01',
      closingDay: 10,
    });
    const txs = plan.map((p) => purchase(p.date, p.amountCents));
    const invoices = computeInvoices(card, txs, '2026-03-02');
    expect(invoices.map((i) => [i.month, i.status, i.totalCents])).toEqual([
      ['2026-03', 'open', 20000],
      ['2026-04', 'future', 20000],
      ['2026-05', 'future', 20000],
    ]);
  });

  it('supports partial payments and keeps the remaining balance', () => {
    const txs = [purchase('2026-03-01', 30000), payment('2026-03-15', 10000, '2026-03')];
    const march = computeInvoices(card, txs, '2026-03-16').find((i) => i.month === '2026-03')!;
    expect(march.paidCents).toBe(10000);
    expect(march.remainingCents).toBe(20000);
    expect(march.status).toBe('closed');
  });

  it('becomes paid when fully settled', () => {
    const txs = [purchase('2026-03-01', 30000), payment('2026-03-15', 30000, '2026-03')];
    const march = computeInvoices(card, txs, '2026-03-16').find((i) => i.month === '2026-03')!;
    expect(march.status).toBe('paid');
    expect(march.remainingCents).toBe(0);
  });

  it('assigns payments without an explicit invoice to the last closed one', () => {
    const txs = [purchase('2026-03-01', 30000), payment('2026-03-15', 30000)];
    const march = computeInvoices(card, txs, '2026-03-16').find((i) => i.month === '2026-03')!;
    expect(march.status).toBe('paid');
  });

  it('subtracts refunds (credits) from the total', () => {
    const refund = makeTransaction({
      type: 'income',
      amountCents: 1000,
      date: '2026-03-03',
      cardId: card.id,
    });
    const txs = [purchase('2026-03-01', 5000), refund];
    const march = computeInvoices(card, txs, '2026-03-05')[0]!;
    expect(march.totalCents).toBe(4000);
  });

  it('ignores deleted transactions and other cards', () => {
    const deleted = { ...purchase('2026-03-01', 5000), deletedAt: '2026-03-02T00:00:00.000Z' };
    const other = purchase('2026-03-01', 7000, 'other-card');
    const invoices = computeInvoices(card, [deleted, other], '2026-03-05');
    expect(invoices).toHaveLength(1);
    expect(invoices[0]!.totalCents).toBe(0);
  });

  it('always includes the current open invoice', () => {
    const invoices = computeInvoices(card, [], '2026-11-01');
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({ month: '2026-11', status: 'open', totalCents: 0 });
  });
});

describe('available limit', () => {
  it('discounts future installments and payments', () => {
    const plan = planInstallments({
      totalCents: 120000,
      count: 12,
      purchaseDate: '2026-03-01',
      closingDay: 10,
    });
    const txs = [
      ...plan.map((p) => purchase(p.date, p.amountCents)),
      payment('2026-03-15', 10000, '2026-03'),
    ];
    expect(availableLimit(card, txs)).toBe(500000 - 120000 + 10000);
  });
});
