import { describe, expect, it } from 'vitest';
import { makeRecurrence, makeTransaction } from './records';
import {
  materializeRecurrences,
  nextOccurrence,
  occurrences,
  pendingOccurrences,
} from './recurrences';

describe('occurrences', () => {
  it('generates monthly dates clamped to short months', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 180000,
      frequency: 'monthly',
      dayOfMonth: 31,
      startDate: '2026-01-01',
    });
    expect(occurrences(rec, '2026-01-01', '2026-04-30')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('does not emit dates before the start date', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 100,
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-03-10',
    });
    expect(occurrences(rec, '2026-03-01', '2026-05-31')).toEqual(['2026-04-05', '2026-05-05']);
  });

  it('respects the interval and the end date', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 100,
      frequency: 'monthly',
      interval: 3,
      dayOfMonth: 15,
      startDate: '2026-01-15',
      endDate: '2026-10-01',
    });
    expect(occurrences(rec, '2026-01-01', '2027-12-31')).toEqual([
      '2026-01-15',
      '2026-04-15',
      '2026-07-15',
    ]);
  });

  it('skips ahead efficiently with intervals', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 100,
      frequency: 'monthly',
      interval: 2,
      dayOfMonth: 1,
      startDate: '2020-01-01',
    });
    expect(occurrences(rec, '2026-02-01', '2026-06-30')).toEqual(['2026-03-01', '2026-05-01']);
  });

  it('generates weekly dates on the chosen weekday', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 100,
      frequency: 'weekly',
      weekday: 1, // Monday
      startDate: '2026-11-01', // Sunday
    });
    expect(occurrences(rec, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
  });

  it('generates biweekly dates from a later window', () => {
    const rec = makeRecurrence({
      type: 'income',
      amountCents: 100,
      frequency: 'weekly',
      interval: 2,
      startDate: '2026-01-02',
    });
    expect(occurrences(rec, '2026-01-20', '2026-02-20')).toEqual(['2026-01-30', '2026-02-13']);
  });

  it('generates yearly dates, clamping Feb 29', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 100,
      frequency: 'yearly',
      startDate: '2024-02-29',
    });
    expect(occurrences(rec, '2024-01-01', '2028-12-31')).toEqual([
      '2024-02-29',
      '2025-02-28',
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
    ]);
  });

  it('returns nothing for inactive or deleted recurrences', () => {
    const base = {
      type: 'expense' as const,
      amountCents: 1,
      frequency: 'monthly' as const,
      startDate: '2026-01-01',
    };
    expect(
      occurrences(makeRecurrence({ ...base, active: false }), '2026-01-01', '2026-12-31'),
    ).toEqual([]);
    expect(
      occurrences(
        makeRecurrence({ ...base, deletedAt: '2026-01-01T00:00:00Z' }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toEqual([]);
  });

  it('finds the next occurrence', () => {
    const rec = makeRecurrence({
      type: 'expense',
      amountCents: 1,
      frequency: 'monthly',
      dayOfMonth: 5,
      startDate: '2026-01-05',
    });
    expect(nextOccurrence(rec, '2026-11-06')).toBe('2026-12-05');
  });
});

describe('materializeRecurrences', () => {
  const rec = makeRecurrence({
    type: 'expense',
    amountCents: 180000,
    description: 'Rent',
    frequency: 'monthly',
    dayOfMonth: 5,
    startDate: '2026-09-01',
    accountId: 'acc',
  });

  it('creates transactions for every due occurrence up to today', () => {
    const created = materializeRecurrences([rec], [], '2026-11-05');
    expect(created.map((t) => t.date)).toEqual(['2026-09-05', '2026-10-05', '2026-11-05']);
    expect(created.every((t) => t.recurrenceId === rec.id && t.amountCents === 180000)).toBe(true);
    expect(created[0]).toMatchObject({ accountId: 'acc', description: 'Rent', type: 'expense' });
  });

  it('is idempotent and does not resurrect deleted occurrences', () => {
    const first = materializeRecurrences([rec], [], '2026-10-31');
    const deleted = { ...first[0]!, deletedAt: '2026-10-01T00:00:00Z' };
    const again = materializeRecurrences([rec], [deleted, first[1]!], '2026-11-05');
    expect(again.map((t) => t.date)).toEqual(['2026-11-05']);
  });

  it('lists pending occurrences that have no transaction yet', () => {
    const done = makeTransaction({
      type: 'expense',
      amountCents: 1,
      date: '2026-11-05',
      recurrenceId: rec.id,
    });
    expect(pendingOccurrences(rec, [done], '2026-11-01', '2027-01-31')).toEqual([
      '2026-12-05',
      '2027-01-05',
    ]);
  });
});
