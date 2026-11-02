import { describe, expect, it } from 'vitest';
import { monthEvents, monthGrid } from './calendar';
import { makeCard, makeRecurrence, makeTransaction } from './records';

describe('calendar', () => {
  it('lays out a month in weeks', () => {
    const weeks = monthGrid('2026-11'); // Nov 1 2026 is a Sunday
    expect(weeks[0]![0]).toBe('2026-11-01');
    expect(weeks.flat().filter(Boolean)).toHaveLength(30);
    const mondayFirst = monthGrid('2026-11', 1);
    expect(mondayFirst[0]!.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(mondayFirst[0]![6]).toBe('2026-11-01');
  });

  it('collects recurrences, invoices and scheduled items, marking done ones', () => {
    const rent = makeRecurrence({
      type: 'expense',
      amountCents: 180000,
      description: 'Rent',
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-01-05',
      accountId: 'a',
    });
    const card = makeCard({ name: 'Card', closingDay: 1, dueDay: 10 });
    const purchase = makeTransaction({
      type: 'expense',
      amountCents: 5000,
      date: '2026-10-20',
      cardId: card.id,
    });
    const paidRent = makeTransaction({
      type: 'expense',
      amountCents: 180000,
      date: '2026-11-05',
      recurrenceId: rent.id,
      accountId: 'a',
    });
    const scheduled = makeTransaction({
      type: 'income',
      amountCents: 1000,
      date: '2026-11-20',
      accountId: 'a',
      description: 'Refund',
    });

    const events = monthEvents({
      month: '2026-11',
      recurrences: [rent],
      cards: [card],
      transactions: [purchase, paidRent, scheduled],
      today: '2026-11-06',
    });
    expect(events.get('2026-11-05')).toMatchObject([
      { kind: 'recurrence', done: true, direction: 'out' },
    ]);
    expect(events.get('2026-11-10')).toMatchObject([
      { kind: 'invoice', amountCents: 5000, done: false },
    ]);
    expect(events.get('2026-11-20')).toMatchObject([
      { kind: 'scheduled', direction: 'in', label: 'Refund' },
    ]);
  });
});
